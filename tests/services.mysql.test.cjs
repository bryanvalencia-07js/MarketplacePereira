
const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { configuracion } = require("../backend/config");
const { createPool } = require("../backend/db/pool");
const { migrate } = require("../backend/db/migrate");
const {
  createMysqlRepositories,
} = require("../backend/repositories/mysql");

const {
  createServicioService,
} = require("../backend/services/servicio.service");
const {
  createHorarioService,
} = require("../backend/services/horario.service");
const {
  createReservaService,
} = require("../backend/services/reserva.service");
const {
  createFavoritoService,
} = require("../backend/services/favorito.service");

// ============================================================
// SEGURIDAD: utilizar exclusivamente una base de pruebas.
// ============================================================

const config = configuracion();

if (
  config.dataSource !== "mysql" ||
  !config.db?.database?.endsWith("_test")
) {
  throw new Error(
    "Estas pruebas requieren DATA_SOURCE=mysql y DB_NAME terminado en _test.",
  );
}

let pool;
let repos;
let otro;

let comerciante;
let negocio;
let servicio;

// Lunes 5 de enero de 2099, a las 09:00 de Pereira.
// Pereira utiliza UTC-05:00.
const FECHA = "2099-01-05";
const INICIO = `${FECHA}T14:00:00.000Z`;

// ============================================================
// SERVICES
// ============================================================

function servicios(r = repos) {
  return {
    servicio: createServicioService(r),
    horario: createHorarioService(r),
    reserva: createReservaService(r),
    favorito: createFavoritoService(r),
  };
}

// ============================================================
// LIMPIEZA DE DATOS
//
// Se conserva rol, categoria y las tablas técnicas.
// El orden respeta las relaciones entre entidades.
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
    passwordHash: "hash-ficticio-para-pruebas",
    estado: "Activo",
  });
}

async function crearComprador(numero) {
  return crearUsuario(
    "Comprador",
    `comprador-${numero}@example.invalid`,
  );
}

async function crearProducto() {
  return repos.producto.create({
    negocioId: negocio.id,
    categoria: "Alimentos",
    nombre: "Producto de prueba",
    descripcion: "Producto ficticio para favoritos",
    precio: 15000,
    stock: 10,
    estado: "Activo",
    visitas: 0,
  });
}

// ============================================================
// PREPARACIÓN Y CIERRE
// ============================================================

before(async () => {
  pool = createPool(config.db);

  await migrate(pool);

  repos = createMysqlRepositories(pool);

  // Segundo pool independiente para probar concurrencia real.
  otro = createMysqlRepositories(createPool(config.db));

  await repos.ready();
  await otro.ready();
});

beforeEach(async () => {
  await limpiarDatos();

  comerciante = await crearUsuario(
    "Comerciante",
    "comerciante@example.invalid",
  );

  negocio = await repos.negocio.create({
    usuarioId: comerciante.id,
    nombre: "Negocio de prueba",
    categoria: "Alimentos",
    telefono: "3001234567",
    direccion: "Dirección comercial ficticia",
    municipio: "Pereira",
    estado: "Activo",
  });

  servicio = await servicios().servicio.crear(comerciante, {
    negocioId: negocio.id,
    nombre: "Servicio de prueba",
    descripcion: "Servicio ficticio de sesenta minutos",
    categoria: "Alimentos",
    precioReferencia: 0,
    duracionMinutos: 60,
    capacidadSimultanea: 1,
    estado: "Activo",
  });

  await servicios().horario.crear(
    comerciante,
    servicio.id,
    {
      diaSemana: 1,
      horaInicio: "09:00",
      horaFin: "12:00",
    },
  );
});

after(async () => {
  await otro?.close();
  await pool?.end();
});

// ============================================================
// TEST 1: PERSISTENCIA DE SERVICIO Y HORARIO
// ============================================================

test(
  "MySQL: Servicio y Horario utilizan el esquema académico",
  async () => {
    const [[filaServicio]] = await pool.execute(
      `
      SELECT
        id_servicio,
        id_negocio,
        duracion_minutos,
        capacidad_simultanea
      FROM servicio
      WHERE id_servicio = ?
      `,
      [servicio.id],
    );

    assert.equal(filaServicio.id_negocio, negocio.id);
    assert.equal(filaServicio.duracion_minutos, 60);
    assert.equal(filaServicio.capacidad_simultanea, 1);

    const horarios = await servicios().horario.listar(
      null,
      servicio.id,
    );

    assert.equal(horarios.length, 1);
    assert.equal(horarios[0].diaSemana, 1);
    assert.equal(horarios[0].horaInicio, "09:00");
    assert.equal(horarios[0].horaFin, "12:00");

    const [[filaHorario]] = await pool.execute(
      `
      SELECT COUNT(*) AS total
      FROM horario_servicio
      WHERE id_servicio = ?
      `,
      [servicio.id],
    );

    assert.equal(Number(filaHorario.total), 1);
  },
);

