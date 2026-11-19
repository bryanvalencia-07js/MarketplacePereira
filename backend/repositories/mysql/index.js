const { AsyncLocalStorage } = require("node:async_hooks");
const { prepararConexion } = require("../../db/pool");
const { normalizarEscritura } = require("../relations");
const { AppError } = require("../../utils/errors");


// =====================================================================
// MAPEO ENTRE BACKEND Y MYSQL
//
// Izquierda:
// nombre que utilizan Services, Controllers y Frontend.
//
// Derecha:
// nombre real de la columna dentro de MySQL.
// =====================================================================

const modelos = {
  rol: {
    tabla: "rol",
    id: "id_rol",
    referencia: true,

    campos: {
      nombre: "nombre_rol",
      descripcion: "descripcion",
    },
  },


  categoria: {
    tabla: "categoria",
    id: "id_categoria",
    referencia: true,

    campos: {
      nombre: "nombre_categoria",
      descripcion: "descripcion",
      estado: "estado",
    },
  },


  usuario: {
    tabla: "usuario",
    id: "id_usuario",

    campos: {
      nombre: "nombre",
      apellido: "apellido",
      correo: "correo",
      telefono: "telefono",
      passwordHash: "contrasena_hash",
      rolId: "id_rol",
      estado: "estado",
    },

    createdAt: "fecha_registro",

    join: `
      JOIN rol r
        ON r.id_rol = usuario.id_rol
    `,

    extras: [
      "r.nombre_rol AS rol",
    ],
  },


  negocio: {
    tabla: "negocio",
    id: "id_negocio",

    campos: {
      usuarioId: "id_usuario",
      nombre: "nombre_negocio",
      categoriaId: "id_categoria",
      telefono: "telefono_contacto",
      direccion: "direccion_comercial",
      descripcion: "descripcion",
      municipio: "municipio",
      estado: "estado",
    },

    createdAt: "fecha_registro",

    join: `
      JOIN categoria c
        ON c.id_categoria = negocio.id_categoria

      JOIN usuario u
        ON u.id_usuario = negocio.id_usuario
    `,

    extras: [
      "c.nombre_categoria AS categoria",
      "CONCAT(u.nombre, ' ', u.apellido) AS propietario",
    ],
  },


  producto: {
    tabla: "producto",
    id: "id_producto",

    campos: {
      negocioId: "id_negocio",
      nombre: "nombre_producto",
      descripcion: "descripcion",
      categoriaId: "id_categoria",
      precio: "precio",
      stock: "stock",
      imagen: "imagen",
      estado: "estado",
      visitas: "visitas",
    },

    join: `
      JOIN categoria c
        ON c.id_categoria = producto.id_categoria
    `,

    extras: [
      "c.nombre_categoria AS categoria",
    ],
  },


  servicio: {
    tabla: "servicio",
    id: "id_servicio",

    campos: {
      negocioId: "id_negocio",
      categoriaId: "id_categoria",
      nombre: "nombre_servicio",
      descripcion: "descripcion",
      precioReferencia: "precio_referencia",
      estado: "estado",
      duracionMinutos: "duracion_minutos",
      capacidadSimultanea: "capacidad_simultanea",
    },

    join: `
      JOIN categoria c
        ON c.id_categoria = servicio.id_categoria
    `,

    extras: [
      "c.nombre_categoria AS categoria",
    ],
  },


  horario: {
    tabla: "horario_servicio",
    id: "id_horario",

    campos: {
      servicioId: "id_servicio",
      diaSemana: "dia_semana",
      horaInicio: "hora_inicio",
      horaFin: "hora_fin",
    },
  },


  reserva: {
    tabla: "reserva",
    id: "id_reserva",

    campos: {
      usuarioId: "id_usuario",
      servicioId: "id_servicio",
      fechaHoraInicio: "fecha_hora_inicio",
      estado: "estado",
    },

    createdAt: "fecha_creacion",
  },


  favorito: {
    tabla: "favorito",
    id: "id_favorito",

    campos: {
      usuarioId: "id_usuario",
      productoId: "id_producto",
    },

    createdAt: "fecha_agregado",
  },


  pedido: {
    tabla: "pedido",
    id: "id_pedido",

    campos: {
      usuarioId: "id_usuario",
      negocioId: "id_negocio",
      estado: "estado",
      observaciones: "observaciones",
    },

    createdAt: "fecha_pedido",
  },


  detallePedido: {
    tabla: "detalle_pedido",
    id: "id_detalle",

    campos: {
      pedidoId: "id_pedido",
      productoId: "id_producto",
      cantidad: "cantidad",
      precioUnitario: "precio_unitario",
    },
  },
};


