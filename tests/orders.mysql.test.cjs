
const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { configuracion } = require("../backend/config");
const { createPool } = require("../backend/db/pool");
const { migrate } = require("../backend/db/migrate");
const {
  createMysqlRepositories,
} = require("../backend/repositories/mysql");
const {
  createPedidoService,
} = require("../backend/services/pedido.service");
const { createApplication } = require("../backend/app");
const { hashPassword } = require("../backend/utils/password");

// ============================================================
// SEGURIDAD: ESTA SUITE MODIFICA Y ELIMINA DATOS.
//
// Ejecutar exclusivamente contra una base dedicada _test.
// Nunca contra reactiva_pereira.
// ============================================================

const config = configuracion();

if (
  config.dataSource !== "mysql" ||
  !config.db?.database?.endsWith("_test")
) {
  throw new Error(
    "Requiere DATA_SOURCE=mysql y DB_NAME terminado en _test.",
  );
}

const CLAVE = "Una-clave-de-prueba-2026";

let pool;
let repos;
let otro;
let passwordHash;

let comprador;
let otroComprador;
let comerciante;
let otroComerciante;
let administrador;

let negocio1;
let negocio2;
let producto1;
let producto2;

// ============================================================
// HELPERS
// ============================================================

function pedidos(repository = repos) {
  return createPedidoService(repository);
}

function carrito(...items) {
  return {
    items: items.map(([productoId, cantidad]) => ({
      productoId,
      cantidad,
    })),
  };
}

function errorHttp(codigo) {
  return (error) => error?.status === codigo;
}

// ============================================================
// LIMPIEZA
//
// El orden es hijo → padre para respetar las FK.
// No se eliminan roles, categorías ni tablas técnicas.
// ============================================================

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
    await pool.query(`DELETE FROM \`${tabla}\``);
  }
}

// ============================================================
// FIXTURES
// ============================================================

async function crearUsuario(rol, correo) {
  return repos.usuario.create({
    nombre: "Usuario",
    apellido: "Prueba",
    correo,
    rol,
    passwordHash,
    estado: "Activo",
  });
}

async function crearNegocio(usuario, nombre) {
  return repos.negocio.create({
    usuarioId: usuario.id,
    nombre,
    categoria: "Alimentos",
    direccion: "Dirección comercial ficticia",
    telefono: "3001234567",
    municipio: "Pereira",
    estado: "Activo",
  });
}

async function crearProducto(negocio, nombre) {
  return repos.producto.create({
    negocioId: negocio.id,
    nombre,
    descripcion: "Producto ficticio de prueba",
    categoria: "Alimentos",
    precio: 30000,
    stock: 5,
    visitas: 0,
    estado: "Activo",
  });
}

// ============================================================
// CICLO DE VIDA
// ============================================================

before(async () => {
  pool = createPool(config.db);

  await migrate(pool);

  repos = createMysqlRepositories(pool);

  // Pool independiente para simular escrituras concurrentes.
  otro = createMysqlRepositories(createPool(config.db));

  await repos.ready();
  await otro.ready();

  passwordHash = await hashPassword(CLAVE);
});

beforeEach(async () => {
  await limpiarDatos();

  comerciante = await crearUsuario(
    "Comerciante",
    "comerciante1@example.invalid",
  );

  otroComerciante = await crearUsuario(
    "Comerciante",
    "comerciante2@example.invalid",
  );

  comprador = await crearUsuario(
    "Comprador",
    "comprador1@example.invalid",
  );

  otroComprador = await crearUsuario(
    "Comprador",
    "comprador2@example.invalid",
  );

  administrador = await crearUsuario(
    "Administrador",
    "administrador@example.invalid",
  );

  negocio1 = await crearNegocio(
    comerciante,
    "Negocio Uno",
  );

  negocio2 = await crearNegocio(
    otroComerciante,
    "Negocio Dos",
  );

  producto1 = await crearProducto(
    negocio1,
    "Producto Uno",
  );

  producto2 = await crearProducto(
    negocio2,
    "Producto Dos",
  );
});

after(async () => {
  await otro?.close();
  await pool?.end();
});

// ============================================================
// TESTS DE CONCURRENCIA HTTP
//
// Dos aplicaciones Express independientes.
// Dos pools de MySQL.
// Sesiones propias de cada instancia.
//
// Se intenta comprar stock + 1 unidades.
// Solo stock solicitudes deben tener éxito.
// ============================================================

