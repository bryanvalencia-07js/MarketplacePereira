const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  fixture,
  agenda,
  vendedor,
  comprador,
  ajeno,
  admin,
  fecha,
  inicio,
} = require("./pr6.helpers.cjs");
const status = (code) => (e) => e.status === code;
test("PR6 Servicio: referencias, validación, filtros públicos y propiedad", async () => {
  const c = fixture(),
    s = await agenda(c);
  assert.equal(s.precioReferencia, 0);
  assert.equal(s.categoriaId, 9);
  for (const body of [
    { nombre: "" },
    { descripcion: "" },
    { precioReferencia: -1 },
    { precioReferencia: 1.001 },
    { duracionMinutos: 0 },
    { duracionMinutos: 1441 },
    { duracionMinutos: 1.2 },
    { capacidadSimultanea: 0 },
    { capacidadSimultanea: 101 },
    { categoria: "Archivo" },
    { categoria: "Ausente" },
    { stock: 2 },
  ])
    await assert.rejects(c.s.actualizar(vendedor, s.id, body), status(400));
  await assert.rejects(
    c.s.actualizar(ajeno, s.id, { nombre: "Otro" }),
    status(403),
  );
  await assert.rejects(c.s.crear(comprador, {}), status(403));
  assert.equal(
    (
      await c.s.listar(null, {
        buscar: "Corte",
        negocioId: "1",
        categoria: "Belleza",
      })
    ).length,
    1,
  );
  await assert.rejects(c.s.listar(null, { estado: "Activo" }), status(403));
  await c.s.actualizar(vendedor, s.id, { estado: "Inactivo" });
  assert.equal((await c.s.listar(null)).length, 0);
  await assert.rejects(c.s.obtener(null, s.id), status(404));
  assert.equal((await c.s.listar(vendedor, { gestion: "true" })).length, 1);
  assert.equal((await c.s.listar(ajeno, { gestion: "true" })).length, 0);
  assert.equal((await c.s.listar(admin, { gestion: "true" })).length, 1);
});
test("PR6 Horario: ISO, ventanas, solapamiento, ownership y cambios", async () => {
  const c = fixture(),
    s = await agenda(c);
  for (const b of [
    { diaSemana: 0, horaInicio: "12:00", horaFin: "13:00" },
    { diaSemana: 8, horaInicio: "12:00", horaFin: "13:00" },
    { diaSemana: 2, horaInicio: "10:00", horaFin: "09:00" },
    { diaSemana: 2, horaInicio: "09:00", horaFin: "09:30" },
    { diaSemana: 2, horaInicio: "24:00", horaFin: "25:00" },
  ])
    await assert.rejects(c.h.crear(vendedor, s.id, b), status(400));
  await assert.rejects(
    c.h.crear(vendedor, s.id, {
      diaSemana: 1,
      horaInicio: "11:00",
      horaFin: "13:00",
    }),
    status(409),
  );
  const h = await c.h.crear(vendedor, s.id, {
    diaSemana: 1,
    horaInicio: "12:00",
    horaFin: "13:00",
  });
  await assert.rejects(
    c.h.actualizar(ajeno, h.id, { horaFin: "14:00" }),
    status(403),
  );
  await c.h.actualizar(vendedor, h.id, { horaFin: "14:00" });
  await c.h.eliminar(vendedor, h.id);
  assert.equal((await c.h.listar(null, s.id)).length, 1);
});
test("PR6 Disponibilidad: slots completos, UTC/Bogotá, fechas y horarios", async () => {
  const c = fixture(),
    s = await agenda(c);
  const d = await c.r.disponibilidad(null, s.id, fecha);
  assert.equal(d.zonaHoraria, "America/Bogota");
  assert.equal(d.slots.length, 3);
  assert.equal(d.slots[0].fechaHoraInicio, inicio);
  assert.equal(d.slots[2].fechaHoraInicio, `${fecha}T16:00:00.000Z`);
  assert.equal(d.slots[0].cuposDisponibles, 1);
  assert.equal(
    (await c.r.disponibilidad(null, s.id, "2099-01-06")).slots.length,
    0,
  );
  for (const f of ["2099-02-31", "99-01-05", "x"])
    await assert.rejects(c.r.disponibilidad(null, s.id, f), status(400));
  for (const fechaHoraInicio of [
    "2000-01-03T14:00:00Z",
    `${fecha}T14:30:00Z`,
    `${fecha}T17:00:00Z`,
    `${fecha}T14:00:00`,
    "2099-02-31T14:00:00Z",
  ])
    await assert.rejects(
      c.r.crear(comprador, { servicioId: s.id, fechaHoraInicio }),
      status(400),
    );
});
test("PR6 Reserva: capacidad concurrente, sesión, cancelación e historial", async () => {
  const c = fixture(),
    s = await agenda(c);
  const b = { servicioId: s.id, fechaHoraInicio: inicio };
  await assert.rejects(c.r.crear(vendedor, b), status(403));
  await assert.rejects(c.r.crear(null, b), status(401));
  await assert.rejects(
    c.r.crear(comprador, { ...b, usuarioId: 5 }),
    status(400),
  );
  const intentos = await Promise.allSettled([
    c.r.crear(comprador, b),
    c.r.crear({ id: 5, rol: "Comprador" }, b),
  ]);
  assert.equal(intentos.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    intentos.find((r) => r.status === "rejected").reason.status,
    409,
  );
  const reserva = intentos.find((r) => r.status === "fulfilled").value;
  assert.equal(reserva.estado, "Confirmada");
  assert.equal(
    (await c.r.disponibilidad(null, s.id, fecha)).slots[0].disponible,
    false,
  );
  assert.equal(
    (await c.r.mias({ id: reserva.usuarioId, rol: "Comprador" })).length,
    1,
  );
  assert.equal((await c.r.gestion(ajeno)).length, 0);
  assert.equal((await c.r.gestion(vendedor)).length, 1);
  await assert.rejects(c.r.obtener(ajeno, reserva.id), status(403));
  await assert.rejects(
    c.r.cancelar({ id: 99, rol: "Comprador" }, reserva.id),
    status(403),
  );
  await assert.rejects(c.r.cancelar(ajeno, reserva.id), status(403));
  await assert.rejects(c.s.eliminar(vendedor, s.id), status(409));
  await c.r.cancelar(vendedor, reserva.id);
  await c.r.cancelar(vendedor, reserva.id);
  assert.equal(
    (await c.r.disponibilidad(null, s.id, fecha)).slots[0].cuposDisponibles,
    1,
  );
  await assert.rejects(c.s.eliminar(vendedor, s.id), status(409));
});
test("PR6 capacidad >1, cambios con reservas y desactivación conservan historial", async () => {
  const c = fixture(),
    s = await agenda(c, 3),
    b = { servicioId: s.id, fechaHoraInicio: inicio };
  const result = await Promise.allSettled(
    Array.from({ length: 5 }, () => c.r.crear(comprador, b)),
  );
  assert.equal(result.filter((x) => x.status === "fulfilled").length, 3);
  assert.ok(
    result
      .filter((x) => x.status === "rejected")
      .every((x) => x.reason.status === 409),
  );
  await assert.rejects(
    c.s.actualizar(vendedor, s.id, { duracionMinutos: 30 }),
    status(409),
  );
  await assert.rejects(
    c.s.actualizar(vendedor, s.id, { capacidadSimultanea: 2 }),
    status(409),
  );
  await c.s.actualizar(vendedor, s.id, { capacidadSimultanea: 4 });
  const horarios = await c.h.listar(vendedor, s.id);
  await c.h.eliminar(vendedor, horarios[0].id);
  assert.equal((await c.r.mias(comprador)).length, 3);
  await c.s.actualizar(vendedor, s.id, { estado: "Inactivo" });
  await assert.rejects(c.r.crear(comprador, b), status(404));
  assert.equal((await c.r.gestion(admin)).length, 3);
});
test("PR6 disponibilidad respeta reservas conservadas tras mover el horario", async () => {
  const c = fixture(),
    s = await agenda(c);
  await c.r.crear(comprador, { servicioId: s.id, fechaHoraInicio: inicio });
  const [h] = await c.h.listar(vendedor, s.id);
  await c.h.actualizar(vendedor, h.id, {
    horaInicio: "09:30",
    horaFin: "12:30",
  });
  const d = await c.r.disponibilidad(null, s.id, fecha);
  assert.equal(d.slots[0].cuposDisponibles, 0);
  await assert.rejects(
    c.r.crear(comprador, {
      servicioId: s.id,
      fechaHoraInicio: d.slots[0].fechaHoraInicio,
    }),
    status(409),
  );
  assert.equal(d.slots[1].cuposDisponibles, 1);
});
test("PR6 actividad de negocio y categoría restringe consultas/reservas/favoritos", async () => {
  for (const caso of ["negocio", "categoria"]) {
    const c = fixture(),
      s = await agenda(c);
    if (caso === "negocio")
      await c.repos.negocio.update(1, { estado: "Inactivo" });
    else
      c.repos.categoria = {
        ...c.repos.categoria,
        find: async () => ({ id: 9, nombre: "Belleza", estado: "Inactivo" }),
        list: async () => [{ id: 9, nombre: "Belleza", estado: "Inactivo" }],
      };
    assert.equal((await c.s.listar(null)).length, 0);
    await assert.rejects(
      c.r.crear(comprador, { servicioId: s.id, fechaHoraInicio: inicio }),
      status(404),
    );
    await assert.rejects(c.f.crear(comprador, { productoId: 1 }), status(404));
  }
});
test("PR6 Favorito: asociación única, sesión, ownership, producto y cascade", async () => {
  const c = fixture();
  await assert.rejects(c.f.crear(vendedor, { productoId: 1 }), status(403));
  await assert.rejects(c.f.listar(null), status(401));
  await assert.rejects(c.f.crear(comprador, { productoId: 99 }), status(404));
  await assert.rejects(
    c.f.crear(comprador, { productoId: 1, usuarioId: 5 }),
    status(400),
  );
  const f = await c.f.crear(comprador, { productoId: 1 });
  await assert.rejects(c.f.crear(comprador, { productoId: 1 }), status(409));
  assert.equal((await c.f.listar(comprador)).length, 1);
  assert.equal((await c.f.listar({ id: 5, rol: "Comprador" })).length, 0);
  await assert.rejects(
    c.f.eliminar({ id: 5, rol: "Comprador" }, f.id),
    status(403),
  );
  await c.f.eliminar(comprador, f.id);
  await c.f.crear(comprador, { productoId: 1 });
  await c.repos.producto.delete(1);
  assert.equal((await c.f.listar(comprador)).length, 0);
});
test("PR6 horarios concurrentes no se superponen y baja de capacidad usa pico real", async () => {
  const c = fixture(),
    s = await agenda(c, 2);
  const rr = await Promise.allSettled([
    c.h.crear(vendedor, s.id, {
      diaSemana: 2,
      horaInicio: "09:00",
      horaFin: "11:00",
    }),
    c.h.crear(vendedor, s.id, {
      diaSemana: 2,
      horaInicio: "10:00",
      horaFin: "12:00",
    }),
  ]);
  assert.equal(rr.filter((r) => r.status === "fulfilled").length, 1);
  await c.r.crear(comprador, { servicioId: s.id, fechaHoraInicio: inicio });
  await c.r.crear(comprador, {
    servicioId: s.id,
    fechaHoraInicio: `${fecha}T15:00:00Z`,
  });
  await c.s.actualizar(vendedor, s.id, { capacidadSimultanea: 1 });
});
