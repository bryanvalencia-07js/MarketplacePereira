const { readFile, readdir } = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { createPool, prepararConexion } = require("./pool");

async function migrate(pool) {
  const connection = await pool.getConnection();
  let lock = false;
  let descartar = false;
  try {
    await prepararConexion(connection);
    const [[{ version }]] = await connection.query(
      "SELECT VERSION() AS version",
    );
    const [major, minor, patch] = version.split(".").map(Number);
    if (
      /mariadb/i.test(version) ||
      major < 8 ||
      (major === 8 && minor === 0 && patch < 16)
    )
      throw new Error("Se requiere MySQL >= 8.0.16 para CHECK efectivos.");
    const [[resultado]] = await connection.execute(
      "SELECT GET_LOCK('reactiva_schema_migrations', 30) AS acquired",
    );
    if (resultado.acquired !== 1)
      throw new Error("No se pudo bloquear la migración.");
    lock = true;
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(100) PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied BOOLEAN NOT NULL DEFAULT FALSE,
      appliedAt DATETIME(3) NULL
    ) ENGINE=InnoDB`);
    const carpeta = path.join(__dirname, "migrations");
    const archivos = (await readdir(carpeta))
      .filter((x) => /^\d+_[\w-]+\.sql$/.test(x))
      .sort();
    for (const archivo of archivos) {
      const sql = await readFile(path.join(carpeta, archivo), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const [previos] = await connection.execute(
        "SELECT checksum, applied FROM schema_migrations WHERE version = ?",
        [archivo],
      );
      if (previos.length) {
        if (!previos[0].applied || previos[0].checksum !== checksum)
          throw new Error(
            `Migración ${archivo} incompleta o alterada; requiere revisión manual.`,
          );
        continue;
      }
      // DDL MySQL hace commit implícito: registrar el intento permite detectar fallos parciales.
      await connection.execute(
        "INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)",
        [archivo, checksum],
      );
      for (const sentencia of sql
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean))
        await connection.query(sentencia);
      await connection.execute(
        "UPDATE schema_migrations SET applied = TRUE, appliedAt = UTC_TIMESTAMP(3) WHERE version = ?",
        [archivo],
      );
    }
  } finally {
    if (lock) {
      try {
        await connection.execute(
          "SELECT RELEASE_LOCK('reactiva_schema_migrations')",
        );
      } catch {
        descartar = true;
      }
    }
    if (descartar) connection.destroy();
    else connection.release();
  }
}

if (require.main === module) {
  (async () => {
    const { configuracion } = require("../config");
    const config = configuracion();
    if (config.dataSource !== "mysql")
      throw new Error("Configura DATA_SOURCE=mysql antes de migrar.");
    const pool = createPool(config.db);
    try {
      await migrate(pool);
      console.log("Migraciones MySQL aplicadas.");
    } finally {
      await pool.end();
    }
  })().catch((error) => {
    console.error("No se pudo migrar:", error.code || error.message);
    process.exitCode = 1;
  });
}
module.exports = { migrate };
