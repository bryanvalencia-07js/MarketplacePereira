const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { createPool } = require("../backend/db/pool");
const { migrate } = require("../backend/db/migrate");
const { configuracion } = require("../backend/config");
const { createMysqlRepositories } = require("../backend/repositories/mysql");
const { createPedidoService } = require("../backend/services/pedido.service");
const { createApplication } = require("../backend/app");
const { hashPassword } = require("../backend/utils/password");
const config = configuracion();
if (config.dataSource !== "mysql" || !config.db.database.endsWith("_test"))
  throw new Error("Requiere una base dedicada _test.");
let pool,
  r,
  otro,
  buyer,
  buyer2,
  merchant,
  merchant2,
  admin,
  n1,
  n2,
  p1,
  p2,
  hash;
const key = "004_orders_and_details.sql";
const tablas = [
  "detalles_pedido",
  "pedidos",
  "favoritos",
  "reservas",
  "horarios_servicio",
  "servicios",
  "productos",
  "negocios",
  "usuarios",
];
const body = (cantidad = 1, productoId = p1.id) => ({
  items: [{ productoId, cantidad }],
});
const pedidos = (repo = r) => createPedidoService(repo);
const status = (n) => (e) => e.status === n;
before(async () => {
  pool = createPool(config.db);
  await migrate(pool);
  r = createMysqlRepositories(pool);
  otro = createMysqlRepositories(createPool(config.db));
  hash = await hashPassword("Una-clave-de-prueba-2026");
});
after(async () => {
  await otro?.close();
  await pool?.end();
});
beforeEach(async () => {
  for (const t of tablas) await pool.query(`DELETE FROM ${t}`);
  const user = (correo, rol) =>
    r.usuario.create({
      nombre: "Test",
      apellido: "PR7",
      correo,
      rol,
      passwordHash: hash,
      estado: "Activo",
    });
  merchant = await user("merchant1@example.invalid", "Comerciante");
  merchant2 = await user("merchant2@example.invalid", "Comerciante");
  buyer = await user("buyer1@example.invalid", "Comprador");
  buyer2 = await user("buyer2@example.invalid", "Comprador");
  admin = await user("admin@example.invalid", "Administrador");
  const negocio = (u) =>
    r.negocio.create({
      usuarioId: u.id,
      nombre: `Local ${u.id}`,
      categoria: "Alimentos",
      telefono: "3001234567",
      direccion: "Calle 1",
      estado: "Activo",
    });
  n1 = await negocio(merchant);
  n2 = await negocio(merchant2);
  const producto = (n) =>
    r.producto.create({
      negocioId: n.id,
      nombre: "Café",
      descripcion: "Local",
      categoria: "Alimentos",
      precio: 30000,
      stock: 5,
      imagen: "fixture",
      estado: "Activo",
    });
  p1 = await producto(n1);
  p2 = await producto(n2);
});
test("004: 001→002→003→004 conserva todas las filas/columnas PR6, catálogos y checksums", async () => {
  // Simular una instalación 003 real con las nueve entidades pobladas.
  const s = await r.servicio.create({
    negocioId: n1.id,
    categoriaId: p1.categoriaId,
    nombre: "Visita",
    descripcion: "Local",
    precioReferencia: 0,
    estado: "Activo",
    duracionMinutos: 60,
    capacidadSimultanea: 1,
  });
  await r.horario.create({
    servicioId: s.id,
    diaSemana: 1,
    horaInicio: "09:00",
    horaFin: "12:00",
  });
  await r.reserva.create({
    usuarioId: buyer.id,
    servicioId: s.id,
    fechaHoraInicio: "2099-01-05T14:00:00Z",
    estado: "Confirmada",
  });
  await r.favorito.create({ usuarioId: buyer.id, productoId: p1.id });
  await pool.query("DROP TABLE detalles_pedido");
  await pool.query("DROP TABLE pedidos");
  await pool.execute("DELETE FROM schema_migrations WHERE version=?", [key]);
  const historicas = ["roles", "categorias", ...tablas.slice(2).reverse()];
  const snapshot = async () =>
    Promise.all(
      historicas.map(
        async (t) => (await pool.query(`SELECT * FROM ${t} ORDER BY id`))[0],
      ),
    );
  const cols = async () =>
    (
      await pool.query(
        "SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME NOT IN ('pedidos','detalles_pedido') ORDER BY TABLE_NAME,ORDINAL_POSITION",
      )
    )[0];
  const antes = await snapshot(),
    columnas = await cols();
  assert.ok(antes.every((rows) => rows.length > 0));
  await assert.rejects(r.ready(), /migraciones/);
  await migrate(pool);
  await r.ready();
  await migrate(pool);
  assert.deepEqual(await snapshot(), antes);
  assert.deepEqual(await cols(), columnas);
  const [versions] = await pool.query(
    "SELECT * FROM schema_migrations ORDER BY version",
  );
  assert.deepEqual(
    versions.map((v) => v.version.slice(0, 3)),
    ["001", "002", "003", "004"],
  );
  const historical = [
    "d527db03c8dfa21e30d042cd0061da30191aafb7134de071a31ace4bd1ca21ca",
    "8a22693280d0b780c6453733520c9bc4efc60e69ad498af63c1692617ffe7a74",
    "ee99144dfabc82d9bf75dcbc7a323f42bdd4c46f2e572d32dd2b485536150d23",
  ];
  for (const [i, v] of versions.entries()) {
    const hash = createHash("sha256")
      .update(
        await fs.readFile(
          path.join(__dirname, "../backend/db/migrations", v.version),
        ),
      )
      .digest("hex");
    assert.equal(v.applied, 1);
    assert.equal(v.checksum, hash);
    if (i < 3) assert.equal(hash, historical[i]);
  }
  const [tables] = await pool.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()",
  );
  assert.equal(tables.length, 13); // once de negocio + dos técnicas
});
for (const stock of [1, 3])
  test(`PR7 MySQL: stock ${stock}, dos pools independientes, solicitudes HTTP simultáneas`, async () => {
    await r.producto.update(p1.id, { stock });
    const servers = [];
    try {
      const bases = [];
      for (const repo of [r, otro]) {
        const server = (
          await createApplication({ repositories: repo })
        ).app.listen(0, "127.0.0.1");
        servers.push(server);
        await new Promise((ok) => server.once("listening", ok));
        bases.push(`http://127.0.0.1:${server.address().port}/api`);
      }
      const auth = await Promise.all(
        bases.map(async (base, i) => {
          const res = await fetch(base + "/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              correo: i ? buyer2.correo : buyer.correo,
              password: "Una-clave-de-prueba-2026",
            }),
          });
          assert.equal(res.status, 200);
          const json = await res.json();
          return {
            cookie: res.headers.get("set-cookie").split(";")[0],
            csrf: json.data.csrfToken,
          };
        }),
      );
      const intento = async (i) => {
        const x = i % 2;
        const res = await fetch(bases[x] + "/pedidos", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: auth[x].cookie,
            "X-CSRF-Token": auth[x].csrf,
          },
          body: JSON.stringify(body()),
        });
        const json = await res.json();
        if (res.status !== 201)
          throw Object.assign(new Error(json.mensaje), { status: res.status });
        return json.data;
      };
      const rr = await Promise.allSettled(
        Array.from({ length: stock + 1 }, (_, i) => intento(i)),
      );
      assert.equal(rr.filter((x) => x.status === "fulfilled").length, stock);
      const fallos = rr.filter((x) => x.status === "rejected");
      assert.equal(fallos.length, 1);
      assert.equal(fallos[0].reason.status, 409);
      assert.equal((await r.producto.find(p1.id)).stock, 0);
      const [detalles] = await pool.execute(
        "SELECT * FROM detalles_pedido WHERE productoId=?",
        [p1.id],
      );
      assert.equal(detalles.length, stock);
      assert.equal((await r.pedido.list()).length, stock);
    } finally {
      for (const s of servers) await new Promise((ok) => s.close(ok));
    }
  });