for (const stock of [1, 3]) {
  test(
    `MySQL: stock ${stock}, dos instancias HTTP sin sobreventa`,
    async () => {
      await repos.producto.update(producto1.id, {
        stock,
      });

      const servidores = [];

      try {
        const bases = [];

        for (const repository of [repos, otro]) {
          const sistema = await createApplication({
            repositories: repository,
          });

          const servidor = sistema.app.listen(
            0,
            "127.0.0.1",
          );

          servidores.push(servidor);

          await new Promise((resolve) => {
            servidor.once("listening", resolve);
          });

          bases.push(
            `http://127.0.0.1:${servidor.address().port}/api`,
          );
        }

        // Cada aplicación crea su propia sesión.
        const sesiones = await Promise.all(
          bases.map(async (base, indice) => {
            const usuario = indice
              ? otroComprador
              : comprador;

            const respuesta = await fetch(
              `${base}/auth/login`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  correo: usuario.correo,
                  password: CLAVE,
                }),
              },
            );

            assert.equal(respuesta.status, 200);

            const json = await respuesta.json();
            const setCookie =
              respuesta.headers.get("set-cookie");

            assert.ok(setCookie);
            assert.ok(json.data.csrfToken);

            return {
              cookie: setCookie.split(";")[0],
              csrfToken: json.data.csrfToken,
            };
          }),
        );

        async function comprar(indice) {
          const instancia = indice % 2;

          const respuesta = await fetch(
            `${bases[instancia]}/pedidos`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Cookie: sesiones[instancia].cookie,
                "X-CSRF-Token":
                  sesiones[instancia].csrfToken,
              },
              body: JSON.stringify(
                carrito([producto1.id, 1]),
              ),
            },
          );

          const json = await respuesta.json();

          if (respuesta.status !== 201) {
            const error = new Error(json.mensaje);
            error.status = respuesta.status;
            throw error;
          }

          return json.data;
        }

        const resultados = await Promise.allSettled(
          Array.from(
            { length: stock + 1 },
            (_, indice) => comprar(indice),
          ),
        );

        const exitosos = resultados.filter(
          (resultado) => resultado.status === "fulfilled",
        );

        const rechazados = resultados.filter(
          (resultado) => resultado.status === "rejected",
        );

        assert.equal(exitosos.length, stock);
        assert.equal(rechazados.length, 1);
        assert.equal(rechazados[0].reason.status, 409);

        assert.equal(
          (await repos.producto.find(producto1.id)).stock,
          0,
        );

        const [[detalles]] = await pool.execute(
          `
          SELECT COUNT(*) AS total
          FROM detalle_pedido
          WHERE id_producto = ?
          `,
          [producto1.id],
        );

        assert.equal(Number(detalles.total), stock);

        assert.equal(
          (await repos.pedido.list()).length,
          stock,
        );
      } finally {
        for (const servidor of servidores) {
          await new Promise((resolve) => {
            servidor.close(resolve);
          });
        }
      }
    },
  );
}

// ============================================================
// TEST: TODO O NADA POR STOCK INSUFICIENTE
// ============================================================

test(
  "MySQL: un carrito multinegocio falla completo si falta stock",
  async () => {
    await repos.producto.update(producto2.id, {
      stock: 0,
    });

    await assert.rejects(
      pedidos().crear(
        comprador,
        carrito(
          [producto1.id, 2],
          [producto2.id, 1],
        ),
      ),
      errorHttp(409),
    );

    assert.equal(
      (await repos.pedido.list()).length,
      0,
    );

    assert.equal(
      (await repos.detallePedido.list()).length,
      0,
    );

    assert.equal(
      (await repos.producto.find(producto1.id)).stock,
      5,
    );

    assert.equal(
      (await repos.producto.find(producto2.id)).stock,
      0,
    );
  },
);

// ============================================================
// TEST: ROLLBACK DESPUÉS DE ESCRITURAS
//
// Se fuerza un error al crear el segundo detalle.
// El primer pedido, su detalle y su descuento de stock
// ya habrán ocurrido dentro de la misma transacción.
// ============================================================

test(
  "MySQL: ROLLBACK revierte pedidos y stock ante fallo intermedio",
  async () => {
    const original = repos.detallePedido.create;
    let intentos = 0;

    repos.detallePedido.create = async (datos) => {
      intentos += 1;

      if (intentos === 2) {
        throw new Error("fallo-intermedio-de-prueba");
      }

      return original(datos);
    };

    try {
      await assert.rejects(
        pedidos().crear(
          comprador,
          carrito(
            [producto1.id, 2],
            [producto2.id, 1],
          ),
        ),
        /fallo-intermedio-de-prueba/,
      );
    } finally {
      repos.detallePedido.create = original;
    }

    assert.equal(
      (await repos.pedido.list()).length,
      0,
    );

    assert.equal(
      (await repos.detallePedido.list()).length,
      0,
    );

    assert.equal(
      (await repos.producto.find(producto1.id)).stock,
      5,
    );

    assert.equal(
      (await repos.producto.find(producto2.id)).stock,
      5,
    );
  },
);

// ============================================================
// TEST: MULTINEGOCIO Y PRECIO HISTÓRICO
// ============================================================

