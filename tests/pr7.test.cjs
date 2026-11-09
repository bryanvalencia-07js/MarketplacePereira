const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  fixture,
  comprador,
  vendedor,
  ajeno,
  admin,
} = require("./pr6.helpers.cjs");
const { createPedidoService } = require("../backend/services/pedido.service");
function setup(extra = {}) {
  const ctx = fixture({
    productos: [
      {
        id: 1,
        negocioId: 1,
        categoriaId: 9,
        nombre: "Café",
        precio: 30000,
        stock: 5,
        estado: "Activo",
      },
      {
        id: 2,
        negocioId: 2,
        categoriaId: 9,
        nombre: "Pan",
        precio: 10.25,
        stock: 5,
        estado: "Activo",
      },
    ],
    ...extra,
  });
  return { ...ctx, p: createPedidoService(ctx.repos) };
}
const body = (cantidad = 2, productoId = 1) => ({
  items: [{ productoId, cantidad }],
});
const status = (n) => (e) => e.status === n;
test("PR7 memory: multinegocio, consolidación, precio histórico y totales derivados", async () => {
  const { repos, p } = setup();
  const pedidos = await p.crear(comprador, {
    items: [...body(1).items, ...body(2).items, ...body(3, 2).items],
    observaciones: "Horario comercial",
  });
  assert.equal(pedidos.length, 2);
  assert.deepEqual(
    pedidos.map((x) => x.negocioId),
    [1, 2],
  );
  assert.equal(pedidos[0].detalles.length, 1);
  assert.equal(pedidos[0].detalles[0].cantidad, 3);
  assert.equal(pedidos[1].total, 30.75);
  assert.equal((await repos.producto.find(1)).stock, 2);
  await repos.producto.update(1, { precio: 40000, nombre: "Nuevo nombre" });
  const historico = await p.obtener(comprador, pedidos[0].id);
  assert.equal(historico.detalles[0].precioUnitario, 30000);
  assert.equal(historico.detalles[0].nombre, "Nuevo nombre");
  assert.equal(historico.total, 90000);
  assert.equal(historico.fecha, historico.createdAt);
  assert.equal(historico.estado, "Pendiente");
  assert.equal(historico.observaciones, "Horario comercial");
  assert.ok(!Object.hasOwn(await repos.pedido.find(historico.id), "total"));
  assert.ok(!Object.hasOwn((await repos.detallePedido.list())[0], "subtotal"));
});
test("PR7 memory: validación estricta de cantidades, IDs y campos controlados por servidor", async () => {
  const { p } = setup();
  for (const cantidad of [0, -1, 1.1, NaN, Infinity, "2", "1e2", null, 1001])
    await assert.rejects(p.crear(comprador, body(cantidad)), status(400));
  for (const key of [
    "usuarioId",
    "idUsuario",
    "id_usuario",
    "negocioId",
    "precioUnitario",
    "estado",
    "total",
    "subtotal",
  ])
    await assert.rejects(
      p.crear(comprador, { ...body(), [key]: 5 }),
      status(400),
    );
  for (const key of [
    "precioUnitario",
    "negocioId",
    "nombre",
    "subtotal",
    "estado",
  ])
    await assert.rejects(
      p.crear(comprador, { items: [{ productoId: 1, cantidad: 1, [key]: 1 }] }),
      status(400),
    );
  for (const value of [
    { items: [] },
    { items: "1" },
    {},
    { items: Array(101).fill({ productoId: 1, cantidad: 1 }) },
    { items: [{ productoId: "1", cantidad: 1 }] },
    { ...body(), observaciones: "x".repeat(2001) },
  ])
    await assert.rejects(p.crear(comprador, value), status(400));
  await assert.rejects(
    p.crear(comprador, { items: [...body(600).items, ...body(600).items] }),
    status(400),
  );
});
test("PR7 memory: elegibilidad, categoría, precio, stock y carrito all-or-nothing", async () => {
  for (const cambio of [
    { estado: "Inactivo" },
    { stock: 0 },
    { precio: 0 },
    { precio: NaN },
    { precio: 1.001 },
    { categoriaId: 10 },
  ]) {
    const { repos, p } = setup();
    await repos.producto.update(
      2,
      cambio.categoriaId ? { estado: "Inactivo" } : cambio,
    );
    // Categoría inactiva heredada en fixtures, sin permitir asignación nueva.
    const ctx = cambio.categoriaId
      ? setup({
          productos: [
            {
              id: 2,
              negocioId: 2,
              categoriaId: 10,
              nombre: "Archivo",
              precio: 1,
              stock: 5,
              estado: "Activo",
            },
          ],
        })
      : { repos, p };
    await assert.rejects(ctx.p.crear(comprador, body(1, 2)), (e) =>
      [404, 409].includes(e.status),
    );
    assert.equal((await ctx.repos.pedido.list()).length, 0);
  }
  const { repos, p } = setup();
  await assert.rejects(p.crear(comprador, body(1, 999)), status(404));
  await repos.negocio.update(2, { estado: "Inactivo" });
  await assert.rejects(p.crear(comprador, body(1, 2)), status(404));
  await repos.negocio.update(2, { estado: "Activo" });
  await assert.rejects(
    p.crear(comprador, { items: [...body().items, ...body(6, 2).items] }),
    status(409),
  );
  assert.equal((await repos.pedido.list()).length, 0);
  assert.equal((await repos.detallePedido.list()).length, 0);
  assert.equal((await repos.producto.find(1)).stock, 5);
});
test("PR7 memory: rollback después de una escritura fallida y aislamiento de lectura", async () => {
  const { repos, p } = setup();
  const original = repos.detallePedido.create;
  let count = 0;
  repos.detallePedido.create = async (datos) => {
    assert.equal((await repos.pedido.list()).length > 0, true);
    if (++count === 2) throw new Error("fallo de almacenamiento");
    return original(datos);
  };
  await assert.rejects(
    p.crear(comprador, { items: [...body().items, ...body(1, 2).items] }),
    /almacenamiento/,
  );
  assert.equal((await repos.pedido.list()).length, 0);
  assert.equal((await repos.detallePedido.list()).length, 0);
  assert.equal((await repos.producto.find(1)).stock, 5);
});
for (const stock of [1, 3])
  test(`PR7 memory: ${stock} unidades, compradores concurrentes`, async () => {
    const { repos, p } = setup();
    await repos.producto.update(1, { stock });
    const rr = await Promise.allSettled(
      Array.from({ length: stock + 1 }, (_, i) =>
        p.crear({ ...comprador, id: i % 2 ? 2 : 5 }, body(1)),
      ),
    );
    assert.equal(rr.filter((x) => x.status === "fulfilled").length, stock);
    assert.equal(rr.find((x) => x.status === "rejected").reason.status, 409);
    assert.equal((await repos.producto.find(1)).stock, 0);
    assert.equal((await repos.detallePedido.list()).length, stock);
  });