// =====================================================================
// ERRORES MYSQL
//
// Convierte ciertos errores técnicos de MySQL en mensajes más seguros
// para la aplicación.
// =====================================================================

function errorSeguro(error) {
  const mensajes = {
    ER_DUP_ENTRY:
      "Ya existe un registro con esos datos.",

    ER_NO_REFERENCED_ROW_2:
      "La relación requiere un recurso existente.",

    ER_ROW_IS_REFERENCED_2:
      "El registro tiene información relacionada y no puede eliminarse.",

    ER_CHECK_CONSTRAINT_VIOLATED:
      "Los datos no cumplen las restricciones de integridad.",
  };

  if (mensajes[error.code]) {
    return new AppError(400, mensajes[error.code]);
  }

  return error;
}


// =====================================================================
// DTO
//
// DTO significa Data Transfer Object.
//
// Aquí convertimos algunos valores de MySQL a valores cómodos para
// JavaScript.
// =====================================================================

function dto(fila) {
  if (!fila) return null;

  const resultado = { ...fila };


  // MySQL puede devolver DATETIME como Date de JavaScript.
  for (const campo of [
    "createdAt",
    "fechaHoraInicio",
  ]) {
    if (resultado[campo] instanceof Date) {
      resultado[campo] = resultado[campo].toISOString();
    }
  }


  // DECIMAL puede llegar como texto desde mysql2.
  if (Object.hasOwn(resultado, "precio")) {
    resultado.precio = Number(resultado.precio);
  }

  if (Object.hasOwn(resultado, "precioUnitario")) {
    resultado.precioUnitario = Number(resultado.precioUnitario);
  }

  if (Object.hasOwn(resultado, "precioReferencia")) {
    resultado.precioReferencia = Number(
      resultado.precioReferencia,
    );
  }


  // MySQL devuelve TIME como HH:mm:ss.
  // El frontend utiliza HH:mm.
  for (const campo of [
    "horaInicio",
    "horaFin",
  ]) {
    if (resultado[campo]) {
      resultado[campo] =
        String(resultado[campo]).slice(0, 5);
    }
  }


  // El proyecto utilizaba anteriormente "popularidad".
  // Actualmente la columna real es visitas.
  if (Object.hasOwn(resultado, "visitas")) {
    resultado.popularidad = resultado.visitas;
  }


  return resultado;
}


// =====================================================================
// CREATE MYSQL REPOSITORIES
// =====================================================================