test(
  "MySQL: agrupa pedidos, consolida productos y conserva precios",
  async () => {
    const creados = await pedidos().crear(comprador, {
      items: [
        { productoId: producto1.id, cantidad: 1 },
        { productoId: producto1.id, cantidad: 1 },
        { productoId: producto2.id, cantidad: 1 },
      ],
      observaciones: "Pedido ficticio de prueba",
    });

    assert.equal(creados.length, 2);

    const pedido1 = creados.find(
      (p) => p.negocioId === negocio1.id,
    );

    const pedido2 = creados.find(
      (p) => p.negocioId === negocio2.id,
    );

    assert.ok(pedido1);
    assert.ok(pedido2);

    assert.equal(pedido1.detalles.length, 1);
    assert.equal(pedido2.detalles.length, 1);

    assert.equal(pedido1.detalles[0].cantidad, 2);
    assert.equal(pedido1.detalles[0].precioUnitario, 30000);
    assert.equal(pedido1.total, 60000);

    assert.equal(pedido2.detalles[0].cantidad, 1);
    assert.equal(pedido2.total, 30000);

    assert.equal(
      (await repos.producto.find(producto1.id)).stock,
      3,
    );

    assert.equal(
      (await repos.producto.find(producto2.id)).stock,
      4,
    );

    // Se modifica el precio actual y se desactiva el producto.
    await repos.producto.update(producto1.id, {
      nombre: "Producto con nombre actualizado",
      precio: 40000,
      estado: "Inactivo",
    });

    const historico = await pedidos(otro).obtener(
      comprador,
      pedido1.id,
    );

    // El precio y total del pedido no cambian.
    assert.equal(
      historico.detalles[0].precioUnitario,
      30000,
    );

    assert.equal(
      historico.detalles[0].subtotal,
      60000,
    );

    assert.equal(historico.total, 60000);

    // El nombre se consulta desde el producto actual.
    assert.equal(
      historico.detalles[0].nombre,
      "Producto con nombre actualizado",
    );

    // El total es calculado, no una columna persistida.
    const [columnas] = await pool.query(`
      SELECT TABLE_NAME, COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('pedido', 'detalle_pedido')
    `);

    assert.equal(
      columnas.some(
        (fila) =>
          fila.TABLE_NAME === "pedido" &&
          fila.COLUMN_NAME === "total",
      ),
      false,
    );

    assert.equal(
      columnas.some(
        (fila) =>
          fila.TABLE_NAME === "detalle_pedido" &&
          fila.COLUMN_NAME === "subtotal",
      ),
      false,
    );
  },
);

// ============================================================
// TEST: CANCELACIÓN CONCURRENTE
//
// Al cancelar, el stock debe restaurarse exactamente una vez.
// ============================================================

test(
  "MySQL: cancelación concurrente restaura stock una sola vez",
  async () => {
    const [pedido] = await pedidos().crear(
      comprador,
      carrito([producto1.id, 2]),
    );

    assert.equal(
      (await repos.producto.find(producto1.id)).stock,
      3,
    );

    // Forzamos un error después de modificar el stock,
    // pero antes del COMMIT.
    const original = repos.producto.update;

    repos.producto.update = async (id, datos) => {
      const resultado = await original(id, datos);
      throw new Error("fallo-restock-de-prueba");
    };

    try {
      await assert.rejects(
        pedidos().cancelar(comprador, pedido.id),
        /fallo-restock-de-prueba/,
      );
    } finally {
      repos.producto.update = original;
    }

    // El rollback conserva tanto stock como estado.
    assert.equal(
      (await repos.producto.find(producto1.id)).stock,
      3,
    );

    assert.equal(
      (await repos.pedido.find(pedido.id)).estado,
      "Pendiente",
    );

    // Dos actores autorizados intentan cancelar a la vez.
    const resultados = await Promise.allSettled([
      pedidos(repos).cancelar(comprador, pedido.id),
      pedidos(otro).cancelar(comerciante, pedido.id),
    ]);

    assert.equal(
      resultados.filter((r) => r.status === "fulfilled")
        .length,
      2,
    );

    assert.equal(
      (await repos.producto.find(producto1.id)).stock,
      5,
    );

    assert.equal(
      (await repos.pedido.find(pedido.id)).estado,
      "Cancelado",
    );

    // El historial no se borra.
    assert.equal(
      (await repos.detallePedido.list()).length,
      1,
    );

    // Un pedido cancelado no puede volver a Confirmado.
    await assert.rejects(
      pedidos().estado(administrador, pedido.id, {
        estado: "Confirmado",
      }),
      errorHttp(409),
    );
  },
);

// ============================================================
// TEST: INTEGRIDAD SQL DE PEDIDOS
// ============================================================

