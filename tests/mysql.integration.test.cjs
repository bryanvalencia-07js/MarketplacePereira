const {
  test,
  before,
  beforeEach,
  after,
} = require("node:test");

const assert = require("node:assert/strict");

const {
  createPool,
} = require("../backend/db/pool");

const {
  migrate,
} = require("../backend/db/migrate");

const {
  configuracion,
} = require("../backend/config");

const {
  createMysqlRepositories,
} = require("../backend/repositories/mysql");

const {
  createUsuarioService,
} = require("../backend/services/usuario.service");

const {
  createNegocioService,
} = require("../backend/services/negocio.service");

const {
  createProductoService,
} = require("../backend/services/producto.service");

const {
  createApplication,
} = require("../backend/app");


// =====================================================================
// CONFIGURACIÓN
//
// Esta suite trabaja contra una base MySQL/MariaDB REAL.
//
// Es destructiva y solamente puede ejecutarse sobre una base cuyo
// nombre termine en:
//
// _test
// =====================================================================

const config = configuracion();

if (
  config.dataSource !== "mysql" ||
  !config.db?.database?.endsWith("_test")
) {
  throw new Error(
    "Las pruebas MySQL requieren DATA_SOURCE=mysql y DB_NAME terminado en _test.",
  );
}


let pool;
let repos;
let otros;


// =====================================================================
// DATOS FICTICIOS
// =====================================================================

const clave =
  "Una-clave-de-prueba-2026";


const imagen =
  "data:image/png;base64," +
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/" +
  "x8AAwMCAO+jI5kAAAAASUVORK5CYII=";


// =====================================================================
// FIXTURE USUARIO
//
// passwordHash se utiliza directamente porque estas pruebas del
// Repository no necesitan autenticar este fixture.
//
// Los tests HTTP que sí hacen login utilizan UsuarioService y scrypt.
// =====================================================================

function usuario(
  correo = "prueba@example.invalid",
  rol = "Comerciante",
) {
  return {
    nombre: "Ana",
    apellido: "Pereira",
    correo,
    rol,
    estado: "Activo",
    passwordHash: "solo-fixture-no-real",
  };
}


// =====================================================================
// FIXTURE NEGOCIO
// =====================================================================

function negocio(usuarioId) {
  return {
    usuarioId,
    nombre: "Café Pereira",
    categoria: "Alimentos",
    telefono: "3001234567",
    direccion: "Calle ficticia 1",
    descripcion: "Negocio de prueba",
    municipio: "Pereira",
    estado: "Activo",
  };
}


// =====================================================================
// FIXTURE PRODUCTO
//
// Usamos el nombre actual:
//
// visitas
//
// popularidad queda únicamente como alias de respuesta.
// =====================================================================

function producto(negocioId) {
  return {
    negocioId,
    nombre: "Café",
    descripcion: "Tueste local",
    categoria: "Alimentos",
    precio: 10.25,
    stock: 3,
    imagen,
    estado: "Activo",
    visitas: 0,
  };
}


// =====================================================================
// LIMPIEZA
//
// Se eliminan únicamente datos transaccionales.
//
// Rol y Categoria permanecen porque son datos de referencia cargados
// por 002_reference_data.sql.
//
// El orden es hijo → padre para respetar las FK.
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
}


// =====================================================================
// CICLO DE VIDA
// =====================================================================

before(async () => {
  pool = createPool(config.db);

  // migrate() es repetible.
  // Si las migraciones ya existen, simplemente las verifica.
  await migrate(pool);

  repos =
    createMysqlRepositories(pool);

  otros =
    createMysqlRepositories(
      createPool(config.db),
    );

  await repos.ready();
  await otros.ready();
});


beforeEach(async () => {
  await limpiarDatos();
});


after(async () => {
  await otros?.close();
  await pool?.end();
});


// =====================================================================
// TEST 1
//
// CRUD real y traducción SQL ↔ JavaScript.
//
// También verifica una diferencia importante del esquema actual:
//
// Usuario y Negocio tienen createdAt porque poseen fecha_registro.
//
// Producto NO tiene createdAt porque la tabla producto no posee
// actualmente una fecha de creación física.
// =====================================================================

