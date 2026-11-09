const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { createHash } = require("node:crypto");
const path = require("node:path");
const { configuracion } = require("../backend/config");
const { createPool, prepararConexion } = require("../backend/db/pool");
const { migrate } = require("../backend/db/migrate");
const { createMysqlRepositories } = require("../backend/repositories/mysql");
const config = configuracion();
if (config.dataSource !== "mysql" || !config.db.database.endsWith("_test"))
  throw new Error("Requiere base dedicada _test.");
let pool, original;
const archivo = (nombre) =>
  path.join(__dirname, "../backend/db/migrations", nombre);
const sql001 = () => readFile(archivo("001_foundation.sql"), "utf8");
async function preparar001() {
  const c = await pool.getConnection();
  try {
    await prepararConexion(c);
    for (const tabla of [
      "detalles_pedido",
      "pedidos",
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
    ])
      await c.query(`DROP TABLE IF EXISTS ${tabla}`);
    const sql = await sql001();
    for (const sentencia of sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await c.query(sentencia);
    await c.query(
      "CREATE TABLE schema_migrations (version VARCHAR(100) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied BOOLEAN NOT NULL DEFAULT FALSE, appliedAt DATETIME(3) NULL) ENGINE=InnoDB",
    );
    await c.execute(
      "INSERT INTO schema_migrations VALUES (?, ?, TRUE, UTC_TIMESTAMP(3))",
      ["001_foundation.sql", createHash("sha256").update(sql).digest("hex")],
    );
    await c.execute(
      "INSERT INTO usuarios (id,nombre,apellido,correo,passwordHash,rol,estado) VALUES (71,'Ana','Test','ana@example.invalid','scrypt-hash-intacto','Comerciante','Activo'),(72,'Luis','Test','luis@example.invalid','otro-hash','Comprador','Inactivo'),(73,'Admin','Test','admin@example.invalid','admin-hash','Administrador','Activo')",
    );
    await c.execute(
      "INSERT INTO negocios (id,usuarioId,nombre,categoria,telefono,direccion,estado) VALUES (81,71,'Local','  ALIMENTOS  ','3001234567','Calle 1','Inactivo')",
    );
    await c.execute(
      "INSERT INTO productos (id,negocioId,nombre,descripcion,categoria,precio,stock,imagen,estado,popularidad) VALUES (91,81,'Café','Texto original','Diseño   local',12.25,4,'data:image/png;base64,original','Activo',37),(92,81,'Otro','Texto 2','diseño local',99.99,0,'imagen intacta','Inactivo',0)",
    );
    const [usuarios] = await c.query("SELECT * FROM usuarios ORDER BY id");
    const [negocios] = await c.query("SELECT * FROM negocios ORDER BY id");
    const [productos] = await c.query("SELECT * FROM productos ORDER BY id");
    original = { usuarios, negocios, productos };
  } finally {
    c.release();
  }
}
before(async () => {
  pool = createPool(config.db);
  await preparar001();
});
after(async () => pool?.end());
test("002 sobre 001 con datos: preserva todos los atributos, relaciones y visitas 1:1", async () => {
  await assert.rejects(createMysqlRepositories(pool).ready(), /migraciones/);
  await migrate(pool);
  const r = createMysqlRepositories(pool);
  const [usuarios] = await pool.query(
    "SELECT u.*,r.nombre AS rol FROM usuarios u JOIN roles r ON r.id=u.rolId ORDER BY u.id",
  );
  for (let i = 0; i < usuarios.length; i++) {
    const { rolId, ...u } = usuarios[i];
    assert.deepEqual(u, original.usuarios[i]);
    assert.ok(rolId > 0);
  }
  const [negocios] = await pool.query("SELECT * FROM negocios ORDER BY id");
  assert.equal(negocios.length, original.negocios.length);
  for (let i = 0; i < negocios.length; i++) {
    const { categoriaId, descripcion, municipio, ...n } = negocios[i];
    const { categoria, usuarioRol, ...viejo } = original.negocios[i];
    assert.deepEqual(n, viejo);
    assert.equal(descripcion, null);
    assert.equal(municipio, null);
    assert.ok(categoriaId > 0);
  }
  const [productos] = await pool.query("SELECT * FROM productos ORDER BY id");
  assert.equal(productos.length, original.productos.length);
  for (let i = 0; i < productos.length; i++) {
    const { categoriaId, visitas, ...p } = productos[i];
    const { categoria, popularidad, ...viejo } = original.productos[i];
    assert.deepEqual(p, viejo);
    assert.equal(visitas, popularidad);
    assert.ok(categoriaId > 0);
  }
  assert.equal((await r.negocio.find(81)).categoria, "Alimentos");
  assert.equal(
    (await r.producto.find(91)).categoriaId,
    (await r.producto.find(92)).categoriaId,
  );
  assert.equal((await r.producto.find(91)).visitas, 37);
  const [categorias] = await pool.query(
    "SELECT * FROM categorias WHERE nombre = 'Todas'",
  );
  assert.equal(categorias.length, 0);
  await migrate(pool);
  const [versiones] = await pool.query(
    "SELECT * FROM schema_migrations ORDER BY version",
  );
  assert.equal(versiones.length, 4);
  assert.ok(
    versiones.some((v) => v.version === "002_normalize_roles_categories.sql"),
  );
  for (const v of versiones) {
    assert.equal(v.applied, 1);
    assert.equal(
      v.checksum,
      createHash("sha256")
        .update(await readFile(archivo(v.version)))
        .digest("hex"),
    );
  }
});
test("002 integridad SQL: UNIQUE, FK, CHECK, InnoDB y utf8mb4", async () => {
  const fallo = (sql) => assert.rejects(pool.query(sql));
  await fallo("INSERT INTO roles (nombre) VALUES ('Comerciante')");
  await fallo("INSERT INTO categorias (nombre) VALUES (' alimentos ')");
  await fallo("INSERT INTO categorias (nombre) VALUES ('ALIMENTOS')");
  await fallo("INSERT INTO categorias (nombre) VALUES ('Todas')");
  await fallo("INSERT INTO categorias (nombre,estado) VALUES ('Nueva','Otro')");
  await fallo("UPDATE usuarios SET rolId=4294967295 WHERE id=71");
  await fallo("UPDATE negocios SET categoriaId=4294967295 WHERE id=81");
  await fallo("UPDATE productos SET categoriaId=4294967295 WHERE id=91");
  await fallo("UPDATE productos SET stock=-1 WHERE id=91");
  await fallo("UPDATE productos SET precio=0 WHERE id=91");
  await fallo("UPDATE productos SET visitas=-1 WHERE id=91");
  await fallo("UPDATE productos SET estado='Otro' WHERE id=91");
  await fallo("UPDATE usuarios SET correo='luis@example.invalid' WHERE id=71");
  await fallo(
    "DELETE FROM categorias WHERE id=(SELECT categoriaId FROM productos WHERE id=91)",
  );
  const [tablas] = await pool.query(
    "SELECT ENGINE,TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('roles','usuarios','categorias','negocios','productos')",
  );
  assert.equal(tablas.length, 5);
  assert.ok(
    tablas.every(
      (t) => t.ENGINE === "InnoDB" && t.TABLE_COLLATION.startsWith("utf8mb4"),
    ),
  );
});
test("MySQL normalizado: referencias activas, JOIN, datos nuevos y checksum 002", async () => {
  const r = createMysqlRepositories(pool);
  await pool.query(
    "INSERT INTO categorias (nombre,estado) VALUES ('Archivada','Inactivo')",
  );
  const [[inactiva]] = await pool.query(
    "SELECT id FROM categorias WHERE nombre='Archivada'",
  );
  for (const categoria of ["Archivada", "Inexistente", "Todas"]) {
    await assert.rejects(
      r.producto.update(91, { categoria }),
      (e) => e.status === 400,
    );
    await assert.rejects(
      r.negocio.update(81, { categoria }),
      (e) => e.status === 400,
    );
  }
  await assert.rejects(
    r.producto.update(91, { categoriaId: inactiva.id }),
    (e) => e.status === 400,
  );
  const n = await r.negocio.update(81, {
    municipio: "La Virginia",
    descripcion: "Información completada",
    categoria: " alimentos ",
  });
  assert.equal(n.categoria, "Alimentos");
  assert.equal(n.municipio, "La Virginia");
  const { createApplication } = require("../backend/app");
  const sistema = await createApplication({ repositories: r });
  const server = sistema.app.listen(0, "127.0.0.1");
  await new Promise((ok) => server.once("listening", ok));
  try {
    const res = await fetch(
      `http://127.0.0.1:${server.address().port}/api/categorias`,
    );
    assert.equal(res.status, 200);
    const { data } = await res.json();
    assert.ok(data.length >= 24);
    assert.ok(data.every((c) => c.estado === "Activo" && c.id !== inactiva.id));
  } finally {
    await new Promise((ok) => server.close(ok));
  }
  const version = "002_normalize_roles_categories.sql";
  const checksum = createHash("sha256")
    .update(await readFile(archivo(version)))
    .digest("hex");
  await pool.execute(
    "UPDATE schema_migrations SET checksum=REPEAT('0',64) WHERE version=?",
    [version],
  );
  try {
    await assert.rejects(migrate(pool), /alterada/);
  } finally {
    await pool.execute(
      "UPDATE schema_migrations SET checksum=? WHERE version=?",
      [checksum, version],
    );
  }
});

test("002 rechaza Todas histórica antes de retirar datos y registra intento incompleto", async () => {
  await preparar001();
  await pool.query("UPDATE productos SET categoria='Todas' WHERE id=91");
  await assert.rejects(migrate(pool));
  const [filas] = await pool.query(
    "SELECT popularidad,categoria FROM productos WHERE id=91",
  );
  assert.deepEqual(filas, [{ popularidad: 37, categoria: "Todas" }]);
  const [v] = await pool.query(
    "SELECT applied FROM schema_migrations WHERE version='002_normalize_roles_categories.sql'",
  );
  assert.equal(v[0].applied, 0);
  await assert.rejects(migrate(pool), /incompleta/);
  // Reponer SOLO esta base efímera para que una ejecución posterior sea repetible.
  await preparar001();
  await migrate(pool);
});
