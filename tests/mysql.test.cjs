const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createMysqlRepositories } = require("../backend/repositories/mysql");
const { configuracion } = require("../backend/config");
const { validarRepositories } = require("../backend/repositories/contract");

function fixture(fallo = {}) {
  const eventos = [];
  let siguiente = 0;
  const pool = {
    async getConnection() {
      const id = ++siguiente;
      return {
        async query(sql) {
          eventos.push([id, sql]);
        },
        async execute(sql, params) {
          eventos.push([id, sql, params]);
          if (fallo.execute) throw fallo.execute;
          if (sql.startsWith("INSERT")) return [{ insertId: 7 }];
          if (sql.startsWith("DELETE")) return [{ affectedRows: 0 }];
          return [
            [
              {
                id: 7,
                precio: "10.25",
                createdAt: new Date("2026-01-01Z"),
                updatedAt: new Date("2026-01-01Z"),
              },
            ],
          ];
        },
        async beginTransaction() {
          eventos.push([id, "BEGIN"]);
        },
        async commit() {
          eventos.push([id, "COMMIT"]);
          if (fallo.commit) throw fallo.commit;
        },
        async rollback() {
          eventos.push([id, "ROLLBACK"]);
          if (fallo.rollback) throw fallo.rollback;
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
  return { repos: createMysqlRepositories(pool), eventos };
}

test("config: memory por defecto, mysql explícito y configuración inválida rechazada", () => {
  assert.equal(configuracion({}).dataSource, "memory");
  assert.throws(() => configuracion({ DATA_SOURCE: "otra" }), /DATA_SOURCE/);
  assert.throws(() => configuracion({ DATA_SOURCE: "mysql" }), /DB_/);
  const env = {
    DATA_SOURCE: "mysql",
    DB_HOST: "localhost",
    DB_NAME: "reactiva_test",
    DB_USER: "app",
    DB_PASSWORD: "solo-fixture",
  };
  assert.equal(configuracion(env).db.port, 3306);
  assert.equal(configuracion(env).db.database, "reactiva_test");
  assert.throws(() => configuracion({ ...env, DB_PORT: "0" }), /DB_PORT/);
  assert.throws(
    () => configuracion({ ...env, DB_PASSWORD: "" }),
    /DB_PASSWORD/,
  );
});

test("mysql: contrato, placeholders, DTOs y campos de persistencia protegidos", async () => {
  const { repos, eventos } = fixture();
  validarRepositories(repos);
  const correo = "x' OR 1=1 --@example.invalid";
  const u = await repos.usuario.create({
    nombre: "Ana",
    correo,
    id: 99,
    createdAt: "ayer",
  });
  const insert = eventos.find(([, sql]) => sql.startsWith("INSERT"));
  assert.ok(!insert[1].includes(correo));
  assert.deepEqual(insert[2], ["Ana", correo]);
  assert.ok(!insert[1].includes("createdAt"));
  assert.equal(u.id, 7);
  assert.equal(u.createdAt, "2026-01-01T00:00:00.000Z");
  assert.equal((await repos.producto.find(7)).precio, 10.25);
  assert.equal(await repos.producto.find("7 OR 1=1"), null);
  assert.equal(await repos.producto.delete(7), false);
  assert.deepEqual(
    (await repos.usuario.list()).map((x) => x.id),
    [7],
  );
});

test("mysql: callback usa una conexión, BEGIN, lock, COMMIT y release", async () => {
  const { repos, eventos } = fixture();
  const resultado = await repos.transaccion(async () => {
    await repos.usuario.list();
    await repos.negocio.find(7);
    await repos.producto.update(7, { stock: 2 });
    return 42;
  });
  assert.equal(resultado, 42);
  assert.deepEqual([...new Set(eventos.map(([id]) => id))], [1]);
  assert.ok(eventos.find(([, sql]) => sql.includes("FOR UPDATE")));
  assert.deepEqual(
    eventos
      .filter(([, sql]) =>
        ["BEGIN", "COMMIT", "ROLLBACK", "RELEASE"].includes(sql),
      )
      .map(([, sql]) => sql),
    ["BEGIN", "COMMIT", "RELEASE"],
  );
});

test("mysql: error en callback o commit produce rollback y libera conexión", async () => {
  for (const falloCommit of [false, true]) {
    const error = new Error("fallo de prueba");
    const { repos, eventos } = fixture(falloCommit ? { commit: error } : {});
    await assert.rejects(
      repos.transaccion(async () => {
        if (!falloCommit) throw error;
      }),
      (e) => e === error,
    );
    assert.deepEqual(
      eventos.slice(-2).map(([, sql]) => sql),
      ["ROLLBACK", "RELEASE"],
    );
  }
});

test("mysql: rollback fallido descarta conexión sin ocultar el error original", async () => {
  const { repos, eventos } = fixture({ rollback: new Error("conexión caída") });
  const error = new Error("operación fallida");
  await assert.rejects(
    repos.transaccion(async () => {
      throw error;
    }),
    (e) => e === error,
  );
  assert.equal(eventos.at(-1)[1], "DESTROY");
});

test("mysql: aislamiento entre callbacks concurrentes y rechazo de transacción anidada", async () => {
  const { repos, eventos } = fixture();
  await Promise.all([
    repos.transaccion(() => repos.usuario.list()),
    repos.transaccion(() => repos.producto.list()),
  ]);
  assert.equal(eventos.filter(([, sql]) => sql === "BEGIN").length, 2);
  assert.equal(eventos.filter(([, sql]) => sql === "COMMIT").length, 2);
  await assert.rejects(
    repos.transaccion(() => repos.transaccion(async () => {})),
    /anidadas/,
  );
});

test("mysql: errores de integridad son seguros y mantienen status de validación", async () => {
  for (const code of [
    "ER_DUP_ENTRY",
    "ER_NO_REFERENCED_ROW_2",
    "ER_ROW_IS_REFERENCED_2",
    "ER_CHECK_CONSTRAINT_VIOLATED",
  ]) {
    const { repos } = fixture({
      execute: Object.assign(new Error("SQL secreto"), { code }),
    });
    await assert.rejects(
      repos.usuario.list(),
      (e) => e.status === 400 && !e.message.includes("SQL secreto"),
    );
  }
});