test(
  "MySQL real: CRUD y DTO respetan el esquema académico actual",
  async () => {
    const u =
      await repos.usuario.create(
        usuario(),
      );


    // ---------------------------------------------------------------
    // USUARIO
    // ---------------------------------------------------------------

    assert.equal(
      typeof u.id,
      "number",
    );

    assert.equal(
      u.rol,
      "Comerciante",
    );

    assert.equal(
      u.createdAt,
      new Date(u.createdAt).toISOString(),
    );


    // ---------------------------------------------------------------
    // NEGOCIO
    // ---------------------------------------------------------------

    const n =
      await repos.negocio.create(
        negocio(u.id),
      );

    assert.equal(
      n.propietario,
      "Ana Pereira",
    );

    assert.equal(
      n.categoria,
      "Alimentos",
    );

    assert.equal(
      n.createdAt,
      new Date(n.createdAt).toISOString(),
    );


    // El propietario se deriva del Usuario vigente.
    await repos.usuario.update(
      u.id,
      {
        nombre: "Laura",
      },
    );

    assert.equal(
      (
        await repos.negocio.find(
          n.id,
        )
      ).propietario,
      "Laura Pereira",
    );


    // ---------------------------------------------------------------
    // PRODUCTO
    // ---------------------------------------------------------------

    const p =
      await repos.producto.create(
        producto(n.id),
      );

    assert.equal(
      typeof p.id,
      "number",
    );

    assert.equal(
      p.precio,
      10.25,
    );

    assert.equal(
      p.visitas,
      0,
    );

    assert.equal(
      p.popularidad,
      0,
    );


    // Producto no tiene fecha física de creación actualmente.
    assert.equal(
      Object.hasOwn(
        p,
        "createdAt",
      ),
      false,
    );

    assert.equal(
      Object.hasOwn(
        p,
        "updatedAt",
      ),
      false,
    );


    // ---------------------------------------------------------------
    // CAMPOS NO ESCRIBIBLES
    //
    // id y createdAt no forman parte de los campos que el Repository
    // permite escribir en Producto.
    // ---------------------------------------------------------------

    const actualizado =
      await repos.producto.update(
        p.id,
        {
          precio: 1000000000,
          stock: 1000000,

          id: 999,
          createdAt: "ayer",
        },
      );

    assert.equal(
      actualizado.precio,
      1000000000,
    );

    assert.equal(
      actualizado.stock,
      1000000,
    );

    assert.equal(
      actualizado.id,
      p.id,
    );

    assert.equal(
      Object.hasOwn(
        actualizado,
        "createdAt",
      ),
      false,
    );


    // ---------------------------------------------------------------
    // ID INVÁLIDO
    // ---------------------------------------------------------------

    assert.equal(
      await repos.producto.find(
        "1 OR 1=1",
      ),
      null,
    );

    assert.equal(
      await repos.producto.update(
        4294967295,
        {
          stock: 2,
        },
      ),
      null,
    );


    // ---------------------------------------------------------------
    // DELETE
    // ---------------------------------------------------------------

    assert.equal(
      await repos.producto.delete(
        p.id,
      ),
      true,
    );

    assert.equal(
      await repos.producto.delete(
        p.id,
      ),
      false,
    );


    // AUTO_INCREMENT no reutiliza inmediatamente el ID eliminado.
    const nuevo =
      await repos.producto.create(
        producto(n.id),
      );

    assert.ok(
      nuevo.id > p.id,
    );
  },
);


// =====================================================================
// TEST 2
//
// Una transacción debe ser atómica.
//
// Si falla cualquier operación:
//
// Usuario
// Negocio
// Producto
//
// deben revertirse juntos.
// =====================================================================

test(
  "MySQL real: ROLLBACK revierte una operación compuesta",
  async () => {
    await assert.rejects(
      repos.transaccion(
        async () => {
          const u =
            await repos.usuario.create(
              usuario(),
            );

          const n =
            await repos.negocio.create(
              negocio(u.id),
            );

          await repos.producto.create(
            producto(n.id),
          );

          throw new Error(
            "cancelar transacción de prueba",
          );
        },
      ),
      /cancelar transacción de prueba/,
    );


    assert.deepEqual(
      await repos.usuario.list(),
      [],
    );

    assert.deepEqual(
      await repos.negocio.list(),
      [],
    );

    assert.deepEqual(
      await repos.producto.list(),
      [],
    );


    // La conexión y el Repository deben seguir funcionando después
    // del rollback.
    const creado =
      await repos.usuario.create(
        usuario(),
      );

    assert.ok(
      creado.id > 0,
    );
  },
);


