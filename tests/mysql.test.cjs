const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  createMysqlRepositories,
} = require("../backend/repositories/mysql");

const { configuracion } = require("../backend/config");

const {
  validarRepositories,
} = require("../backend/repositories/contract");

// ============================================================
// POOL MYSQL SIMULADO
//
// Este archivo NO utiliza una base de datos real.
//
// Simula una conexión mysql2 para comprobar:
// - SQL parametrizado.
// - Mapeo de DTO.
// - Transacciones.
// - ROLLBACK.
// - Liberación de conexiones.
// - Errores seguros.
// ============================================================

function fixture(fallo = {}) {
  const eventos = [];
  let siguiente = 0;

  const pool = {
    async getConnection() {
      const id = ++siguiente;

      return {
        async query(sql) {
          eventos.push([id, sql]);
          return [[]];
        },

        async execute(sql, params) {
          eventos.push([id, sql, params]);

          if (fallo.execute) {
            throw fallo.execute;
          }

          // El Repository puede generar SQL con espacios,
          // indentación y saltos de línea iniciales.
          const sentencia = sql
            .replace(/\s+/g, " ")
            .trim();

          // SELECT ... FOR UPDATE de repository_lock.
          if (
            /\bFROM repository_lock\b/i.test(sentencia)
          ) {
            return [[{ id: 1 }]];
          }

          // INSERT devuelve un objeto de resultado,
          // no una colección de filas.
          if (/^INSERT INTO\b/i.test(sentencia)) {
            return [{ insertId: 7, affectedRows: 1 }];
          }

          if (/^UPDATE\b/i.test(sentencia)) {
            return [{ affectedRows: 1 }];
          }

          if (/^DELETE FROM\b/i.test(sentencia)) {
            return [{ affectedRows: 0 }];
          }

          // Producto no tiene createdAt ni updatedAt
          // en el esquema SQL actual.
          if (/\bFROM producto\b/i.test(sentencia)) {
            return [[{
              id: 7,
              precio: "10.25",
              stock: 2,
              visitas: 0,
            }]];
          }

          // Usuario sí tiene fecha_registro,
          // proyectada por el Repository como createdAt.
          return [[{
            id: 7,
            nombre: "Ana",
            correo: "ana@example.invalid",
            createdAt: new Date(
              "2026-01-01T00:00:00.000Z",
            ),
          }]];
        },

        async beginTransaction() {
          eventos.push([id, "BEGIN"]);
        },

        async commit() {
          eventos.push([id, "COMMIT"]);

          if (fallo.commit) {
            throw fallo.commit;
          }
        },

        async rollback() {
          eventos.push([id, "ROLLBACK"]);

          if (fallo.rollback) {
            throw fallo.rollback;
          }
        },

        release() {
          eventos.push([id, "RELEASE"]);
        },

        destroy() {
          eventos.push([id, "DESTROY"]);
        },
      };
    },

    async end() {},
  };

  return {
    repos: createMysqlRepositories(pool),
    eventos,
  };
}

// ============================================================
// TEST 1: CONFIGURACIÓN
//
// DB_PASSWORD puede estar vacío para desarrollo local.
//
// Host, nombre de base y usuario siguen siendo obligatorios.
// ============================================================

test(
  "config: memory por defecto, mysql explícito y configuración válida",
  () => {
    assert.equal(
      configuracion({}).dataSource,
      "memory",
    );

    assert.throws(
      () => configuracion({ DATA_SOURCE: "otra" }),
      /DATA_SOURCE/,
    );

    assert.throws(
      () => configuracion({ DATA_SOURCE: "mysql" }),
      /DB_/,
    );

    const env = {
      DATA_SOURCE: "mysql",
      DB_HOST: "localhost",
      DB_NAME: "reactiva_test",
      DB_USER: "app",
      DB_PASSWORD: "solo-fixture",
    };

    const config = configuracion(env);

    assert.equal(config.db.port, 3306);
    assert.equal(config.db.database, "reactiva_test");
    assert.equal(config.db.password, "solo-fixture");

    // Puerto inválido.
    assert.throws(
      () => configuracion({
        ...env,
        DB_PORT: "0",
      }),
      /DB_PORT/,
    );

    // Campos obligatorios.
    for (const campo of [
      "DB_HOST",
      "DB_NAME",
      "DB_USER",
    ]) {
      const invalido = { ...env };
      delete invalido[campo];

      assert.throws(
        () => configuracion(invalido),
        new RegExp(campo),
      );
    }

    // XAMPP local puede utilizar contraseña vacía.
    assert.equal(
      configuracion({
        ...env,
        DB_PASSWORD: "",
      }).db.password,
      "",
    );

    // La contraseña omitida también se normaliza
    // a una cadena vacía en la configuración actual.
    const sinPassword = { ...env };
    delete sinPassword.DB_PASSWORD;

    assert.equal(
      configuracion(sinPassword).db.password,
      "",
    );
  },
);

// ============================================================
// TEST 2: CONTRATO, SQL PARAMETRIZADO Y DTO
// ============================================================

