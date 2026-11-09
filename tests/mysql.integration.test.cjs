const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { createPool } = require("../backend/db/pool");
const { migrate } = require("../backend/db/migrate");
const { configuracion } = require("../backend/config");
const { createMysqlRepositories } = require("../backend/repositories/mysql");
const { createUsuarioService } = require("../backend/services/usuario.service");
const { createNegocioService } = require("../backend/services/negocio.service");
const {
  createProductoService,
} = require("../backend/services/producto.service");
const { createApplication } = require("../backend/app");

// Suite separada y destructiva SOLO sobre una base de pruebas explícita.
const config = configuracion();
if (config.dataSource !== "mysql" || !config.db.database.endsWith("_test"))
  throw new Error(
    "Las pruebas MySQL requieren DATA_SOURCE=mysql y DB_NAME terminado en _test; borran sus entidades.",
  );
let pool, repos, otros;
const clave = "Una-clave-de-prueba-2026";
const imagen =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jI5kAAAAASUVORK5CYII=";
const usuario = (correo = "prueba@example.invalid", rol = "Comerciante") => ({
  nombre: "Ana",
  apellido: "Pereira",
  correo,
  rol,
  estado: "Activo",
  passwordHash: "solo-fixture",
});
const negocio = (usuarioId) => ({
  usuarioId,
  nombre: "Café Pereira",
  categoria: "Alimentos",
  telefono: "3001234567",
  direccion: "Calle 1",
  estado: "Activo",
});
const producto = (negocioId) => ({
  negocioId,
  nombre: "Café",
  descripcion: "Tueste local",
  categoria: "Alimentos",
  precio: 10.25,
  stock: 3,
  imagen,
  estado: "Activo",
  popularidad: 0,
});

before(async () => {
  pool = createPool(config.db);
  await migrate(pool);
  repos = createMysqlRepositories(pool);
  otros = createMysqlRepositories(createPool(config.db));
  await repos.ready();
});
beforeEach(async () => {
  await repos.transaccion(async () => {
    // Esta base _test puede conservar fixtures de PR6 de una ejecución anterior.
    // Limpiar asociaciones/historial de prueba antes de sus padres, sin omitir casos.
    for (const t of ["detalles_pedido", "pedidos"])
      await pool.query(`DELETE FROM ${t}`);
    for (const repo of [
      repos.favorito,
      repos.reserva,
      repos.horario,
      repos.servicio,
    ])
      for (const fila of await repo.list()) await repo.delete(fila.id);
    for (const p of await repos.producto.list())
      await repos.producto.delete(p.id);
    for (const n of await repos.negocio.list())
      await repos.negocio.delete(n.id);
    for (const u of await repos.usuario.list())
      await repos.usuario.delete(u.id);
  });
});
after(async () => {
  await otros?.close();
  await pool?.end();
});

test("MySQL real: migración repetible sin pérdida y checksum/incompleta detectados", async () => {
  const u = await repos.usuario.create(usuario());
  await migrate(pool);
  assert.equal((await repos.usuario.find(u.id)).correo, u.correo);
  await pool.execute(
    "UPDATE schema_migrations SET applied = FALSE WHERE version = ?",
    ["001_foundation.sql"],
  );
  try {
    await assert.rejects(migrate(pool), /incompleta/);
  } finally {
    await pool.execute(
      "UPDATE schema_migrations SET applied = TRUE WHERE version = ?",
      ["001_foundation.sql"],
    );
  }
  await pool.execute(
    "UPDATE schema_migrations SET checksum = REPEAT('0',64) WHERE version = ?",
    ["001_foundation.sql"],
  );
  try {
    await assert.rejects(migrate(pool), /alterada/);
  } finally {
    const { readFile } = require("node:fs/promises");
    const { createHash } = require("node:crypto");
    const sql = await readFile(
      require("node:path").join(
        __dirname,
        "../backend/db/migrations/001_foundation.sql",
      ),
    );
    await pool.execute(
      "UPDATE schema_migrations SET checksum = ? WHERE version = ?",
      [createHash("sha256").update(sql).digest("hex"), "001_foundation.sql"],
    );
  }
});