test("PR7 MySQL: rollback all-or-nothing multinegocio con stock insuficiente", async () => {
  await r.producto.update(p2.id, { stock: 0 });
  const server = (await createApplication({ repositories: r })).app.listen(
    0,
    "127.0.0.1",
  );
  await new Promise((ok) => server.once("listening", ok));
  try {
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const login = await fetch(base + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correo: buyer.correo,
        password: "Una-clave-de-prueba-2026",
      }),
    });
    assert.equal(login.status, 200);
    const auth = await login.json();
    const res = await fetch(base + "/pedidos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: login.headers.get("set-cookie").split(";")[0],
        "X-CSRF-Token": auth.data.csrfToken,
      },
      body: JSON.stringify({
        items: [...body(2).items, ...body(1, p2.id).items],
      }),
    });
    assert.equal(res.status, 409);
    assert.match((await res.json()).mensaje, /Stock insuficiente/);
  } finally {
    await new Promise((ok) => server.close(ok));
  }
  assert.equal((await r.pedido.list()).length, 0);
  assert.equal((await r.detallePedido.list()).length, 0);
  assert.equal((await r.producto.find(p1.id)).stock, 5);
  assert.equal((await r.producto.find(p2.id)).stock, 0);
});
test("PR7 MySQL: rollback tras INSERT y descuento previos al fallo del segundo negocio", async () => {
  const original = r.detallePedido.create;
  let veces = 0;
  r.detallePedido.create = async (d) => {
    if (++veces === 2) throw new Error("fallo posterior");
    return original(d);
  };
  try {
    await assert.rejects(
      pedidos().crear(buyer, {
        items: [...body(2).items, ...body(1, p2.id).items],
      }),
      /fallo posterior/,
    );
  } finally {
    r.detallePedido.create = original;
  }
  assert.equal((await r.pedido.list()).length, 0);
  assert.equal((await r.detallePedido.list()).length, 0);
  assert.equal((await r.producto.find(p1.id)).stock, 5);
  assert.equal((await r.producto.find(p2.id)).stock, 5);
});
test("PR7 MySQL: multinegocio, duplicados, dinero histórico y trazabilidad inactiva", async () => {
  const pp = await pedidos().crear(buyer, {
    items: [...body().items, ...body().items, ...body(1, p2.id).items],
    observaciones: "Nota general",
  });
  assert.equal(pp.length, 2);
  for (const [i, n] of [n1, n2].entries()) {
    assert.equal(pp[i].negocioId, n.id);
    assert.equal(pp[i].observaciones, "Nota general");
    assert.equal(pp[i].detalles.length, 1);
    const detalle = pp[i].detalles[0];
    assert.equal((await r.producto.find(detalle.productoId)).negocioId, n.id);
  }
  assert.equal(pp[0].detalles[0].cantidad, 2);
  assert.equal(pp[0].total, 60000);
  await r.producto.update(p1.id, {
    precio: 40000,
    estado: "Inactivo",
    nombre: "Café nuevo",
  });
  const historico = await pedidos(otro).obtener(buyer, pp[0].id);
  assert.equal(historico.detalles[0].precioUnitario, 30000);
  assert.equal(historico.detalles[0].subtotal, 60000);
  assert.equal(historico.total, 60000);
  assert.equal(historico.detalles[0].nombre, "Café nuevo");
  for (const t of ["pedidos", "detalles_pedido"]) {
    const [columns] = await pool.query(`SHOW COLUMNS FROM ${t}`);
    assert.ok(
      !columns.some((c) =>
        ["total", "subtotal", "fecha_pedido", "nombre_producto"].includes(
          c.Field,
        ),
      ),
    );
  }
});
test("PR7 MySQL: cancelación concurrente entre pools restaura stock solo una vez y hace rollback al fallar", async () => {
  const [p] = await pedidos().crear(buyer, body(2));
  assert.equal((await r.producto.find(p1.id)).stock, 3);
  const original = r.producto.update;
  r.producto.update = async (id, d) => {
    await original(id, d);
    throw new Error("fallo restock");
  };
  try {
    await assert.rejects(pedidos().cancelar(buyer, p.id), /fallo restock/);
  } finally {
    r.producto.update = original;
  }
  assert.equal((await r.producto.find(p1.id)).stock, 3);
  assert.equal((await r.pedido.find(p.id)).estado, "Pendiente");
  await Promise.all([
    pedidos().cancelar(buyer, p.id),
    pedidos(otro).cancelar(merchant, p.id),
  ]);
  assert.equal((await r.producto.find(p1.id)).stock, 5);
  assert.equal((await r.detallePedido.list()).length, 1);
  await assert.rejects(
    pedidos().estado(admin, p.id, { estado: "Confirmado" }),
    status(409),
  );
});
test("004 SQL: PK/FK/UNIQUE/CHECK/índices, RESTRICT histórico y errores de negocio", async () => {
  const [p] = await pedidos().crear(buyer, body());
  const d = p.detalles[0];
  const fallo = (sql, params = []) => assert.rejects(pool.execute(sql, params));
  for (const cambio of [
    "estado='Otro'",
    "usuarioId=4294967295",
    "negocioId=4294967295",
  ])
    await fallo(`UPDATE pedidos SET ${cambio} WHERE id=?`, [p.id]);
  for (const cambio of [
    "cantidad=0",
    "cantidad=-1",
    "cantidad=1001",
    "precioUnitario=0",
    "precioUnitario=-1",
    "pedidoId=4294967295",
    "productoId=4294967295",
  ])
    await fallo(`UPDATE detalles_pedido SET ${cambio} WHERE id=?`, [d.id]);
  await fallo(
    "INSERT INTO detalles_pedido (pedidoId,productoId,cantidad,precioUnitario) VALUES (?,?,1,1)",
    [p.id, p1.id],
  );
  await fallo("INSERT INTO pedidos (id,usuarioId,negocioId) VALUES (?,?,?)", [
    p.id,
    buyer.id,
    n1.id,
  ]);
  await fallo(
    "INSERT INTO detalles_pedido (id,pedidoId,productoId,cantidad,precioUnitario) VALUES (?,?,?,1,1)",
    [d.id, p.id, p2.id],
  );
  for (const [t, id] of [
    ["usuarios", buyer.id],
    ["negocios", n1.id],
    ["productos", p1.id],
    ["pedidos", p.id],
  ])
    await fallo(`DELETE FROM ${t} WHERE id=?`, [id]);
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
    createProductoService(r).eliminar(admin, p1.id),
    status(409),
  );
  await assert.rejects(
    createNegocioService(r).eliminar(admin, n1.id),
    status(409),
  );
  await assert.rejects(
    createUsuarioService(r).eliminar(admin, buyer.id),
    status(409),
  );
  const [tables] = await pool.query(
    "SELECT ENGINE,TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('pedidos','detalles_pedido')",
  );
  assert.equal(tables.length, 2);
  assert.ok(
    tables.every(
      (t) => t.ENGINE === "InnoDB" && t.TABLE_COLLATION.startsWith("utf8mb4"),
    ),
  );
  const [indexes] = await pool.query(
    "SELECT INDEX_NAME,GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columnas FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('pedidos','detalles_pedido') GROUP BY TABLE_NAME,INDEX_NAME",
  );
  for (const cols of [
    "usuarioId,createdAt",
    "negocioId,estado,createdAt",
    "pedidoId,productoId",
    "productoId",
  ])
    assert.ok(
      indexes.some((x) => x.columnas === cols),
      cols,
    );
});
test("004: checksum alterado e intento incompleto bloquean runner/arranque", async () => {
  const [[v]] = await pool.execute(
    "SELECT checksum FROM schema_migrations WHERE version=?",
    [key],
  );
  try {
    await pool.execute(
      "UPDATE schema_migrations SET checksum=REPEAT('0',64) WHERE version=?",
      [key],
    );
    await assert.rejects(migrate(pool), /alterada/);
  } finally {
    await pool.execute(
      "UPDATE schema_migrations SET checksum=? WHERE version=?",
      [v.checksum, key],
    );
  }
  try {
    await pool.execute(
      "UPDATE schema_migrations SET applied=FALSE WHERE version=?",
      [key],
    );
    await assert.rejects(migrate(pool), /incompleta/);
    await assert.rejects(r.ready(), /migraciones/);
  } finally {
    await pool.execute(
      "UPDATE schema_migrations SET applied=TRUE WHERE version=?",
      [key],
    );
  }
});