test(
  "mysql: contrato, placeholders, DTOs y campos protegidos",
  async () => {
    const { repos, eventos } = fixture();

    validarRepositories(repos);

    const correo =
      "x' OR 1=1 --@example.invalid";

    const usuario = await repos.usuario.create({
      nombre: "Ana",
      correo,
      id: 99,
      createdAt: "ayer",
    });

    // El SQL real comienza con saltos de línea.
    // Por eso usamos una expresión que acepta espacios.
    const insert = eventos.find(
      ([, sql]) => /^\s*INSERT\s+INTO\b/i.test(sql),
    );

    assert.ok(insert, "Debe existir un INSERT");

    // El correo nunca se concatena dentro del SQL.
    assert.equal(
      insert[1].includes(correo),
      false,
    );

    // Los datos se transmiten como parámetros.
    assert.deepEqual(
      insert[2],
      ["Ana", correo],
    );

    // El Repository ignora propiedades no escribibles.
    assert.equal(
      insert[1].includes("createdAt"),
      false,
    );

    assert.equal(
      insert[1].includes("`id`"),
      false,
    );

    assert.equal(usuario.id, 7);

    assert.equal(
      usuario.createdAt,
      "2026-01-01T00:00:00.000Z",
    );

    // No existe updatedAt universal.
    assert.equal(
      Object.hasOwn(usuario, "updatedAt"),
      false,
    );

    const producto = await repos.producto.find(7);

    // DECIMAL se convierte a Number.
    assert.equal(producto.precio, 10.25);

    // Alias de compatibilidad.
    assert.equal(producto.visitas, 0);
    assert.equal(producto.popularidad, 0);

    // Producto no tiene timestamps físicos.
    assert.equal(
      Object.hasOwn(producto, "createdAt"),
      false,
    );

    assert.equal(
      Object.hasOwn(producto, "updatedAt"),
      false,
    );

    // ID inválido no debe enviarse a SQL.
    assert.equal(
      await repos.producto.find("7 OR 1=1"),
      null,
    );

    // DELETE con affectedRows = 0.
    assert.equal(
      await repos.producto.delete(7),
      false,
    );

    assert.deepEqual(
      (await repos.usuario.list()).map(
        (item) => item.id,
      ),
      [7],
    );
  },
);

// ============================================================
// TEST 3: UNA MISMA CONEXIÓN EN TRANSACCIÓN
// ============================================================

test(
  "mysql: callback usa una conexión, BEGIN, lock, COMMIT y release",
  async () => {
    const { repos, eventos } = fixture();

    const resultado = await repos.transaccion(
      async () => {
        await repos.usuario.list();
        await repos.negocio.find(7);

        await repos.producto.update(7, {
          stock: 2,
        });

        return 42;
      },
    );

    assert.equal(resultado, 42);

    // Toda la transacción comparte una conexión.
    assert.deepEqual(
      [...new Set(eventos.map(([id]) => id))],
      [1],
    );

    assert.ok(
      eventos.some(([, sql]) =>
        sql.includes("FOR UPDATE"),
      ),
    );

    assert.deepEqual(
      eventos
        .filter(([, sql]) =>
          [
            "BEGIN",
            "COMMIT",
            "ROLLBACK",
            "RELEASE",
          ].includes(sql),
        )
        .map(([, sql]) => sql),
      ["BEGIN", "COMMIT", "RELEASE"],
    );
  },
);

// ============================================================
// TEST 4: ERROR EN CALLBACK O COMMIT
// ============================================================

test(
  "mysql: error en callback o commit produce rollback",
  async () => {
    for (const falloCommit of [false, true]) {
      const error = new Error("fallo de prueba");

      const { repos, eventos } = fixture(
        falloCommit ? { commit: error } : {},
      );

      await assert.rejects(
        repos.transaccion(async () => {
          if (!falloCommit) {
            throw error;
          }
        }),
        (recibido) => recibido === error,
      );

      assert.deepEqual(
        eventos.slice(-2).map(([, sql]) => sql),
        ["ROLLBACK", "RELEASE"],
      );
    }
  },
);

// ============================================================
// TEST 5: ROLLBACK FALLIDO
// ============================================================

test(
  "mysql: rollback fallido descarta la conexión",
  async () => {
    const { repos, eventos } = fixture({
      rollback: new Error("conexión caída"),
    });

    const error = new Error("operación fallida");

    await assert.rejects(
      repos.transaccion(async () => {
        throw error;
      }),
      (recibido) => recibido === error,
    );

    // Una conexión cuyo rollback falló no debe
    // volver al pool para ser reutilizada.
    assert.equal(
      eventos.at(-1)[1],
      "DESTROY",
    );
  },
);

// ============================================================
// TEST 6: AISLAMIENTO Y TRANSACCIONES ANIDADAS
// ============================================================

test(
  "mysql: callbacks concurrentes y rechazo de transacciones anidadas",
  async () => {
    const { repos, eventos } = fixture();

    await Promise.all([
      repos.transaccion(() =>
        repos.usuario.list(),
      ),

      repos.transaccion(() =>
        repos.producto.list(),
      ),
    ]);

    assert.equal(
      eventos.filter(([, sql]) => sql === "BEGIN").length,
      2,
    );

    assert.equal(
      eventos.filter(([, sql]) => sql === "COMMIT").length,
      2,
    );

    await assert.rejects(
      repos.transaccion(() =>
        repos.transaccion(async () => {}),
      ),
      /anidadas/,
    );
  },
);

// ============================================================
// TEST 7: ERRORES SQL SEGUROS
// ============================================================

test(
  "mysql: errores de integridad no filtran SQL interno",
  async () => {
    const codigos = [
      "ER_DUP_ENTRY",
      "ER_NO_REFERENCED_ROW_2",
      "ER_ROW_IS_REFERENCED_2",
      "ER_CHECK_CONSTRAINT_VIOLATED",
    ];

    for (const code of codigos) {
      const { repos } = fixture({
        execute: Object.assign(
          new Error("SQL secreto"),
          { code },
        ),
      });

      await assert.rejects(
        repos.usuario.list(),
        (error) =>
          error.status === 400 &&
          !error.message.includes("SQL secreto"),
      );
    }
  },
);