test("MySQL real: CRUD compatible, fechas ISO, decimales, límites e IDs no reutilizados", async () => {
  const u = await repos.usuario.create(usuario());
  const n = await repos.negocio.create(negocio(u.id));
  assert.equal(n.propietario, "Ana Pereira");
  await repos.usuario.update(u.id, { nombre: "Laura" });
  assert.equal((await repos.negocio.find(n.id)).propietario, "Laura Pereira");
  assert.equal(
    (await repos.negocio.update(n.id, { nombre: "Café local" })).propietario,
    "Laura Pereira",
  );
  const p = await repos.producto.create(producto(n.id));
  assert.equal(typeof p.id, "number");
  assert.equal(p.precio, 10.25);
  assert.equal(p.createdAt, new Date(p.createdAt).toISOString());
  const actualizado = await repos.producto.update(p.id, {
    precio: 1e9,
    stock: 1000000,
    createdAt: "ayer",
    id: 999,
  });
  assert.equal(actualizado.precio, 1e9);
  assert.equal(actualizado.id, p.id);
  assert.equal(actualizado.createdAt, p.createdAt);
  assert.equal(await repos.producto.update(4294967295, { stock: 2 }), null);
  assert.equal(await repos.producto.find("1 OR 1=1"), null);
  assert.equal(await repos.producto.delete(p.id), true);
  assert.equal(await repos.producto.delete(p.id), false);
  assert.ok((await repos.producto.create(producto(n.id))).id > p.id);
});

test("MySQL real: UNIQUE, FK, rol del dueño y CHECK refuerzan las invariantes", async () => {
  const u = await repos.usuario.create(usuario());
  const comprador = await repos.usuario.create(
    usuario("comprador@example.invalid", "Comprador"),
  );
  const n = await repos.negocio.create(negocio(u.id));
  const invalido = (accion) => assert.rejects(accion, (e) => e.status === 400);
  await invalido(repos.usuario.create(usuario()));
  await invalido(repos.negocio.create(negocio(u.id)));
  await invalido(repos.negocio.create(negocio(comprador.id)));
  await invalido(repos.negocio.create(negocio(4294967295)));
  await invalido(repos.usuario.delete(u.id));
  await invalido(repos.usuario.update(u.id, { rol: "Comprador" }));
  await invalido(repos.usuario.update(u.id, { estado: "Inválido" }));
  await invalido(
    repos.producto.create({ ...producto(n.id), negocioId: 4294967295 }),
  );
  await invalido(repos.producto.create({ ...producto(n.id), stock: -1 }));
  await invalido(repos.producto.create({ ...producto(n.id), precio: 0 }));
  await repos.producto.create(producto(n.id));
  await invalido(repos.negocio.delete(n.id));
});

test("MySQL real: rollback revierte varias entidades y conexión vuelve a funcionar", async () => {
  await assert.rejects(
    repos.transaccion(async () => {
      const u = await repos.usuario.create(usuario());
      const n = await repos.negocio.create(negocio(u.id));
      await repos.producto.create(producto(n.id));
      throw new Error("cancelar");
    }),
    /cancelar/,
  );
  assert.deepEqual(await repos.usuario.list(), []);
  assert.deepEqual(await repos.negocio.list(), []);
  assert.deepEqual(await repos.producto.list(), []);
  assert.ok((await repos.usuario.create(usuario())).id > 0);
});