// =====================================================================
// TEST 3
//
// Dos procesos/pools distintos pueden intentar crear el mismo correo
// o el mismo Negocio simultáneamente.
//
// El sistema debe conservar las reglas de unicidad.
// =====================================================================

test(
  "MySQL real: dos pools conservan unicidad concurrente",
  async () => {
    const servicioA =
      createUsuarioService(repos);

    const servicioB =
      createUsuarioService(otros);


    const body = {
      nombre: "Ana",
      apellido: "Pereira",
      correo: "unico@example.invalid",
      password: clave,
      rol: "Comerciante",
    };


    // ---------------------------------------------------------------
    // MISMO CORREO
    // ---------------------------------------------------------------

    const usuarios =
      await Promise.allSettled([
        servicioA.registrar(body),
        servicioB.registrar(body),
      ]);


    assert.equal(
      usuarios.filter(
        (resultado) =>
          resultado.status ===
          "fulfilled",
      ).length,
      1,
    );


    const rechazoUsuario =
      usuarios.find(
        (resultado) =>
          resultado.status ===
          "rejected",
      );

    assert.equal(
      rechazoUsuario.reason.status,
      400,
    );


    const [comerciante] =
      await repos.usuario.list();


    // ---------------------------------------------------------------
    // MISMO COMERCIANTE → DOS NEGOCIOS
    // ---------------------------------------------------------------

    const negocios =
      await Promise.allSettled([
        createNegocioService(
          repos,
        ).crear(
          comerciante,
          negocio(comerciante.id),
        ),

        createNegocioService(
          otros,
        ).crear(
          comerciante,
          negocio(comerciante.id),
        ),
      ]);


    assert.equal(
      negocios.filter(
        (resultado) =>
          resultado.status ===
          "fulfilled",
      ).length,
      1,
    );


    assert.equal(
      (
        await repos.negocio.list()
      ).length,
      1,
    );
  },
);


// =====================================================================
// TEST 4
//
// repository_lock debe coordinar escrituras entre pools.
//
// Comprobamos dos reglas reales:
//
// 1. Incrementos concurrentes de visitas.
// 2. Nunca puede desaparecer el último Administrador activo.
// =====================================================================

test(
  "MySQL real: escrituras concurrentes conservan visitas y último Administrador",
  async () => {
    const comerciante =
      await repos.usuario.create(
        usuario(),
      );

    const n =
      await repos.negocio.create(
        negocio(comerciante.id),
      );

    const p =
      await repos.producto.create(
        producto(n.id),
      );


    // ---------------------------------------------------------------
    // VISITAS CONCURRENTES
    // ---------------------------------------------------------------

    await Promise.all(
      Array.from(
        {
          length: 12,
        },
        (_, indice) =>
          createProductoService(
            indice % 2
              ? repos
              : otros,
          ).visita(
            p.id,
          ),
      ),
    );


    const visitado =
      await repos.producto.find(
        p.id,
      );

    assert.equal(
      visitado.visitas,
      12,
    );

    assert.equal(
      visitado.popularidad,
      12,
    );


    // ---------------------------------------------------------------
    // ADMINISTRADORES
    // ---------------------------------------------------------------

    const adminA =
      await repos.usuario.create(
        usuario(
          "admin-a@example.invalid",
          "Administrador",
        ),
      );

    const adminB =
      await repos.usuario.create(
        usuario(
          "admin-b@example.invalid",
          "Administrador",
        ),
      );


    const cambios =
      await Promise.allSettled([
        createUsuarioService(
          repos,
        ).actualizar(
          adminA,
          adminA.id,
          {
            estado: "Inactivo",
          },
        ),

        createUsuarioService(
          otros,
        ).actualizar(
          adminB,
          adminB.id,
          {
            estado: "Inactivo",
          },
        ),
      ]);


    // Solo uno puede quedar inactivo.
    assert.equal(
      cambios.filter(
        (resultado) =>
          resultado.status ===
          "fulfilled",
      ).length,
      1,
    );


    const activos =
      (
        await repos.usuario.list()
      ).filter(
        (u) =>
          u.rol ===
            "Administrador" &&
          u.estado === "Activo",
      );


    assert.equal(
      activos.length,
      1,
    );
  },
);


// =====================================================================
// TEST 5
//
// Prueba de extremo a extremo:
//
// HTTP
// → Express
// → Service
// → Repository MySQL
// → MariaDB
//
// Después recreamos la aplicación y comprobamos:
//
// datos persistentes ✅
// sesión anterior ❌
// =====================================================================

