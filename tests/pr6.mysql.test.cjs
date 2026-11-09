const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { createPool } = require("../backend/db/pool");
const { migrate } = require("../backend/db/migrate");
const { configuracion } = require("../backend/config");
const { createMysqlRepositories } = require("../backend/repositories/mysql");
const {
  createServicioService,
} = require("../backend/services/servicio.service");
const { createHorarioService } = require("../backend/services/horario.service");
const { createReservaService } = require("../backend/services/reserva.service");
const {
  createFavoritoService,
} = require("../backend/services/favorito.service");
const config = configuracion();
if (config.dataSource !== "mysql" || !config.db.database.endsWith("_test"))
  throw new Error("Requiere base dedicada _test.");
let pool, r, otro, merchant, buyer, service;
const fecha = "2099-01-05",
  inicio = `${fecha}T14:00:00.000Z`;
const tablas = [
  "favoritos",
  "reservas",
  "horarios_servicio",
  "servicios",
  "productos",
  "negocios",
  "usuarios",
  "categorias",
  "roles",
  "repository_lock",
  "schema_migrations",
];
const ctx = (repos) => ({
  s: createServicioService(repos),
  h: createHorarioService(repos),
  r: createReservaService(repos),
  f: createFavoritoService(repos),
});
before(async () => {
  pool = createPool(config.db);
  await migrate(pool);
  r = createMysqlRepositories(pool);
  otro = createMysqlRepositories(createPool(config.db));
});
after(async () => {
  await otro?.close();
  await pool?.end();
});
beforeEach(async () => {
  for (const t of tablas.slice(0, 7)) await pool.query(`DELETE FROM ${t}`);
  const u = await r.usuario.create({
    nombre: "Ana",
    apellido: "Test",
    correo: "merchant@example.invalid",
    passwordHash: "fixture-hash",
    rol: "Comerciante",
    estado: "Activo",
  });
  merchant = { ...u };
  buyer = await r.usuario.create({
    nombre: "Luis",
    apellido: "Test",
    correo: "buyer@example.invalid",
    passwordHash: "fixture-hash",
    rol: "Comprador",
    estado: "Activo",
  });
  const n = await r.negocio.create({
    usuarioId: u.id,
    nombre: "Local",
    categoria: "Alimentos",
    telefono: "3001234567",
    direccion: "Calle 1",
    estado: "Activo",
  });
  service = await ctx(r).s.crear(merchant, {
    negocioId: n.id,
    nombre: "Servicio",
    descripcion: "Local",
    categoria: "Alimentos",
    precioReferencia: 0,
    duracionMinutos: 60,
    capacidadSimultanea: 1,
  });
  await ctx(r).h.crear(merchant, service.id, {
    diaSemana: 1,
    horaInicio: "09:00",
    horaFin: "12:00",
  });
});
test("003: aplica sobre 001→002 con datos y conserva esquema, filas y checksums PR5", async () => {
  {
    for (const t of tablas) await pool.query(`DROP TABLE IF EXISTS ${t}`);
    const connection = await pool.getConnection();
    try {
      await require("../backend/db/pool").prepararConexion(connection);
      await connection.query(
        "CREATE TABLE schema_migrations (version VARCHAR(100) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied BOOLEAN NOT NULL DEFAULT FALSE, appliedAt DATETIME(3) NULL) ENGINE=InnoDB",
      );
      for (const version of [
        "001_foundation.sql",
        "002_normalize_roles_categories.sql",
      ]) {
        const sql = await fs.readFile(
          path.join(__dirname, "../backend/db/migrations", version),
          "utf8",
        );
        for (const statement of sql
          .split(";")
          .map((x) => x.trim())
          .filter(Boolean))
          await connection.query(statement);
        await connection.execute(
          "INSERT INTO schema_migrations VALUES (?,?,TRUE,UTC_TIMESTAMP(3))",
          [version, createHash("sha256").update(sql).digest("hex")],
        );
      }
    } finally {
      connection.release();
    }
    const [cols] = await pool.query(
      "SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('roles','categorias','usuarios','negocios','productos') ORDER BY TABLE_NAME,ORDINAL_POSITION",
    );
    const u = await r.usuario.create({
      nombre: "Antes",
      apellido: "PR6",
      correo: "before@example.invalid",
      rol: "Comerciante",
      estado: "Activo",
      passwordHash: "hash-intacto",
    });
    const n = await r.negocio.create({
      usuarioId: u.id,
      nombre: "Anterior",
      categoria: "Alimentos",
      telefono: "3001234567",
      direccion: "Calle 1",
      estado: "Activo",
    });
    const p = await r.producto.create({
      negocioId: n.id,
      categoria: "Alimentos",
      nombre: "Café",
      descripcion: "Intacto",
      precio: 12.25,
      stock: 7,
      imagen: "imagen histórica",
      estado: "Activo",
      visitas: 37,
    });
    const before = await Promise.all(
      ["roles", "categorias", "usuarios", "negocios", "productos"].map(
        async (t) => (await pool.query(`SELECT * FROM ${t} ORDER BY id`))[0],
      ),
    );
    await assert.rejects(r.ready(), /migraciones/);
    await migrate(pool);
    await r.ready();
    await migrate(pool);
    const after = await Promise.all(
      ["roles", "categorias", "usuarios", "negocios", "productos"].map(
        async (t) => (await pool.query(`SELECT * FROM ${t} ORDER BY id`))[0],
      ),
    );
    assert.deepEqual(after, before);
    const [colsAfter] = await pool.query(
      "SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('roles','categorias','usuarios','negocios','productos') ORDER BY TABLE_NAME,ORDINAL_POSITION",
    );
    assert.deepEqual(colsAfter, cols);
    assert.equal((await r.producto.find(p.id)).visitas, 37);
    const [versions] = await pool.query(
      "SELECT * FROM schema_migrations ORDER BY version",
    );
    assert.equal(versions.length, 3);
    for (const v of versions) {
      assert.equal(v.applied, 1);
      assert.equal(
        v.checksum,
        createHash("sha256")
          .update(
            await fs.readFile(
              path.join(__dirname, "../backend/db/migrations", v.version),
            ),
          )
          .digest("hex"),
      );
    }
    const [tables] = await pool.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()",
    );
    assert.deepEqual(
      tables.map((t) => t.TABLE_NAME).sort(),
      [...tablas].sort(),
    );
  }
});
for (const capacidad of [1, 3])
  test(`MySQL real: ${capacidad} cupos, dos pools y solicitudes simultáneas sin overbooking`, async () => {
    await ctx(r).s.actualizar(merchant, service.id, {
      capacidadSimultanea: capacidad,
    });
    const promises = Array.from({ length: capacidad + 1 }, (_, i) =>
      ctx(i % 2 ? r : otro).r.crear(buyer, {
        servicioId: service.id,
        fechaHoraInicio: inicio,
      }),
    );
    const results = await Promise.allSettled(promises);
    assert.equal(
      results.filter((x) => x.status === "fulfilled").length,
      capacidad,
    );
    const errors = results.filter((x) => x.status === "rejected");
    assert.equal(errors.length, 1);
    assert.equal(errors[0].reason.status, 409);
    const [rows] = await pool.execute(
      "SELECT * FROM reservas WHERE servicioId=? AND estado='Confirmada'",
      [service.id],
    );
    assert.equal(rows.length, capacidad);
    assert.ok(rows.every((x) => x.fechaHoraInicio.toISOString() === inicio));
    const d = await ctx(otro).r.disponibilidad(null, service.id, fecha);
    assert.equal(d.slots[0].cuposDisponibles, 0);
  });