test("PR7 MySQL: categorías inactivas, ownership y transiciones conservan stock e historial", async () => {
  await pool.execute("UPDATE categorias SET estado='Inactivo' WHERE id=?", [
    p1.categoriaId,
  ]);
  try {
    await assert.rejects(pedidos().crear(buyer, body()), status(404));
  } finally {
    await pool.execute("UPDATE categorias SET estado='Activo' WHERE id=?", [
      p1.categoriaId,
    ]);
  }
  const [p] = await pedidos().crear(buyer, body(2));
  await assert.rejects(pedidos(otro).obtener(buyer2, p.id), status(403));
  await assert.rejects(
    pedidos(otro).estado(merchant2, p.id, { estado: "Confirmado" }),
    status(403),
  );
  assert.equal(
    (await pedidos(otro).gestion(merchant2, { negocioId: String(n1.id) }))
      .length,
    0,
  );
  await assert.rejects(
    pedidos().estado(merchant, p.id, { estado: "Completado" }),
    status(409),
  );
  await pedidos().estado(merchant, p.id, { estado: "Confirmado" });
  await assert.rejects(pedidos(otro).cancelar(buyer, p.id), status(409));
  await pedidos(otro).estado(admin, p.id, { estado: "Completado" });
  await assert.rejects(pedidos().cancelar(admin, p.id), status(409));
  assert.equal((await r.producto.find(p1.id)).stock, 3);
});
