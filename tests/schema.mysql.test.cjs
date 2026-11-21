const {
  test,
  before,
  beforeEach,
  after,
} = require("node:test");

const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { createHash } = require("node:crypto");
const path = require("node:path");

const { configuracion } = require("../backend/config");
const {
  createPool,
  prepararConexion,
} = require("../backend/db/pool");

const { migrate } = require("../backend/db/migrate");

const {
  createMysqlRepositories,
} = require("../backend/repositories/mysql");


// =====================================================================
// CONFIGURACIÓN
//
// Esta suite es DESTRUCTIVA.
//
// Solamente puede ejecutarse contra una base cuyo nombre termine en:
//
// _test
//
// Ejemplo:
//
// reactiva_pereira_test
// =====================================================================

const config = configuracion();

if (
  config.dataSource !== "mysql" ||
  !config.db?.database?.endsWith("_test")
) {
  throw new Error(
    "Requiere DATA_SOURCE=mysql y una base dedicada cuyo nombre termine en _test.",
  );
}


let pool;
let repos;


// =====================================================================
// MIGRACIONES OFICIALES ACTUALES
// =====================================================================

const MIGRACIONES = [
  "001_foundation.sql",
  "002_reference_data.sql",
  "003_services_reservations_favorites.sql",
  "004_orders_and_details.sql",
];


// =====================================================================
// TABLAS DEL DER
// =====================================================================