// ============================================================
// TEST 2: HORARIOS CONCURRENTES
//
// El solapamiento se valida en el Service, dentro de una
// transacción. La FK y UNIQUE no bastan para detectar todos
// los intervalos superpuestos.
// ============================================================

test(
  "MySQL: dos pools no crean horarios superpuestos",
  async () => {
    const solicitudes = await Promise.allSettled([
      servicios(repos).horario.crear(
        comerciante,
        servicio.id,
        {
          diaSemana: 2,
          horaInicio: "09:00",
          horaFin: "11:00",
        },
      ),

      servicios(otro).horario.crear(
        comerciante,
        servicio.id,
        {
          diaSemana: 2,
          horaInicio: "10:00",
          horaFin: "12:00",
        },
      ),
    ]);

    const exitosas = solicitudes.filter(
      (resultado) => resultado.status === "fulfilled",
    );

    const rechazadas = solicitudes.filter(
      (resultado) => resultado.status === "rejected",
    );

    assert.equal(exitosas.length, 1);
    assert.equal(rechazadas.length, 1);
    assert.equal(rechazadas[0].reason.status, 409);

    const [[fila]] = await pool.execute(
      `
      SELECT COUNT(*) AS total
      FROM horario_servicio
      WHERE id_servicio = ?
        AND dia_semana = 2
      `,
      [servicio.id],
    );

    assert.equal(Number(fila.total), 1);
  },
);

// ============================================================
// TEST 3 Y 4: RESERVAS CONCURRENTES
//
// Importante: cada solicitud utiliza un Comprador diferente.
// Así comprobamos capacidad, no la restricción UNIQUE del
// mismo Usuario + Servicio + fecha.
// ============================================================

for (const capacidad of [1, 3]) {
  test(
    `MySQL: capacidad ${capacidad} sin sobreventa de cupos`,
    async () => {
      await servicios().servicio.actualizar(
        comerciante,
        servicio.id,
        {
          capacidadSimultanea: capacidad,
        },
      );

      const compradores = [];

      for (let i = 0; i < capacidad + 1; i++) {
        compradores.push(await crearComprador(i + 1));
      }

      const solicitudes = compradores.map(
        (comprador, indice) =>
          servicios(indice % 2 ? repos : otro).reserva.crear(
            comprador,
            {
              servicioId: servicio.id,
              fechaHoraInicio: INICIO,
            },
          ),
      );

      const resultados = await Promise.allSettled(
        solicitudes,
      );

      const exitosas = resultados.filter(
        (resultado) => resultado.status === "fulfilled",
      );

      const rechazadas = resultados.filter(
        (resultado) => resultado.status === "rejected",
      );

      assert.equal(exitosas.length, capacidad);
      assert.equal(rechazadas.length, 1);
      assert.equal(rechazadas[0].reason.status, 409);

      const [[fila]] = await pool.execute(
        `
        SELECT COUNT(*) AS total
        FROM reserva
        WHERE id_servicio = ?
          AND estado = 'Confirmada'
        `,
        [servicio.id],
      );

      assert.equal(Number(fila.total), capacidad);

      const disponibilidad =
        await servicios(otro).reserva.disponibilidad(
          null,
          servicio.id,
          FECHA,
        );

      const slot = disponibilidad.slots.find(
        (item) => item.fechaHoraInicio === INICIO,
      );

      assert.ok(slot);
      assert.equal(slot.cuposOcupados, capacidad);
      assert.equal(slot.cuposDisponibles, 0);
    },
  );
}

// ============================================================
// TEST 5: CANCELACIÓN Y ROLLBACK
// ============================================================