test(
  "MySQL: CHECK, FK, UNIQUE y RESTRICT protegen pedidos",
  async () => {
    const [pedido] = await pedidos().crear(
      comprador,
      carrito([producto1.id, 1]),
    );

    const detalle = pedido.detalles[0];

    const falla = (sql, parametros = []) =>
      assert.rejects(pool.execute(sql, parametros));

    // Estado de pedido inválido.
    await falla(
      "UPDATE pedido SET estado = ? WHERE id_pedido = ?",
      ["Otro", pedido.id],
    );

    // Usuario inexistente.
    await falla(
      "UPDATE pedido SET id_usuario = ? WHERE id_pedido = ?",
      [4294967295, pedido.id],
    );

    // Cantidad no positiva.
    await falla(
      "UPDATE detalle_pedido SET cantidad = 0 WHERE id_detalle = ?",
      [detalle.id],
    );

    // Precio histórico no positivo.
    await falla(
      "UPDATE detalle_pedido SET precio_unitario = 0 WHERE id_detalle = ?",
      [detalle.id],
    );

    // Un detalle no puede referenciar un producto inexistente.
    await falla(
      "UPDATE detalle_pedido SET id_producto = ? WHERE id_detalle = ?",
      [4294967295, detalle.id],
    );

    // No puede repetirse el mismo producto dentro del pedido.
    await falla(
      `
      INSERT INTO detalle_pedido
        (id_pedido, id_producto, cantidad, precio_unitario)
      VALUES (?, ?, ?, ?)
      `,
      [pedido.id, producto1.id, 1, 30000],
    );

    // El historial impide eliminar físicamente sus padres.
    await falla(
      "DELETE FROM usuario WHERE id_usuario = ?",
      [comprador.id],
    );

    await falla(
      "DELETE FROM negocio WHERE id_negocio = ?",
      [negocio1.id],
    );

    await falla(
      "DELETE FROM producto WHERE id_producto = ?",
      [producto1.id],
    );

    await falla(
      "DELETE FROM pedido WHERE id_pedido = ?",
      [pedido.id],
    );

    assert.equal(
      (await repos.pedido.find(pedido.id)).estado,
      "Pendiente",
    );

    assert.equal(
      (await repos.detallePedido.list()).length,
      1,
    );
  },
);

// ============================================================
// TEST: AUTORIZACIÓN Y TRANSICIONES DE PEDIDO
// ============================================================

test(
  "MySQL: propiedad y estados conservan historial y stock",
  async () => {
    // La categoría inactiva impide nuevas compras.
    await pool.execute(
      `
      UPDATE categoria
      SET estado = 'Inactivo'
      WHERE id_categoria = ?
      `,
      [producto1.categoriaId],
    );

    try {
      await assert.rejects(
        pedidos().crear(
          comprador,
          carrito([producto1.id, 1]),
        ),
        errorHttp(404),
      );
    } finally {
      await pool.execute(
        `
        UPDATE categoria
        SET estado = 'Activo'
        WHERE id_categoria = ?
        `,
        [producto1.categoriaId],
      );
    }

    const [pedido] = await pedidos().crear(
      comprador,
      carrito([producto1.id, 2]),
    );

    // Otro comprador no puede consultar este pedido.
    await assert.rejects(
      pedidos(otro).obtener(otroComprador, pedido.id),
      errorHttp(403),
    );

    // Un comerciante ajeno no puede modificarlo.
    await assert.rejects(
      pedidos(otro).estado(otroComerciante, pedido.id, {
        estado: "Confirmado",
      }),
      errorHttp(403),
    );

    const ajenos = await pedidos(otro).gestion(
      otroComerciante,
      { negocioId: String(negocio1.id) },
    );

    assert.equal(ajenos.length, 0);

    // No se permite saltar directamente a Completado.
    await assert.rejects(
      pedidos().estado(comerciante, pedido.id, {
        estado: "Completado",
      }),
      errorHttp(409),
    );

    await pedidos().estado(comerciante, pedido.id, {
      estado: "Confirmado",
    });

    // El comprador solo puede cancelar pedidos Pendientes.
    await assert.rejects(
      pedidos(otro).cancelar(comprador, pedido.id),
      errorHttp(409),
    );

    await pedidos(otro).estado(
      administrador,
      pedido.id,
      { estado: "Completado" },
    );

    // Completado es terminal.
    await assert.rejects(
      pedidos().cancelar(administrador, pedido.id),
      errorHttp(409),
    );

    assert.equal(
      (await repos.pedido.find(pedido.id)).estado,
      "Completado",
    );

    // Completar no devuelve el stock vendido.
    assert.equal(
      (await repos.producto.find(producto1.id)).stock,
      3,
    );

    assert.equal(
      (await repos.detallePedido.list()).length,
      1,
    );
  },
);