test("MySQL real: services conservan unicidad concurrente entre dos pools", async () => {
  const a = createUsuarioService(repos);
  const b = createUsuarioService(otros);
  const body = {
    nombre: "Ana",
    apellido: "Pereira",
    correo: "unico@example.invalid",
    password: clave,
    rol: "Comerciante",
  };
  const resultados = await Promise.allSettled([
    a.registrar(body),
    b.registrar(body),
  ]);
  assert.equal(resultados.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    resultados.find((x) => x.status === "rejected").reason.status,
    400,
  );
  const u = (await repos.usuario.list())[0];
  const negocios = await Promise.allSettled([
    createNegocioService(repos).crear(u, negocio(u.id)),
    createNegocioService(otros).crear(u, negocio(u.id)),
  ]);
  assert.equal(negocios.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal((await repos.negocio.list()).length, 1);
});

test("MySQL real: visitas no pierden incrementos y último administrador se conserva", async () => {
  const u = await repos.usuario.create(usuario());
  const n = await repos.negocio.create(negocio(u.id));
  const p = await repos.producto.create(producto(n.id));
  await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      createProductoService(i % 2 ? repos : otros).visita(p.id),
    ),
  );
  assert.equal((await repos.producto.find(p.id)).popularidad, 12);
  const a = await repos.usuario.create(
    usuario("admin1@example.invalid", "Administrador"),
  );
  const b = await repos.usuario.create(
    usuario("admin2@example.invalid", "Administrador"),
  );
  const cambios = await Promise.allSettled([
    createUsuarioService(repos).actualizar(a, a.id, { estado: "Inactivo" }),
    createUsuarioService(otros).actualizar(b, b.id, { estado: "Inactivo" }),
  ]);
  assert.equal(cambios.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    (await repos.usuario.list()).filter(
      (x) => x.rol === "Administrador" && x.estado === "Activo",
    ).length,
    1,
  );
});

test("MySQL real: API usa persistencia, sesión segura y conserva datos tras recrear aplicación", async () => {
  let servidor, reposAplicacion, reposReinicio;
  try {
    const sistema = await createApplication({
      dataSource: "mysql",
      db: config.db,
      admin: { correo: "admin@example.invalid", password: clave },
    });
    reposAplicacion = sistema.repositories;
    servidor = sistema.app.listen(0, "127.0.0.1");
    await new Promise((r) => servidor.once("listening", r));
    const base = `http://127.0.0.1:${servidor.address().port}/api`;
    assert.equal((await fetch(base + "/usuarios")).status, 401);
    const login = await fetch(base + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correo: "admin@example.invalid",
        password: clave,
      }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie");
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    const { data } = await login.json();
    assert.equal(data.usuario.passwordHash, undefined);
    const headers = {
      "Content-Type": "application/json",
      Cookie: cookie.split(";")[0],
    };
    const body = JSON.stringify({
      nombre: "Ana",
      apellido: "Pereira",
      correo: "nuevo@example.invalid",
      password: clave,
      rol: "Comerciante",
    });
    assert.equal(
      (await fetch(base + "/usuarios", { method: "POST", headers, body }))
        .status,
      403,
    );
    headers["X-CSRF-Token"] = data.csrfToken;
    const creado = await fetch(base + "/usuarios", {
      method: "POST",
      headers,
      body,
    });
    assert.equal(creado.status, 201);
    const id = (await creado.json()).data.id;
    await new Promise((r) => servidor.close(r));
    servidor = null;
    await reposAplicacion.close();
    reposAplicacion = null;
    const reiniciado = await createApplication({
      dataSource: "mysql",
      db: config.db,
    });
    reposReinicio = reiniciado.repositories;
    assert.equal(
      (await reiniciado.servicios.usuarios.obtener(id)).correo,
      "nuevo@example.invalid",
    );
    assert.equal((await reiniciado.servicios.usuarios.listar()).length, 2);
    assert.equal(
      await reiniciado.servicios.auth.resolver(
        cookie.split(";")[0].split("=")[1],
      ),
      null,
    );
  } finally {
    if (servidor) await new Promise((r) => servidor.close(r));
    await reposAplicacion?.close();
    await reposReinicio?.close();
  }
});