test(
  "MySQL: cancelar libera el cupo y ROLLBACK conserva el estado",
  async () => {
    const comprador = await crearComprador(1);

    const reserva = await servicios().reserva.crear(
      comprador,
      {
        servicioId: servicio.id,
        fechaHoraInicio: INICIO,
      },
    );

    assert.equal(reserva.estado, "Confirmada");

    // No se puede modificar la duración mientras exista una
    // reserva confirmada futura que dependa de ella.
    await assert.rejects(
      servicios(otro).servicio.actualizar(
        comerciante,
        servicio.id,
        { duracionMinutos: 30 },
      ),
      (error) => error.status === 409,
    );

    const cancelada = await servicios().reserva.cancelar(
      comprador,
      reserva.id,
    );

    assert.equal(cancelada.estado, "Cancelada");

    // Cancelar nuevamente no genera un segundo cambio.
    const repetida = await servicios(otro).reserva.cancelar(
      comprador,
      reserva.id,
    );

    assert.equal(repetida.estado, "Cancelada");

    const disponibilidad =
      await servicios().reserva.disponibilidad(
        null,
        servicio.id,
        FECHA,
      );

    const slot = disponibilidad.slots.find(
      (item) => item.fechaHoraInicio === INICIO,
    );

    assert.ok(slot);
    assert.equal(slot.cuposDisponibles, 1);

    // Una modificación dentro de una transacción que falla
    // debe revertirse.
    await assert.rejects(
      repos.transaccion(async () => {
        await repos.reserva.update(reserva.id, {
          estado: "Confirmada",
        });

        throw new Error("rollback-reserva-test");
      }),
      /rollback-reserva-test/,
    );

    assert.equal(
      (await repos.reserva.find(reserva.id)).estado,
      "Cancelada",
    );
  },
);

// ============================================================
// TEST 6: FAVORITOS
// ============================================================

test(
  "MySQL: Favoritos comprueban propiedad, duplicidad y visibilidad",
  async () => {
    const comprador = await crearComprador(1);
    const otroComprador = await crearComprador(2);

    const producto = await crearProducto();

    const favorito = await servicios().favorito.crear(
      comprador,
      { productoId: producto.id },
    );

    assert.equal(favorito.usuarioId, comprador.id);
    assert.equal(favorito.productoId, producto.id);

    // La misma relación Usuario + Producto no se repite.
    await assert.rejects(
      servicios(otro).favorito.crear(
        comprador,
        { productoId: producto.id },
      ),
      (error) => error.status === 409,
    );

    const lista = await servicios().favorito.listar(
      comprador,
    );

    assert.equal(lista.length, 1);
    assert.equal(lista[0].disponible, true);
    assert.equal(lista[0].producto.id, producto.id);

    // Otro Comprador no puede eliminar este Favorito.
    await assert.rejects(
      servicios(otro).favorito.eliminar(
        otroComprador,
        favorito.id,
      ),
      (error) => error.status === 403,
    );

    // Desactivar el Producto conserva el Favorito,
    // pero deja de exponerlo como Producto disponible.
    await repos.producto.update(producto.id, {
      estado: "Inactivo",
    });

    const oculto = await servicios().favorito.listar(
      comprador,
    );

    assert.equal(oculto.length, 1);
    assert.equal(oculto[0].disponible, false);
    assert.equal(oculto[0].producto, null);

    // El propietario sí puede retirarlo.
    await servicios().favorito.eliminar(
      comprador,
      favorito.id,
    );

    assert.equal(
      (await servicios().favorito.listar(comprador)).length,
      0,
    );
  },
);

// ============================================================
// TEST 7: INTEGRIDAD FÍSICA DE SERVICIOS
// ============================================================

test(
  "MySQL: CHECK y FK protegen Servicio y Horario",
  async () => {
    // Estas pruebas consultan directamente el motor SQL
    // para confirmar que no dependemos solo del Service.

    await assert.rejects(
      pool.execute(
        `
        UPDATE servicio
        SET capacidad_simultanea = 0
        WHERE id_servicio = ?
        `,
        [servicio.id],
      ),
    );

    await assert.rejects(
      pool.execute(
        `
        UPDATE servicio
        SET duracion_minutos = 0
        WHERE id_servicio = ?
        `,
        [servicio.id],
      ),
    );

    await assert.rejects(
      pool.execute(
        `
        UPDATE horario_servicio
        SET dia_semana = 8
        WHERE id_servicio = ?
        `,
        [servicio.id],
      ),
    );

    await assert.rejects(
      pool.execute(
        `
        UPDATE horario_servicio
        SET id_servicio = 4294967295
        WHERE id_servicio = ?
        `,
        [servicio.id],
      ),
    );

    // Verificamos que las operaciones fallidas no
    // modificaron el registro original.
    const guardado = await repos.servicio.find(
      servicio.id,
    );

    assert.equal(guardado.duracionMinutos, 60);
    assert.equal(guardado.capacidadSimultanea, 1);
  },
);