test(
  "MySQL real: API persiste Usuarios entre reinicios de la aplicación",
  async () => {
    let servidor;
    let reposAplicacion;
    let reposReinicio;


    try {
      // -------------------------------------------------------------
      // PRIMERA INSTANCIA
      // -------------------------------------------------------------

      const sistema =
        await createApplication({
          dataSource: "mysql",
          db: config.db,

          admin: {
            correo:
              "admin-api@example.invalid",
            password: clave,
          },
        });


      reposAplicacion =
        sistema.repositories;


      servidor =
        sistema.app.listen(
          0,
          "127.0.0.1",
        );


      await new Promise(
        (resolve) =>
          servidor.once(
            "listening",
            resolve,
          ),
      );


      const base =
        `http://127.0.0.1:` +
        `${servidor.address().port}` +
        "/api";


      // Usuarios requiere Administrador.
      assert.equal(
        (
          await fetch(
            base + "/usuarios",
          )
        ).status,
        401,
      );


      // -------------------------------------------------------------
      // LOGIN ADMIN
      // -------------------------------------------------------------

      const login =
        await fetch(
          base + "/auth/login",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              correo:
                "admin-api@example.invalid",

              password: clave,
            }),
          },
        );


      assert.equal(
        login.status,
        200,
      );


      const cookie =
        login.headers.get(
          "set-cookie",
        );


      assert.ok(cookie);

      assert.match(
        cookie,
        /HttpOnly/,
      );

      assert.match(
        cookie,
        /SameSite=Strict/,
      );


      const loginJson =
        await login.json();


      assert.equal(
        loginJson.data.usuario
          .passwordHash,
        undefined,
      );


      // -------------------------------------------------------------
      // CREAR USUARIO SIN CSRF
      // -------------------------------------------------------------

      const headers = {
        "Content-Type":
          "application/json",

        Cookie:
          cookie.split(";")[0],
      };


      const body =
        JSON.stringify({
          nombre: "Ana",
          apellido: "Pereira",
          correo:
            "persistente@example.invalid",
          password: clave,
          rol: "Comerciante",
        });


      const sinCsrf =
        await fetch(
          base + "/usuarios",
          {
            method: "POST",
            headers,
            body,
          },
        );


      assert.equal(
        sinCsrf.status,
        403,
      );


      // -------------------------------------------------------------
      // CREAR USUARIO CON CSRF
      // -------------------------------------------------------------

      headers["X-CSRF-Token"] =
        loginJson.data.csrfToken;


      const creado =
        await fetch(
          base + "/usuarios",
          {
            method: "POST",
            headers,
            body,
          },
        );


      assert.equal(
        creado.status,
        201,
      );


      const creadoJson =
        await creado.json();


      const id =
        creadoJson.data.id;


      // -------------------------------------------------------------
      // CERRAR PRIMERA APLICACIÓN
      // -------------------------------------------------------------

      await new Promise(
        (resolve) =>
          servidor.close(
            resolve,
          ),
      );

      servidor = null;


      await reposAplicacion.close();

      reposAplicacion = null;


      // -------------------------------------------------------------
      // SEGUNDA INSTANCIA
      // -------------------------------------------------------------

      const reiniciado =
        await createApplication({
          dataSource: "mysql",
          db: config.db,
        });


      reposReinicio =
        reiniciado.repositories;


      // -------------------------------------------------------------
      // EL USUARIO SIGUE EN MYSQL
      // -------------------------------------------------------------

      const persistente =
        await reiniciado.servicios
          .usuarios.obtener(id);


      assert.equal(
        persistente.correo,
        "persistente@example.invalid",
      );


      // Admin + Comerciante creado.
      assert.equal(
        (
          await reiniciado.servicios
            .usuarios.listar()
        ).length,
        2,
      );


      // -------------------------------------------------------------
      // LA SESIÓN NO PERSISTE
      //
      // Las sesiones viven en memoria de cada instancia Node.
      // -------------------------------------------------------------

      const token =
        cookie
          .split(";")[0]
          .split("=")[1];


      assert.equal(
        await reiniciado.servicios
          .auth.resolver(token),
        null,
      );
    } finally {
      if (servidor) {
        await new Promise(
          (resolve) =>
            servidor.close(
              resolve,
            ),
        );
      }

      await reposAplicacion?.close();
      await reposReinicio?.close();
    }
  },
);