function createMysqlRepositories(pool) {
  const contexto = new AsyncLocalStorage();


  // ===================================================================
  // EJECUTAR SQL
  // ===================================================================

  async function ejecutar(sql, parametros = []) {
    const actual = contexto.getStore();

    if (actual && !actual.activa) {
      throw new Error("La transacción ya terminó.");
    }

    let connection;

    try {
      connection =
        actual?.connection ||
        (await pool.getConnection());

      if (!actual) {
        await prepararConexion(connection);
      }

      const [resultado] =
        await connection.execute(
          sql,
          parametros,
        );

      return resultado;
    } catch (error) {
      throw errorSeguro(error);
    } finally {
      if (!actual) {
        connection?.release();
      }
    }
  }


  // ===================================================================
  // TRANSACCIÓN
  //
  // BEGIN
  //   operaciones
  // COMMIT
  //
  // Si algo falla:
  //
  // ROLLBACK
  // ===================================================================

  async function transaccion(callback) {
    if (contexto.getStore()) {
      throw new Error(
        "No se permiten transacciones anidadas.",
      );
    }

    const connection =
      await pool.getConnection();

    const estado = {
      connection,
      activa: true,
    };

    let iniciada = false;
    let descartar = false;

    try {
      await prepararConexion(connection);

      await connection.beginTransaction();

      iniciada = true;


      // repository_lock es una tabla técnica.
      //
      // Si la BD fue importada manualmente desde phpMyAdmin,
      // ready() se asegura de crearla antes de iniciar la aplicación.

      const [lock] =
        await connection.execute(
          `
          SELECT id
          FROM repository_lock
          WHERE id = 1
          FOR UPDATE
          `,
        );

      if (lock.length !== 1) {
        throw new Error(
          "No se pudo obtener el bloqueo del repositorio.",
        );
      }


      const resultado =
        await contexto.run(
          estado,
          callback,
        );


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

      if (descartar) {
        connection.destroy();
      } else {
        connection.release();
      }
    }
  }


  // Si ya estamos dentro de una transacción, reutilizamos la misma.
  //
  // Si no estamos dentro, abrimos una nueva.

  const escribir = (callback) =>
    contexto.getStore()
      ? callback()
      : transaccion(callback);


  // ===================================================================
  // CREAR SELECT DE UN MODELO
  // ===================================================================

  function columnasSelect(modelo) {
    const columnas = [
      `${modelo.tabla}.\`${modelo.id}\` AS id`,
    ];


    for (const [campoBackend, campoMysql]
      of Object.entries(modelo.campos)) {
      columnas.push(
        `${modelo.tabla}.\`${campoMysql}\` AS \`${campoBackend}\``,
      );
    }


    if (modelo.createdAt) {
      columnas.push(
        `${modelo.tabla}.\`${modelo.createdAt}\` AS createdAt`,
      );
    }


    if (modelo.extras) {
      columnas.push(...modelo.extras);
    }


    return columnas.join(", ");
  }


  // ===================================================================
  // REPOSITORIOS
  // ===================================================================

  const repos = {
    transaccion,

    close: () => pool.end(),


    // ---------------------------------------------------------------
    // BLOQUEAR PRODUCTOS
    //
    // Se utiliza durante la creación de pedidos para impedir que dos
    // operaciones modifiquen el mismo stock simultáneamente.
    // ---------------------------------------------------------------

    async bloquearProductos(ids) {
      if (!contexto.getStore()) {
        throw new Error(
          "El bloqueo requiere una transacción.",
        );
      }


      const unicos = [
        ...new Set(ids),
      ].sort((a, b) => a - b);


      for (const id of unicos) {
        await ejecutar(
          `
          SELECT id_producto
          FROM producto
          WHERE id_producto = ?
          FOR UPDATE
          `,
          [id],
        );
      }
    },


    // ---------------------------------------------------------------
    // READY
    //
    // Comprueba que existan las 11 tablas del proyecto.
    //
    // Esto permite trabajar tanto con:
    //
    // - migraciones Node.js
    // - importación manual desde phpMyAdmin
    // ---------------------------------------------------------------

    async ready() {
      const requeridas = [
        "rol",
        "categoria",
        "usuario",
        "negocio",
        "producto",
        "servicio",
        "horario_servicio",
        "reserva",
        "favorito",
        "pedido",
        "detalle_pedido",
      ];


      const placeholders =
        requeridas
          .map(() => "?")
          .join(", ");


      const tablas = await ejecutar(
        `
        SELECT TABLE_NAME AS tabla
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN (${placeholders})
        `,
        requeridas,
      );


      if (tablas.length !== requeridas.length) {
        throw new Error(
          "La base de datos Reactiva Pereira está incompleta.",
        );
      }


      // Tabla exclusivamente técnica.
      //
      // Si usamos las migraciones ya existirá.
      // Si importamos el SQL académico desde phpMyAdmin,
      // se crea automáticamente al arrancar el backend.

      await ejecutar(`
        CREATE TABLE IF NOT EXISTS repository_lock (
          id TINYINT PRIMARY KEY
        )
      `);


      await ejecutar(`
        INSERT IGNORE INTO repository_lock (id)
        VALUES (1)
      `);
    },
  };


  // ===================================================================
  // CONSTRUCCIÓN AUTOMÁTICA DE CADA REPOSITORY
  // ===================================================================

  for (const [
    nombre,
    modelo,
  ] of Object.entries(modelos)) {

    const {
      tabla,
      id,
      campos,
      referencia,
      join = "",
    } = modelo;


    const columnas =
      columnasSelect(modelo);


    const desde =
      `${tabla} ${join}`;


    // ---------------------------------------------------------------
    // VALIDAR ID
    // ---------------------------------------------------------------

    const idValido = (valor) =>
      Number.isSafeInteger(Number(valor)) &&
      Number(valor) > 0;


    // ---------------------------------------------------------------
    // CAMPOS PERMITIDOS PARA INSERT / UPDATE
    //
    // Evita que campos como:
    //
    // id
    // createdAt
    // propietario
    //
    // sean escritos directamente desde el cliente.
    // ---------------------------------------------------------------

    const entradas = (datos) =>
      Object.keys(campos).filter(
        (campo) =>
          Object.hasOwn(datos, campo) &&
          datos[campo] !== undefined,
      );


    const repo = {

      // =============================================================
      // LIST
      // =============================================================

      async list() {
        const filas =
          await ejecutar(
            `
            SELECT ${columnas}
            FROM ${desde}
            ORDER BY ${tabla}.\`${id}\`
            `,
          );


        return filas.map(dto);
      },


      // =============================================================
      // FIND
      // =============================================================

      async find(valorId) {
        if (!idValido(valorId)) {
          return null;
        }


        const filas =
          await ejecutar(
            `
            SELECT ${columnas}
            FROM ${desde}
            WHERE ${tabla}.\`${id}\` = ?
            `,
            [Number(valorId)],
          );


        return dto(filas[0]);
      },


      // =============================================================
      // CREATE
      // =============================================================

      create(datos) {
        return escribir(async () => {

          const valores =
            await normalizarEscritura(
              nombre,
              datos,
              null,
              repos,
            );


          const keys =
            entradas(valores);


          const columnasInsert =
            keys
              .map(
                (key) =>
                  `\`${campos[key]}\``,
              )
              .join(", ");


          const placeholders =
            keys
              .map(() => "?")
              .join(", ");


          const parametros =
            keys.map((key) =>
              key === "fechaHoraInicio"
                ? new Date(valores[key])
                : valores[key],
            );


          const resultado =
            await ejecutar(
              `
              INSERT INTO ${tabla}
              (${columnasInsert})
              VALUES (${placeholders})
              `,
              parametros,
            );


          return repo.find(
            resultado.insertId,
          );
        });
      },


      // =============================================================
      // UPDATE
      // =============================================================

      update(valorId, datos) {
        if (!idValido(valorId)) {
          return Promise.resolve(null);
        }


        return escribir(async () => {

          const previo =
            await repo.find(valorId);


          if (!previo) {
            return null;
          }


          const valores =
            await normalizarEscritura(
              nombre,
              datos,
              previo,
              repos,
            );


          const keys =
            entradas(valores);


          // Si no se recibió ningún campo válido,
          // simplemente devolvemos el registro actual.

          if (keys.length === 0) {
            return previo;
          }


          const cambios =
            keys.map(
              (key) =>
                `\`${campos[key]}\` = ?`,
            );


          const parametros =
            keys.map((key) =>
              key === "fechaHoraInicio"
                ? new Date(valores[key])
                : valores[key],
            );


          parametros.push(
            Number(valorId),
          );


          await ejecutar(
            `
            UPDATE ${tabla}
            SET ${cambios.join(", ")}
            WHERE \`${id}\` = ?
            `,
            parametros,
          );


          return repo.find(valorId);
        });
      },


      // =============================================================
      // DELETE
      // =============================================================

      delete(valorId) {
        if (!idValido(valorId)) {
          return Promise.resolve(false);
        }


        return escribir(async () => {

          const resultado =
            await ejecutar(
              `
              DELETE FROM ${tabla}
              WHERE \`${id}\` = ?
              `,
              [Number(valorId)],
            );


          return resultado.affectedRows > 0;
        });
      },
    };


    // Rol y Categoria son tablas de referencia.
    //
    // Desde la aplicación solamente necesitamos consultarlas.

    repos[nombre] = referencia
      ? {
          list: repo.list,
          find: repo.find,
        }
      : repo;
  }


  return repos;
}


module.exports = {
  createMysqlRepositories,
};