test("PR7 memory: estados, permisos, terminales y restock exactamente una vez", async () => {
  const { repos, p } = setup();
  for (const actor of [null, vendedor, admin])
    await assert.rejects(p.crear(actor, body()), status(actor ? 403 : 401));
  const [pedido] = await p.crear(comprador, body());
  const otro = { ...comprador, id: 5 };
  for (const actor of [ajeno, otro]) {
    await assert.rejects(p.obtener(actor, pedido.id), status(403));
    await assert.rejects(p.cancelar(actor, pedido.id), status(403));
  }
  assert.equal((await p.mios(comprador)).length, 1);
  assert.equal((await p.mios(otro)).length, 0);
  assert.equal((await p.gestion(ajeno, { negocioId: "1" })).length, 0);
  assert.equal((await p.gestion(admin)).length, 1);
  await assert.rejects(
    p.estado(vendedor, pedido.id, { estado: "Completado" }),
    status(409),
  );
  await assert.rejects(
    p.estado(comprador, pedido.id, { estado: "Confirmado" }),
    status(403),
  );
  await p.estado(vendedor, pedido.id, { estado: "Confirmado" });
  await assert.rejects(p.cancelar(comprador, pedido.id), status(409));
  await p.estado(admin, pedido.id, { estado: "Completado" });
  await assert.rejects(p.cancelar(admin, pedido.id), status(409));
  await assert.rejects(
    p.estado(admin, pedido.id, { estado: "Pendiente" }),
    status(409),
  );
  const [nuevo] = await p.crear(comprador, body(1));
  await Promise.all([
    p.cancelar(comprador, nuevo.id),
    p.cancelar(vendedor, nuevo.id),
  ]);
  assert.equal((await repos.producto.find(1)).stock, 3); // dos unidades completadas
  await assert.rejects(
    p.estado(admin, nuevo.id, { estado: "Confirmado" }),
    status(409),
  );
  const [confirmado] = await p.crear(comprador, body(1));
  await p.estado(vendedor, confirmado.id, { estado: "Confirmado" });
  await p.estado(vendedor, confirmado.id, { estado: "Cancelado" });
  assert.equal((await repos.producto.find(1)).stock, 3);
});
test("PR7 memory: producto/negocio/usuario conservan historial y producto no se traslada", async () => {
  const { repos, p } = setup();
  await p.crear(comprador, body());
  const {
    createProductoService,
  } = require("../backend/services/producto.service");
  const {
    createNegocioService,
  } = require("../backend/services/negocio.service");
  const {
    createUsuarioService,
  } = require("../backend/services/usuario.service");
  await assert.rejects(
    createProductoService(repos).eliminar(admin, 1),
    status(409),
  );
  await assert.rejects(
    createProductoService(repos).actualizar(admin, 1, { negocioId: 2 }),
    status(409),
  );
  await assert.rejects(
    createNegocioService(repos).eliminar(admin, 1),
    status(409),
  );
  await assert.rejects(
    createUsuarioService(repos).eliminar(admin, 2),
    status(409),
  );
  await createProductoService(repos).actualizar(vendedor, 1, {
    estado: "Inactivo",
  });
  assert.equal((await p.mios(comprador)).length, 1);
});
module.exports = { setup, body };