test("003 SQL: PK/FK/CHECK/UNIQUE, restricciones de historial y cascadas dependientes", async () => {
  const fallo = (sql) => assert.rejects(pool.query(sql));
  const id = service.id;
  for (const set of [
    "duracionMinutos=0",
    "duracionMinutos=1441",
    "capacidadSimultanea=0",
    "capacidadSimultanea=101",
    "nombre=''",
    "descripcion=''",
    "precioReferencia=-1",
    "estado='Otro'",
    "negocioId=4294967295",
    "categoriaId=4294967295",
  ])
    await fallo(`UPDATE servicios SET ${set} WHERE id=${id}`);
  for (const set of [
    "diaSemana=0",
    "diaSemana=8",
    "horaInicio='13:00:00'",
    "horaInicio='-01:00:00'",
    "horaFin='25:00:00'",
    "horaInicio='09:00:01'",
    "servicioId=4294967295",
  ])
    await fallo(`UPDATE horarios_servicio SET ${set} WHERE servicioId=${id}`);
  const booking = await ctx(r).r.crear(buyer, {
    servicioId: id,
    fechaHoraInicio: inicio,
  });
  await fallo(`UPDATE reservas SET estado='Pendiente' WHERE id=${booking.id}`);
  await fallo(
    `UPDATE reservas SET usuarioId=4294967295 WHERE id=${booking.id}`,
  );
  await fallo(`DELETE FROM servicios WHERE id=${id}`);
  await fallo(`DELETE FROM usuarios WHERE id=${buyer.id}`);
  const p = await r.producto.create({
    negocioId: service.negocioId,
    categoria: "Alimentos",
    nombre: "Producto",
    descripcion: "Local",
    precio: 1,
    stock: 1,
    imagen: "fixture",
    estado: "Activo",
  });
  const f = await ctx(r).f.crear(buyer, { productoId: p.id });
  await fallo(
    `INSERT INTO favoritos (usuarioId,productoId) VALUES (${buyer.id},${p.id})`,
  );
  await fallo(
    `INSERT INTO favoritos (usuarioId,productoId) VALUES (${buyer.id},4294967295)`,
  );
  await r.producto.delete(p.id);
  assert.equal(await r.favorito.find(f.id), null);
  const [columns] = await pool.query("SHOW COLUMNS FROM reservas");
  assert.ok(!columns.some((c) => /fin/i.test(c.Field)));
});
test("MySQL real: horarios transaccionales, rollback y conflictos de duración/capacidad", async () => {
  const results = await Promise.allSettled([
    ctx(r).h.crear(merchant, service.id, {
      diaSemana: 2,
      horaInicio: "09:00",
      horaFin: "11:00",
    }),
    ctx(otro).h.crear(merchant, service.id, {
      diaSemana: 2,
      horaInicio: "10:00",
      horaFin: "12:00",
    }),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(results.find((x) => x.status === "rejected").reason.status, 409);
  const b = await ctx(r).r.crear(buyer, {
    servicioId: service.id,
    fechaHoraInicio: inicio,
  });
  await assert.rejects(
    ctx(otro).s.actualizar(merchant, service.id, { duracionMinutos: 30 }),
    (e) => e.status === 409,
  );
  assert.equal((await r.servicio.find(service.id)).duracionMinutos, 60);
  await ctx(otro).r.cancelar(buyer, b.id);
  assert.equal((await r.reserva.find(b.id)).estado, "Cancelada");
  assert.equal(
    (await ctx(r).r.disponibilidad(null, service.id, fecha)).slots[0]
      .cuposDisponibles,
    1,
  );
  await assert.rejects(
    r.transaccion(async () => {
      await r.reserva.update(b.id, { estado: "Confirmada" });
      throw new Error("rollback-pr6");
    }),
    /rollback-pr6/,
  );
  assert.equal((await r.reserva.find(b.id)).estado, "Cancelada");
});
