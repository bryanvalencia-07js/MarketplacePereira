const V = require("../utils/validation");
const { exigir } = require("../utils/errors");
const { propietario, esAdmin, gestionar } = require("./negocio.service");
function createProductoService(repos) {
  async function visible(producto) {
    const n = producto && (await repos.negocio.find(producto.negocioId));
    return Boolean(producto?.estado === "Activo" && n?.estado === "Activo");
  }
  async function obtener(actor, id) {
    const p = await repos.producto.find(id);
    exigir(p, 404, "Producto no encontrado.");
    const n = await repos.negocio.find(p.negocioId);
    exigir(
      (await visible(p)) ||
        esAdmin(actor) ||
        (actor?.rol === "Comerciante" && n?.usuarioId === actor.id),
      404,
      "Producto no disponible.",
    );
    return p;
  }
  async function listar(actor, query = {}) {
    const gestion = query.gestion === "true";
    if (gestion) gestionar(actor);
    const negocios = await repos.negocio.list();
    const ids = new Set(
      negocios
        .filter((n) =>
          gestion
            ? esAdmin(actor) || n.usuarioId === actor.id
            : n.estado === "Activo",
        )
        .map((n) => n.id),
    );
    const negocioId = query.negocioId ? V.id(query.negocioId) : null;
    if (query.estado) V.opcion(query.estado, V.ESTADOS, "Estado");
    return (await repos.producto.list()).filter(
      (p) =>
        ids.has(p.negocioId) &&
        (gestion || p.estado === "Activo") &&
        (!negocioId || p.negocioId === negocioId) &&
        (!query.estado || p.estado === query.estado) &&
        (!query.categoria || p.categoria === query.categoria) &&
        (!query.buscar ||
          `${p.nombre} ${p.descripcion} ${p.categoria} ${negocios.find((n) => n.id === p.negocioId)?.nombre}`
            .toLowerCase()
            .includes(String(query.buscar).toLowerCase())),
    );
  }
  async function guardar(actor, id, body) {
    gestionar(actor);
    V.objeto(body, [
      "negocioId",
      "nombre",
      "descripcion",
      "categoria",
      "precio",
      "stock",
      "imagen",
      "estado",
    ]);
    return repos.transaccion(async () => {
      const previo = id ? await repos.producto.find(id) : null;
      exigir(!id || previo, 404, "Producto no encontrado.");
      if (previo) {
        const anterior = await repos.negocio.find(previo.negocioId);
        exigir(anterior, 400, "El producto no tiene un comercio válido.");
        propietario(actor, anterior);
      }
      const negocioId =
        body.negocioId === undefined
          ? previo?.negocioId
          : V.entero(body.negocioId, "Comercio");
      const negocio = await repos.negocio.find(negocioId);
      exigir(negocio, 400, "Selecciona un comercio existente.");
      propietario(actor, negocio);
      const cambios = { negocioId };
      for (const [campo, max] of [
        ["nombre", 120],
        ["descripcion", 2000],
        ["categoria", 60],
      ])
        if (!id || Object.hasOwn(body, campo))
          cambios[campo] = V.texto(body[campo], campo, max);
      if (!id || Object.hasOwn(body, "precio")) {
        exigir(
          typeof body.precio === "number" &&
            Number.isFinite(body.precio) &&
            body.precio > 0 &&
            body.precio <= 1e9 &&
            Math.abs(body.precio * 100 - Math.round(body.precio * 100)) <
              0.0001,
          400,
          "El precio debe ser positivo, con máximo dos decimales.",
        );
        cambios.precio = body.precio;
      }
      if (!id || Object.hasOwn(body, "stock"))
        cambios.stock = V.entero(body.stock, "Stock", 0, 1000000);
      if (!id || Object.hasOwn(body, "imagen"))
        cambios.imagen = V.imagen(body.imagen);
      if (!id || Object.hasOwn(body, "estado"))
        cambios.estado = V.opcion(body.estado ?? "Activo", V.ESTADOS, "Estado");
      if (!id) cambios.visitas = 0;
      return id
        ? repos.producto.update(id, cambios)
        : repos.producto.create(cambios);
    });
  }
  return {
    obtener,
    listar,
    crear: (actor, body) => guardar(actor, null, body),
    actualizar: (actor, id, body) => guardar(actor, id, body),
    eliminar: (actor, id) =>
      repos.transaccion(async () => {
        const p = await repos.producto.find(id);
        exigir(p, 404, "Producto no encontrado.");
        const n = await repos.negocio.find(p.negocioId);
        exigir(n, 400, "Comercio no encontrado.");
        propietario(actor, n);
        await repos.producto.delete(id);
        return { id };
      }),
    visita: (id) =>
      repos.transaccion(async () => {
        const p = await repos.producto.find(id);
        exigir(
          (await visible(p)) && p.stock > 0,
          404,
          "Producto no disponible.",
        );
        return repos.producto.update(id, { visitas: p.visitas + 1 });
      }),
  };
}
module.exports = { createProductoService };
