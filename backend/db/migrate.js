const { readFile, readdir } = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");

const {
  createPool,
  prepararConexion,
} = require("./pool");


/*
 * Ejecuta todas las migraciones SQL pendientes.
 *
 * Las migraciones se encuentran en:
 *
 * backend/db/migrations/
 *
 * y se ejecutan en orden:
 *
 * 001
 * 002
 * 003
 * 004
 */
async function migrate(pool) {
  const connection = await pool.getConnection();

  let lockObtenido = false;

  try {
    await prepararConexion(connection);


    // ===============================================================
    // INFORMACIÓN DEL SERVIDOR
    //
    // Sirve únicamente para saber si estamos conectados a
    // MySQL o MariaDB.
    //
    // Ya NO rechazamos MariaDB porque XAMPP puede utilizarlo.
    // ===============================================================

    const [[servidor]] = await connection.query(
      "SELECT VERSION() AS version",
    );

    console.log(
      `Servidor de base de datos: ${servidor.version}`,
    );


    // ===============================================================
    // BLOQUEO DE MIGRACIONES
    //
    // Evita que dos procesos intenten modificar el esquema
    // simultáneamente.
    // ===============================================================

    const [[lock]] = await connection.query(
      `
      SELECT GET_LOCK(
        'reactiva_schema_migrations',
        30
      ) AS acquired
      `,
    );


    if (Number(lock.acquired) !== 1) {
      throw new Error(
        "No se pudo obtener el bloqueo de migraciones.",
      );
    }

    lockObtenido = true;


    // ===============================================================
    // TABLA TÉCNICA DE MIGRACIONES
    //
    // NO pertenece al DER.
    //
    // Guarda cuáles archivos SQL ya fueron ejecutados.
    // ===============================================================

    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(100) PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied BOOLEAN NOT NULL DEFAULT FALSE,
        applied_at DATETIME NULL
      )
    `);


    // ===============================================================
    // BUSCAR ARCHIVOS DE MIGRACIÓN
    // ===============================================================

    const carpeta =
      path.join(
        __dirname,
        "migrations",
      );


    const archivos =
      (await readdir(carpeta))
        .filter(
          (archivo) =>
            /^\d+_[\w-]+\.sql$/.test(archivo),
        )
        .sort();


    if (archivos.length === 0) {
      throw new Error(
        "No se encontraron archivos de migración.",
      );
    }


    console.log(
      `Migraciones encontradas: ${archivos.length}`,
    );


    // ===============================================================
    // EJECUTAR MIGRACIONES EN ORDEN
    // ===============================================================

    for (const archivo of archivos) {

      const ruta =
        path.join(
          carpeta,
          archivo,
        );


      const sql =
        await readFile(
          ruta,
          "utf8",
        );


      // El checksum permite detectar si alguien modificó
      // una migración después de haberla aplicado.

      const checksum =
        createHash("sha256")
          .update(sql)
          .digest("hex");


      const [existente] =
        await connection.execute(
          `
          SELECT
            version,
            checksum,
            applied
          FROM schema_migrations
          WHERE version = ?
          `,
          [archivo],
        );


      // -------------------------------------------------------------
      // LA MIGRACIÓN YA EXISTE
      // -------------------------------------------------------------

      if (existente.length > 0) {
        const anterior = existente[0];


        if (!anterior.applied) {
          throw new Error(
            `La migración ${archivo} quedó incompleta. ` +
            "Revisa o recrea la base de datos antes de continuar.",
          );
        }


        if (anterior.checksum !== checksum) {
          throw new Error(
            `La migración ${archivo} fue modificada ` +
            "después de haber sido aplicada.",
          );
        }


        console.log(
          `✓ ${archivo} ya estaba aplicada`,
        );

        continue;
      }


      // -------------------------------------------------------------
      // REGISTRAR EL INTENTO
      // -------------------------------------------------------------

      await connection.execute(
        `
        INSERT INTO schema_migrations
        (
          version,
          checksum,
          applied
        )
        VALUES (?, ?, FALSE)
        `,
        [
          archivo,
          checksum,
        ],
      );


      console.log(
        `Aplicando ${archivo}...`,
      );


      // -------------------------------------------------------------
      // DIVIDIR EL ARCHIVO EN SENTENCIAS
      //
      // Cada instrucción SQL termina en punto y coma.
      // -------------------------------------------------------------

      const sentencias =
        sql
          .split(";")
          .map(
            (sentencia) =>
              sentencia.trim(),
          )
          .filter(Boolean);


      // -------------------------------------------------------------
      // EJECUTAR SENTENCIAS
      // -------------------------------------------------------------

      for (const sentencia of sentencias) {
        await connection.query(sentencia);
      }


      // -------------------------------------------------------------
      // MARCAR COMO COMPLETADA
      // -------------------------------------------------------------

      await connection.execute(
        `
        UPDATE schema_migrations
        SET
          applied = TRUE,
          applied_at = UTC_TIMESTAMP()
        WHERE version = ?
        `,
        [archivo],
      );


      console.log(
        `✓ ${archivo} aplicada correctamente`,
      );
    }


    console.log(
      "Todas las migraciones están actualizadas.",
    );

  } finally {

    // ===============================================================
    // LIBERAR BLOQUEO
    // ===============================================================

    if (lockObtenido) {
      try {
        await connection.query(
          `
          SELECT RELEASE_LOCK(
            'reactiva_schema_migrations'
          )
          `,
        );
      } catch {
        // Si falla la liberación, la conexión se cerrará igualmente.
      }
    }


    connection.release();
  }
}


// =====================================================================
// EJECUCIÓN DIRECTA
//
// Permite ejecutar:
//
// node backend/db/migrate.js
// =====================================================================

if (require.main === module) {

  (async () => {

    const {
      configuracion,
    } = require("../config");


    const config =
      configuracion();


    if (config.dataSource !== "mysql") {
      throw new Error(
        "Configura DATA_SOURCE=mysql antes de ejecutar las migraciones.",
      );
    }


    const pool =
      createPool(config.db);


    try {
      await migrate(pool);
    } finally {
      await pool.end();
    }

  })().catch((error) => {

    console.error(
      "No se pudieron aplicar las migraciones:",
      error.code || error.message,
    );

    process.exitCode = 1;
  });
}


module.exports = {
  migrate,
};