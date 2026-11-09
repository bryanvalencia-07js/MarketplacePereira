const V = require("../utils/validation");
const { exigir } = require("../utils/errors");
const { comprador } = require("./reserva.service");
const { esAdmin, gestionar } = require("./negocio.service");
const ESTADOS = ["Pendiente", "Confirmado", "Completado", "Cancelado"];
const TRANSICIONES = {
  Pendiente: ["Confirmado", "Cancelado"],
  Confirmado: ["Completado", "Cancelado"],
  Completado: [],
  Cancelado: [],
};
// Límites combinados: <=100 líneas de entrada y <=1000 unidades por producto.
// Hasta 1e9 COP por unidad: el total en centavos sigue siendo entero seguro.
function entrada(body) {
  V.objeto(body, ["items", "observaciones"]);
  exigir(
    Array.isArray(body.items) &&
      body.items.length > 0 &&
      body.items.length <= 100,
    400,
    "Incluye entre 1 y 100 líneas de productos.",
  );
  const cantidades = new Map();
  for (const item of body.items) {
    V.objeto(item, ["productoId", "cantidad"]);
    const id = V.entero(item.productoId, "Producto", 1, 4294967295);
    const cantidad = V.entero(item.cantidad, "Cantidad", 1, 1000);
    cantidades.set(
      id,
      V.entero(
        (cantidades.get(id) || 0) + cantidad,
        "Cantidad consolidada",
        1,
        1000,
      ),
    );
  }
  return {
    items: [...cantidades]
      .sort(([a], [b]) => a - b)
      .map(([productoId, cantidad]) => ({ productoId, cantidad })),
    observaciones:
      body.observaciones === undefined
        ? null
        : V.texto(body.observaciones, "Observaciones", 2000, false) || null,
  };
}
function createPedidoService(repos) {
  async function autorizar(a, id) {
    exigir(a, 401, "Inicia sesión para continuar.");
    const p = await repos.pedido.find(id);
    exigir(p, 404, "Pedido no encontrado.");
    const n = await repos.negocio.find(p.negocioId);
    exigir(
      esAdmin(a) ||
        (a.rol === "Comprador" && p.usuarioId === a.id) ||
        (a.rol === "Comerciante" && n?.usuarioId === a.id),
      403,
      "No tienes acceso a este pedido.",
    );
    return p;
  }
  async function proyectar(p) {
    const negocio = await repos.negocio.find(p.negocioId);
    const detalles = [];
    let centavos = 0;
    for (const d of await repos.detallePedido.list()) {
      if (d.pedidoId !== p.id) continue;
      const producto = await repos.producto.find(d.productoId);
      const subtotalCentavos = Math.round(d.precioUnitario * 100) * d.cantidad;
      centavos += subtotalCentavos;
      detalles.push({
        ...d,
        nombre: producto?.nombre ?? null,
        subtotal: subtotalCentavos / 100,
      });
    }
    return {
      ...p,
      fecha: p.createdAt,
      negocio: negocio && { id: negocio.id, nombre: negocio.nombre },
      detalles,
      total: centavos / 100,
    };
  }
  async function cambiar(a, id, destino, soloCancelar = false) {
    return repos.transaccion(async () => {
      const p = await autorizar(a, id);
      if (soloCancelar && p.estado === "Cancelado") return proyectar(p);
      if (a.rol === "Comprador") {
        exigir(soloCancelar, 403, "No puedes gestionar estados de pedidos.");
        exigir(
          p.estado === "Pendiente",
          409,
          "Solo puedes cancelar un pedido Pendiente.",
        );
      } else gestionar(a);
      exigir(
        TRANSICIONES[p.estado]?.includes(destino),
        409,
        "Transición de estado no permitida.",
      );
      if (destino === "Cancelado") {
        const detalles = (await repos.detallePedido.list())
          .filter((d) => d.pedidoId === id)
          .sort((a, b) => a.productoId - b.productoId);
        await repos.bloquearProductos(detalles.map((d) => d.productoId));
        for (const d of detalles) {
          const producto = await repos.producto.find(d.productoId);
          exigir(
            producto,
            409,
            "No se puede restaurar la disponibilidad de este pedido.",
          );
          exigir(
            producto.stock + d.cantidad <= 1000000,
            409,
            "La restitución supera el límite de stock del producto. Revisa sus existencias antes de cancelar.",
          );
          await repos.producto.update(producto.id, {
            stock: producto.stock + d.cantidad,
          });
        }
      }
      return proyectar(await repos.pedido.update(id, { estado: destino }));
    });
  }
  return {
    async crear(a, body) {
      comprador(a);
      const { items, observaciones } = entrada(body);
      return repos.transaccion(async () => {
        await repos.bloquearProductos(items.map((i) => i.productoId));
        const grupos = new Map();
        let totalCentavos = 0;
        // Todas las lecturas/validaciones y escrituras conservan la misma transacción.
        for (const item of items) {
          const p = await repos.producto.find(item.productoId);
          const n = p && (await repos.negocio.find(p.negocioId));
          const c = p && (await repos.categoria.find(p.categoriaId));
          exigir(
            p?.estado === "Activo" &&
              n?.estado === "Activo" &&
              c?.estado === "Activo",
            404,
            `Producto #${item.productoId} no disponible.`,
          );
          exigir(
            Number.isFinite(p.precio) &&
              p.precio > 0 &&
              p.precio <= 1e9 &&
              Math.abs(p.precio * 100 - Math.round(p.precio * 100)) < 0.0001,
            409,
            `Producto #${p.id} sin precio válido.`,
          );
          exigir(
            Number.isSafeInteger(p.stock) && p.stock >= item.cantidad,
            409,
            `Stock insuficiente para el producto #${p.id}.`,
          );
          totalCentavos += Math.round(p.precio * 100) * item.cantidad;
          exigir(
            Number.isSafeInteger(totalCentavos),
            400,
            "El importe del carrito supera el límite de cálculo seguro. Reduce las cantidades.",
          );
          if (!grupos.has(p.negocioId)) grupos.set(p.negocioId, []);
          grupos
            .get(p.negocioId)
            .push({ producto: p, cantidad: item.cantidad });
        }
        const pedidos = [];
        for (const [negocioId, lineas] of grupos) {
          const pedido = await repos.pedido.create({
            usuarioId: a.id,
            negocioId,
            estado: "Pendiente",
            observaciones,
          });
          for (const { producto, cantidad } of lineas) {
            await repos.detallePedido.create({
              pedidoId: pedido.id,
              productoId: producto.id,
              cantidad,
              precioUnitario: producto.precio,
            });
            await repos.producto.update(producto.id, {
              stock: producto.stock - cantidad,
            });
          }
          pedidos.push(await proyectar(pedido));
        }
        return pedidos;
      });
    },
    async mios(a) {
      comprador(a);
      return Promise.all(
        (await repos.pedido.list())
          .filter((p) => p.usuarioId === a.id)
          .sort((a, b) => b.id - a.id)
          .map(proyectar),
      );
    },
    async gestion(a, q = {}) {
      gestionar(a);
      const negocioId = q.negocioId ? V.id(q.negocioId) : null;
      const estado = q.estado ? V.opcion(q.estado, ESTADOS, "Estado") : null;
      const ids = new Set(
        (await repos.negocio.list())
          .filter((n) => esAdmin(a) || n.usuarioId === a.id)
          .map((n) => n.id),
      );
      return Promise.all(
        (await repos.pedido.list())
          .filter(
            (p) =>
              ids.has(p.negocioId) &&
              (!negocioId || p.negocioId === negocioId) &&
              (!estado || p.estado === estado),
          )
          .sort((a, b) => b.id - a.id)
          .map(proyectar),
      );
    },
    obtener: async (a, id) => proyectar(await autorizar(a, id)),
    cancelar: (a, id) => cambiar(a, id, "Cancelado", true),
    async estado(a, id, body) {
      gestionar(a);
      V.objeto(body, ["estado"]);
      V.opcion(body.estado, ESTADOS, "Estado");
      return cambiar(a, id, body.estado);
    },
  };
}
module.exports = { createPedidoService };
