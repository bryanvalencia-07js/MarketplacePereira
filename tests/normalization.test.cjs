const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createRepositories } = require("../backend/repositories");
const { createApplication } = require("../backend/app");
const { createNegocioService } = require("../backend/services/negocio.service");
const {
  createProductoService,
} = require("../backend/services/producto.service");
const imagen = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";
const fixture = (extra = {}) =>
  createRepositories({
    usuarios: [
      {
        id: 7,
        nombre: "Ana",
        apellido: "Test",
        correo: "ana@example.invalid",
        passwordHash: "hash-preservado",
        rol: "Comerciante",
        estado: "Activo",
      },
    ],
    negocios: [
      {
        id: 8,
        usuarioId: 7,
        nombre: "Local",
        categoria: "Alimentos",
        telefono: "3001234567",
        direccion: "Calle 1",
        estado: "Activo",
      },
    ],
    productos: [
      {
        id: 9,
        negocioId: 8,
        nombre: "Café",
        descripcion: "Local",
        categoria: "Alimentos",
        precio: 12.25,
        stock: 4,
        imagen,
        estado: "Activo",
        popularidad: 37,
      },
    ],
    ...extra,
  });
test("normalización memory: relaciones y contador conservados sin IDs mágicos", async () => {
  const r = fixture();
  const u = await r.usuario.find(7),
    n = await r.negocio.find(8),
    p = await r.producto.find(9);
  assert.equal((await r.rol.find(u.rolId)).nombre, "Comerciante");
  assert.equal((await r.categoria.find(n.categoriaId)).nombre, "Alimentos");
  assert.equal(p.categoriaId, n.categoriaId);
  assert.equal(u.passwordHash, "hash-preservado");
  assert.equal(n.descripcion, null);
  assert.equal(n.municipio, null);
  assert.equal(p.visitas, 37);
  assert.equal(p.popularidad, 37);
  assert.equal((await createProductoService(r).visita(9)).visitas, 38);
});
test("categorías: públicas activas, sin Todas ni escrituras públicas", async () => {
  const r = fixture({
    categorias: [
      { id: 91, nombre: "Alimentos", descripcion: null, estado: "Activo" },
      { id: 92, nombre: "Archivada", descripcion: null, estado: "Inactivo" },
    ],
  });
  const sistema = await createApplication({ repositories: r });
  const server = sistema.app.listen(0, "127.0.0.1");
  await new Promise((ok) => server.once("listening", ok));
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/categorias`;
    const res = await fetch(base);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-store");
    const { data } = await res.json();
    assert.ok(data.some((c) => c.nombre === "Alimentos"));
    assert.equal(data.length, 1);
    assert.ok(data.every((c) => c.estado === "Activo" && c.nombre !== "Todas"));
    assert.equal((await fetch(base, { method: "POST" })).status, 404);
  } finally {
    await new Promise((ok) => server.close(ok));
  }
});
test("categoría: rechaza inexistentes/inactivas y conserva edición sin reasignar", async () => {
  const r = createRepositories({
    usuarios: [{ id: 7, rol: "Comerciante" }],
    negocios: [{ id: 8, usuarioId: 7, categoria: "Archivo", estado: "Activo" }],
    productos: [],
    categorias: [
      { id: 50, nombre: "Archivo", descripcion: null, estado: "Inactivo" },
    ],
  });
  const s = createNegocioService(r),
    actor = { id: 7, rol: "Comerciante" };
  for (const categoria of ["No existe", "Archivo", "Todas"])
    await assert.rejects(
      s.actualizar(actor, 8, { categoria }),
      (e) => e.status === 400,
    );
  assert.equal(
    (
      await s.actualizar(actor, 8, {
        municipio: "Dosquebradas",
        descripcion: "Información real",
      })
    ).municipio,
    "Dosquebradas",
  );
});
test("roles: registro no acepta rolId/idRol ni Administrador; categoría normalizada", async () => {
  const r = fixture();
  const {
    createUsuarioService,
  } = require("../backend/services/usuario.service");
  const s = createUsuarioService(r);
  for (const extra of [
    { rolId: 1 },
    { idRol: 1 },
    { id_rol: 1 },
    { rol: "Administrador" },
  ])
    await assert.rejects(
      s.registrar({
        nombre: "Ana",
        apellido: "Test",
        correo: "nuevo@example.invalid",
        password: "Una-clave-larga-prueba",
        rol: "Comprador",
        ...extra,
      }),
      (e) => e.status === 400,
    );
  const n = await createNegocioService(r).actualizar(
    { id: 7, rol: "Comerciante" },
    8,
    { categoria: "  ALIMENTOS  " },
  );
  assert.equal(n.categoria, "Alimentos");
});

test("roles de referencia resuelven identidad con IDs distintos del catálogo inicial", async () => {
  const r = createRepositories({
    roles: [
      { id: 800, nombre: "Administrador" },
      { id: 900, nombre: "Comerciante" },
      { id: 700, nombre: "Comprador" },
    ],
    usuarios: [],
    negocios: [],
    productos: [],
  });
  const u = await r.usuario.create({
    nombre: "Ana",
    apellido: "Test",
    rol: "Comerciante",
  });
  assert.equal(u.rolId, 900);
  const n = await r.negocio.create({
    usuarioId: u.id,
    nombre: "Local",
    categoria: "Alimentos",
  });
  assert.equal(n.usuarioId, u.id);
  await assert.rejects(
    r.usuario.update(u.id, { rol: "Comprador" }),
    (e) => e.status === 400,
  );
  const b = await r.usuario.create({ rol: "Comprador" });
  await assert.rejects(
    r.negocio.create({ usuarioId: b.id, categoria: "Alimentos" }),
    (e) => e.status === 400,
  );
});
