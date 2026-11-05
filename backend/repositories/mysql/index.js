const { AsyncLocalStorage } = require("node:async_hooks");
const { prepararConexion } = require("../../db/pool");
const { AppError } = require("../../utils/errors");

// Identificadores SQL cerrados; ningún nombre de tabla/columna procede del cliente.
const modelos = {
  usuario: {
    tabla: "usuarios",
    campos: [
      "nombre",
      "apellido",
      "correo",
      "telefono",
      "passwordHash",
      "rol",
      "estado",
    ],
  },
  negocio: {
    tabla: "negocios",
    campos: [
      "usuarioId",
      "nombre",
      "categoria",
      "telefono",
      "direccion",
      "estado",
    ],
  },
  producto: {
    tabla: "productos",
    campos: [
      "negocioId",
      "nombre",
      "descripcion",
      "categoria",
      "precio",
      "stock",
      "imagen",
      "estado",
      "popularidad",
    ],
  },
};

function errorSeguro(error) {
  const mensajes = {
    ER_DUP_ENTRY: "El correo o el comerciante ya está registrado.",
    ER_NO_REFERENCED_ROW_2:
      "La relación requiere un recurso existente y un propietario comerciante.",
    ER_ROW_IS_REFERENCED_2:
      "Resuelve los recursos relacionados antes de eliminar o cambiar el rol.",
    ER_CHECK_CONSTRAINT_VIOLATED:
      "Los datos no cumplen las restricciones de integridad.",
  };
  return mensajes[error.code] ? new AppError(400, mensajes[error.code]) : error;
}

function dto(fila) {
  if (!fila) return null;
  const resultado = { ...fila };
  for (const campo of ["createdAt", "updatedAt"])
    if (resultado[campo] instanceof Date)
      resultado[campo] = resultado[campo].toISOString();
  if (Object.hasOwn(resultado, "precio"))
    resultado.precio = Number(resultado.precio);
  return resultado;
}

function createMysqlRepositories(pool) {
  const contexto = new AsyncLocalStorage();

  async function ejecutar(sql, parametros = []) {
    const actual = contexto.getStore();
    if (actual && !actual.activa) throw new Error("La transacción ya terminó.");
    let connection;
    try {
      connection = actual?.connection || (await pool.getConnection());
      if (!actual) await prepararConexion(connection);
      const [resultado] = await connection.execute(sql, parametros);
      return resultado;
    } catch (error) {
      throw errorSeguro(error);
    } finally {
      if (!actual) connection?.release();
    }
  }

  async function transaccion(callback) {
    if (contexto.getStore())
      throw new Error("No se permiten transacciones anidadas.");
    const connection = await pool.getConnection();
    const estado = { connection, activa: true };
    let iniciada = false;
    let descartar = false;
    try {
      await prepararConexion(connection);
      await connection.beginTransaction();
      iniciada = true;
      // Equivale a la cola memory, entre procesos: preserva reglas list/check/write
      // como último administrador y read-modify-write de popularidad sin tocar services.
      const [lock] = await connection.execute(
        "SELECT id FROM repository_lock WHERE id = 1 FOR UPDATE",
      );
      if (lock.length !== 1)
        throw new Error("Falta la migración de bloqueo de repositorios.");
      const resultado = await contexto.run(estado, callback);
      await connection.commit();
      return resultado;
    } catch (error) {
      if (iniciada) {
        try {
          await connection.rollback();
        } catch {
          descartar = true;
        }
      } else {
        descartar = true;
      }
      throw errorSeguro(error);
    } finally {
      estado.activa = false;
      if (descartar) connection.destroy();
      else connection.release();
    }
  }

  const escribir = (callback) =>
    contexto.getStore() ? callback() : transaccion(callback);
  const repos = {
    transaccion,
    close: () => pool.end(),
    async ready() {
      const filas = await ejecutar(
        "SELECT version FROM schema_migrations WHERE version = ? AND applied = TRUE",
        ["001_foundation.sql"],
      );
      if (filas.length !== 1)
        throw new Error("Ejecuta las migraciones antes de iniciar MySQL.");
    },
  };
  for (const [nombre, { tabla, campos }] of Object.entries(modelos)) {
    const columnas =
      ["id", ...campos, "createdAt", "updatedAt"]
        .map((k) => `\`${k}\``)
        .join(", ") +
      (nombre === "negocio"
        ? ", (SELECT CONCAT(u.nombre, ' ', u.apellido) FROM usuarios u WHERE u.id = negocios.usuarioId) AS propietario"
        : "");
    const idValido = (id) => Number.isSafeInteger(Number(id)) && Number(id) > 0;
    const entradas = (datos) =>
      campos.filter((k) => Object.hasOwn(datos, k) && datos[k] !== undefined);
    const repo = {
      async list() {
        return (
          await ejecutar(`SELECT ${columnas} FROM ${tabla} ORDER BY id`)
        ).map(dto);
      },
      async find(id) {
        if (!idValido(id)) return null;
        return dto(
          (
            await ejecutar(`SELECT ${columnas} FROM ${tabla} WHERE id = ?`, [
              Number(id),
            ])
          )[0],
        );
      },
      create(datos) {
        return escribir(async () => {
          const keys = entradas(datos);
          const columnasInsert = keys.map((k) => `\`${k}\``).join(", ");
          const placeholders = keys.map(() => "?").join(", ");
          const resultado = await ejecutar(
            `INSERT INTO ${tabla} (${columnasInsert}) VALUES (${placeholders})`,
            keys.map((k) => datos[k]),
          );
          return repo.find(resultado.insertId);
        });
      },
      update(id, datos) {
        if (!idValido(id)) return Promise.resolve(null);
        return escribir(async () => {
          if (!(await repo.find(id))) return null;
          const keys = entradas(datos);
          const cambios = keys.map((k) => `\`${k}\` = ?`);
          cambios.push("updatedAt = UTC_TIMESTAMP(3)");
          await ejecutar(
            `UPDATE ${tabla} SET ${cambios.join(", ")} WHERE id = ?`,
            [...keys.map((k) => datos[k]), Number(id)],
          );
          return repo.find(id);
        });
      },
      delete(id) {
        if (!idValido(id)) return Promise.resolve(false);
        return escribir(
          async () =>
            (await ejecutar(`DELETE FROM ${tabla} WHERE id = ?`, [Number(id)]))
              .affectedRows > 0,
        );
      },
    };
    repos[nombre] = repo;
  }
  return repos;
}
module.exports = { createMysqlRepositories };