const TABLAS_NEGOCIO = [
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


// =====================================================================
// TABLAS TÉCNICAS
// =====================================================================

const TABLAS_TECNICAS = [
  "repository_lock",
  "schema_migrations",
];


// =====================================================================
// RUTA DE UNA MIGRACIÓN
// =====================================================================

function archivo(nombre) {
  return path.join(
    __dirname,
    "../backend/db/migrations",
    nombre,
  );
}


// =====================================================================
// CHECKSUM
// =====================================================================

async function checksum(nombre) {
  const contenido = await readFile(
    archivo(nombre),
    "utf8",
  );

  return createHash("sha256")
    .update(contenido)
    .digest("hex");
}


// =====================================================================
// RECREAR ESQUEMA
//
// Elimina exclusivamente las tablas de la base _test.
//
// El orden es hijo → padre para respetar las FK.
// =====================================================================

async function recrearEsquema() {
  const connection = await pool.getConnection();

  try {
    await prepararConexion(connection);

    const tablas = [
      "detalle_pedido",
      "pedido",
      "favorito",
      "reserva",
      "horario_servicio",
      "servicio",
      "producto",
      "negocio",
      "usuario",
      "categoria",
      "rol",
      "repository_lock",
      "schema_migrations",
    ];

    for (const tabla of tablas) {
      await connection.query(
        `DROP TABLE IF EXISTS \`${tabla}\``,
      );
    }
  } finally {
    connection.release();
  }

  await migrate(pool);

  repos = createMysqlRepositories(pool);

  await repos.ready();
}


// =====================================================================
// LIMPIAR DATOS TRANSACCIONALES
//
// Conservamos Rol y Categoria porque son datos de referencia.
// =====================================================================

async function limpiarDatos() {
  const tablas = [
    "detalle_pedido",
    "pedido",
    "favorito",
    "reserva",
    "horario_servicio",
    "servicio",
    "producto",
    "negocio",
    "usuario",
  ];

  for (const tabla of tablas) {
    await pool.query(
      `DELETE FROM \`${tabla}\``,
    );
  }

  // Elimina solamente categorías creadas por este archivo de pruebas.
  await pool.execute(
    `
    DELETE FROM categoria
    WHERE nombre_categoria = ?
    `,
    ["Archivada Test"],
  );
}


// =====================================================================
// FIXTURES
// =====================================================================

async function crearComerciante(
  correo = "comerciante-schema@example.invalid",
) {
  return repos.usuario.create({
    rol: "Comerciante",
    nombre: "Ana",
    apellido: "Prueba",
    correo,
    telefono: "3001234567",
    passwordHash: "hash-fixture-no-real",
    estado: "Activo",
  });
}


async function crearNegocio(usuarioId) {
  return repos.negocio.create({
    usuarioId,
    categoria: "Alimentos",
    nombre: "Negocio de prueba",
    descripcion: "Negocio utilizado exclusivamente por tests.",
    direccion: "Calle ficticia 1",
    municipio: "Pereira",
    telefono: "3001234567",
    estado: "Activo",
  });
}


async function crearProducto(negocioId) {
  return repos.producto.create({
    negocioId,
    categoria: "Alimentos",
    nombre: "Producto de prueba",
    descripcion: "Producto utilizado exclusivamente por tests.",
    precio: 12500,
    stock: 5,
    visitas: 0,
    estado: "Activo",
  });
}


// =====================================================================
// CICLO DE VIDA
// =====================================================================

before(async () => {
  pool = createPool(config.db);

  await recrearEsquema();
});


beforeEach(async () => {
  await limpiarDatos();
});


after(async () => {
  await pool?.end();
});


// =====================================================================
// TEST 1
//
// Las cuatro migraciones deben crear exactamente:
//
// 11 tablas del DER
// +
// 2 tablas técnicas
//
// También deben cargar los datos de referencia.
// =====================================================================

test(
  "MySQL: las migraciones 001-004 crean el esquema canónico y sus referencias",
  async () => {
    const [tablas] = await pool.query(`
      SELECT TABLE_NAME AS nombre
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME
    `);

    const encontradas = tablas
      .map((fila) => fila.nombre)
      .sort();

    const esperadas = [
      ...TABLAS_NEGOCIO,
      ...TABLAS_TECNICAS,
    ].sort();

    assert.deepEqual(
      encontradas,
      esperadas,
    );


    // ---------------------------------------------------------------
    // EXACTAMENTE 11 ENTIDADES DEL NEGOCIO
    // ---------------------------------------------------------------

    const [negocio] = await pool.query(
      `
      SELECT TABLE_NAME AS nombre
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (
          'rol',
          'categoria',
          'usuario',
          'negocio',
          'producto',
          'servicio',
          'horario_servicio',
          'reserva',
          'favorito',
          'pedido',
          'detalle_pedido'
        )
      `,
    );

    assert.equal(
      negocio.length,
      11,
    );


    // ---------------------------------------------------------------
    // ROLES DE REFERENCIA
    // ---------------------------------------------------------------

    const [roles] = await pool.query(`
      SELECT nombre_rol
      FROM rol
      ORDER BY id_rol
    `);

    assert.deepEqual(
      roles.map((fila) => fila.nombre_rol),
      [
        "Administrador",
        "Comerciante",
        "Comprador",
      ],
    );


    // ---------------------------------------------------------------
    // CATEGORÍAS
    // ---------------------------------------------------------------

    const [[categorias]] = await pool.query(`
      SELECT COUNT(*) AS total
      FROM categoria
    `);

    assert.equal(
      Number(categorias.total),
      24,
    );


    // "Todas" es únicamente un filtro del frontend.
    const [[todas]] = await pool.query(`
      SELECT COUNT(*) AS total
      FROM categoria
      WHERE nombre_categoria = 'Todas'
    `);

    assert.equal(
      Number(todas.total),
      0,
    );


    // ---------------------------------------------------------------
    // NO EXISTEN USUARIOS DEMO
    // ---------------------------------------------------------------

    const [[usuarios]] = await pool.query(`
      SELECT COUNT(*) AS total
      FROM usuario
    `);

    assert.equal(
      Number(usuarios.total),
      0,
    );


    // ---------------------------------------------------------------
    // REPOSITORY LOCK
    // ---------------------------------------------------------------

    const [lock] = await pool.query(`
      SELECT id
      FROM repository_lock
    `);

    assert.deepEqual(
      lock.map((fila) => Number(fila.id)),
      [1],
    );


    // ---------------------------------------------------------------
    // LAS CUATRO MIGRACIONES ESTÁN REGISTRADAS
    // ---------------------------------------------------------------

    const [versiones] = await pool.query(`
      SELECT
        version,
        checksum,
        applied
      FROM schema_migrations
      ORDER BY version
    `);

    assert.deepEqual(
      versiones.map((fila) => fila.version),
      MIGRACIONES,
    );

    for (const version of versiones) {
      assert.equal(
        Number(version.applied),
        1,
      );

      assert.equal(
        version.checksum,
        await checksum(version.version),
      );
    }
  },
);


// =====================================================================
// TEST 2
//
// Comprobamos que las restricciones físicas de MySQL/MariaDB
// complementan las validaciones de los Services.
// =====================================================================

test(
  "MySQL: PK, FK, UNIQUE, CHECK y RESTRICT protegen el esquema base",
  async () => {
    const usuario = await crearComerciante();

    const negocio =
      await crearNegocio(usuario.id);

    const producto =
      await crearProducto(negocio.id);


    const falla = (sql, parametros = []) =>
      assert.rejects(
        pool.execute(sql, parametros),
      );


    // ---------------------------------------------------------------
    // UNIQUE ROL
    // ---------------------------------------------------------------

    await falla(
      `
      INSERT INTO rol
      (nombre_rol)
      VALUES (?)
      `,
      ["Comerciante"],
    );


    // ---------------------------------------------------------------
    // UNIQUE CATEGORIA
    // ---------------------------------------------------------------

    await falla(
      `
      INSERT INTO categoria
      (
        nombre_categoria,
        estado
      )
      VALUES (?, ?)
      `,
      [
        "Alimentos",
        "Activo",
      ],
    );


    // ---------------------------------------------------------------
    // UNIQUE CORREO
    // ---------------------------------------------------------------

    await falla(
      `
      INSERT INTO usuario
      (
        id_rol,
        nombre,
        apellido,
        correo,
        contrasena_hash,
        estado
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        usuario.rolId,
        "Otro",
        "Usuario",
        usuario.correo,
        "otro-hash-fixture",
        "Activo",
      ],
    );


    // ---------------------------------------------------------------
    // FK USUARIO → ROL
    // ---------------------------------------------------------------

    await falla(
      `
      UPDATE usuario
      SET id_rol = ?
      WHERE id_usuario = ?
      `,
      [
        4294967295,
        usuario.id,
      ],
    );


    // ---------------------------------------------------------------
    // UN NEGOCIO POR USUARIO
    // ---------------------------------------------------------------

    await falla(
      `
      INSERT INTO negocio
      (
        id_categoria,
        id_usuario,
        nombre_negocio,
        direccion_comercial,
        telefono_contacto,
        estado
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        negocio.categoriaId,
        usuario.id,
        "Segundo negocio",
        "Calle ficticia 2",
        "3000000000",
        "Activo",
      ],
    );


    // ---------------------------------------------------------------
    // CHECK PRODUCTO
    // ---------------------------------------------------------------

    await falla(
      `
      UPDATE producto
      SET stock = -1
      WHERE id_producto = ?
      `,
      [producto.id],
    );

    await falla(
      `
      UPDATE producto
      SET precio = 0
      WHERE id_producto = ?
      `,
      [producto.id],
    );

    await falla(
      `
      UPDATE producto
      SET visitas = -1
      WHERE id_producto = ?
      `,
      [producto.id],
    );

    await falla(
      `
      UPDATE producto
      SET estado = 'Otro'
      WHERE id_producto = ?
      `,
      [producto.id],
    );


    // ---------------------------------------------------------------
    // RESTRICT CATEGORIA REFERENCIADA
    // ---------------------------------------------------------------

    await falla(
      `
      DELETE FROM categoria
      WHERE id_categoria = ?
      `,
      [producto.categoriaId],
    );


    // ---------------------------------------------------------------
    // MOTOR Y UTF8MB4
    // ---------------------------------------------------------------

    const [tablas] = await pool.query(`
      SELECT
        ENGINE,
        TABLE_COLLATION
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (
          'rol',
          'categoria',
          'usuario',
          'negocio',
          'producto'
        )
    `);

    assert.equal(
      tablas.length,
      5,
    );

    assert.ok(
      tablas.every(
        (tabla) =>
          tabla.ENGINE === "InnoDB" &&
          String(tabla.TABLE_COLLATION)
            .startsWith("utf8mb4"),
      ),
    );
  },
);


// =====================================================================
// TEST 3
//
// El Repository recibe nombres de dominio como:
//
// "Comerciante"
// "Alimentos"
//
// y los transforma en las FK correspondientes.
// =====================================================================

test(
  "MySQL Repository: resuelve Rol y Categoria por relación y rechaza referencias inválidas",
  async () => {
    const usuario =
      await crearComerciante(
        "referencias@example.invalid",
      );


    // ---------------------------------------------------------------
    // ROL RESUELTO POR NOMBRE
    // ---------------------------------------------------------------

    const [[rol]] = await pool.execute(
      `
      SELECT id_rol
      FROM rol
      WHERE nombre_rol = ?
      `,
      ["Comerciante"],
    );

    assert.equal(
      usuario.rolId,
      rol.id_rol,
    );

    assert.equal(
      usuario.rol,
      "Comerciante",
    );


    // ---------------------------------------------------------------
    // NORMALIZACIÓN DE CATEGORIA
    //
    // El Repository acepta espacios/capitalización diferentes
    // y resuelve la referencia existente.
    // ---------------------------------------------------------------

    const negocio =
      await repos.negocio.create({
        usuarioId: usuario.id,
        categoria: "  ALIMENTOS  ",
        nombre: "Negocio referencias",
        descripcion: null,
        direccion: "Calle ficticia 3",
        municipio: "Dosquebradas",
        telefono: "3001234567",
        estado: "Activo",
      });

    assert.equal(
      negocio.categoria,
      "Alimentos",
    );


    const [[categoriaAlimentos]] =
      await pool.execute(
        `
        SELECT id_categoria
        FROM categoria
        WHERE nombre_categoria = ?
        `,
        ["Alimentos"],
      );

    assert.equal(
      negocio.categoriaId,
      categoriaAlimentos.id_categoria,
    );


    // ---------------------------------------------------------------
    // CATEGORIA INACTIVA
    // ---------------------------------------------------------------

    await pool.execute(
      `
      INSERT INTO categoria
      (
        nombre_categoria,
        descripcion,
        estado
      )
      VALUES (?, ?, ?)
      `,
      [
        "Archivada Test",
        "Categoría exclusiva de las pruebas.",
        "Inactivo",
      ],
    );


    await assert.rejects(
      repos.negocio.update(
        negocio.id,
        {
          categoria: "Archivada Test",
        },
      ),
      (error) => error.status === 400,
    );


    // ---------------------------------------------------------------
    // CATEGORIA INEXISTENTE
    // ---------------------------------------------------------------

    await assert.rejects(
      repos.negocio.update(
        negocio.id,
        {
          categoria: "Categoria inexistente",
        },
      ),
      (error) => error.status === 400,
    );


    // ---------------------------------------------------------------
    // "Todas" NO ES UNA CATEGORIA DE BD
    // ---------------------------------------------------------------

    await assert.rejects(
      repos.negocio.update(
        negocio.id,
        {
          categoria: "Todas",
        },
      ),
      (error) => error.status === 400,
    );
  },
);


// =====================================================================
// TEST 4
//
// ready() debe comprobar que las once tablas del DER existan.
//
// Renombramos temporalmente una tabla para simular una base incompleta.
// =====================================================================

test(
  "MySQL Repository: ready detecta una base de datos incompleta",
  async () => {
    await pool.query(
      `
      RENAME TABLE favorito
      TO favorito_temporal_test
      `,
    );

    try {
      await assert.rejects(
        repos.ready(),
        /incompleta/i,
      );
    } finally {
      await pool.query(
        `
        RENAME TABLE favorito_temporal_test
        TO favorito
        `,
      );
    }


    // Una vez restaurada la tabla, la base vuelve a ser válida.
    await repos.ready();
  },
);


// =====================================================================
// TEST 5
//
// schema_migrations debe detectar:
//
// 1. checksum modificado
// 2. migración marcada como incompleta
// =====================================================================

test(
  "Migraciones: checksum modificado e intento incompleto bloquean el runner",
  async () => {
    const version =
      "002_reference_data.sql";

    const checksumReal =
      await checksum(version);


    // ---------------------------------------------------------------
    // CHECKSUM INCORRECTO
    // ---------------------------------------------------------------

    await pool.execute(
      `
      UPDATE schema_migrations
      SET checksum = REPEAT('0', 64)
      WHERE version = ?
      `,
      [version],
    );

    try {
      await assert.rejects(
        migrate(pool),
        /modificada/i,
      );
    } finally {
      await pool.execute(
        `
        UPDATE schema_migrations
        SET checksum = ?
        WHERE version = ?
        `,
        [
          checksumReal,
          version,
        ],
      );
    }


    // ---------------------------------------------------------------
    // MIGRACIÓN INCOMPLETA
    // ---------------------------------------------------------------

    await pool.execute(
      `
      UPDATE schema_migrations
      SET applied = FALSE
      WHERE version = ?
      `,
      [version],
    );

    try {
      await assert.rejects(
        migrate(pool),
        /incompleta/i,
      );
    } finally {
      await pool.execute(
        `
        UPDATE schema_migrations
        SET applied = TRUE
        WHERE version = ?
        `,
        [version],
      );
    }


    // ---------------------------------------------------------------
    // RESTAURADO
    // ---------------------------------------------------------------

    await migrate(pool);

    const [[registro]] =
      await pool.execute(
        `
        SELECT
          checksum,
          applied
        FROM schema_migrations
        WHERE version = ?
        `,
        [version],
      );

    assert.equal(
      registro.checksum,
      checksumReal,
    );

    assert.equal(
      Number(registro.applied),
      1,
    );
  },
);