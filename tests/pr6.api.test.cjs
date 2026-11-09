const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { createApplication } = require("../backend/app");
const { hashPassword } = require("../backend/utils/password");
const { fixture, agenda, inicio } = require("./pr6.helpers.cjs");
let server, base, ctx, hash;
const clave = "Una-clave-de-prueba-2026";
before(async () => {
  hash = await hashPassword(clave);
  ctx = fixture();
  for (const u of await ctx.repos.usuario.list())
    await ctx.repos.usuario.update(u.id, {
      nombre: "Usuario",
      apellido: "Prueba",
      correo: `u${u.id}@example.invalid`,
      estado: "Activo",
      passwordHash: hash,
    });
  await agenda(ctx);
  const sistema = await createApplication({ repositories: ctx.repos });
  server = sistema.app.listen(0, "127.0.0.1");
  await new Promise((ok) => server.once("listening", ok));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((ok) => server.close(ok));
});
async function peticion(ruta, method = "GET", body, auth = {}, csrf = true) {
  const res = await fetch(base + "/api" + ruta, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(auth.cookie ? { Cookie: auth.cookie } : {}),
      ...(auth.csrf && csrf ? { "X-CSRF-Token": auth.csrf } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, json: await res.json(), headers: res.headers };
}
async function login(id) {
  const r = await peticion("/auth/login", "POST", {
    correo: `u${id}@example.invalid`,
    password: clave,
  });
  assert.equal(r.status, 200);
  return {
    cookie: r.headers.get("set-cookie").split(";")[0],
    csrf: r.json.data.csrfToken,
  };
}
test("PR6 API: catálogo, detalle, horarios, filtros y disponibilidad inequívoca", async () => {
  for (const ruta of [
    "/servicios",
    "/servicios/1",
    "/servicios/1/horarios",
    "/servicios/1/disponibilidad?fecha=2099-01-05",
  ]) {
    const r = await peticion(ruta);
    assert.equal(r.status, 200, ruta);
    assert.equal(r.headers.get("cache-control"), "no-store");
  }
  assert.equal((await peticion("/servicios?gestion=true")).status, 401);
  assert.equal((await peticion("/servicios?estado=Inactivo")).status, 403);
  assert.equal(
    (await peticion("/servicios/1/disponibilidad?fecha=2099-02-30")).status,
    400,
  );
  assert.equal((await peticion("/servicios/99")).status, 404);
});
test("PR6 API: roles, CSRF y ownership de servicios y horarios", async () => {
  const a = await login(1),
    otro = await login(3),
    c = await login(2);
  assert.equal((await peticion("/servicios", "POST", {})).status, 401);
  assert.equal((await peticion("/servicios", "POST", {}, c)).status, 403);
  assert.equal(
    (await peticion("/servicios/1", "PUT", { nombre: "Nuevo" }, a, false))
      .status,
    403,
  );
  assert.equal(
    (await peticion("/servicios/1", "PUT", { nombre: "Nuevo" }, otro)).status,
    403,
  );
  assert.equal(
    (
      await peticion(
        "/servicios/1/horarios",
        "POST",
        { diaSemana: 3, horaInicio: "09:00", horaFin: "11:00" },
        otro,
      )
    ).status,
    403,
  );
  const h = await peticion(
    "/servicios/1/horarios",
    "POST",
    { diaSemana: 3, horaInicio: "09:00", horaFin: "11:00" },
    a,
  );
  assert.equal(h.status, 201);
  assert.equal(
    (
      await peticion(
        `/horarios-servicio/${h.json.data.id}`,
        "PUT",
        { horaFin: "12:00" },
        a,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await peticion(
        `/horarios-servicio/${h.json.data.id}`,
        "DELETE",
        undefined,
        a,
      )
    ).status,
    200,
  );
  assert.equal(
    (await peticion("/servicios/1", "PUT", { nombre: "Corte local" }, a))
      .status,
    200,
  );
});
test("PR6 API: reserva automática, concurrencia HTTP y aislamiento entre roles", async () => {
  const c = await login(2),
    b = await login(5),
    m = await login(1),
    otro = await login(3),
    admin = await login(4),
    body = { servicioId: 1, fechaHoraInicio: inicio };
  assert.equal((await peticion("/reservas", "POST", body, m)).status, 403);
  assert.equal(
    (await peticion("/reservas", "POST", { ...body, usuarioId: 5 }, c)).status,
    400,
  );
  assert.equal(
    (await peticion("/reservas", "POST", body, c, false)).status,
    403,
  );
  const rr = await Promise.all([
    peticion("/reservas", "POST", body, c),
    peticion("/reservas", "POST", body, b),
  ]);
  assert.deepEqual(rr.map((r) => r.status).sort(), [201, 409]);
  const reserva = rr.find((r) => r.status === 201).json.data;
  assert.equal(reserva.estado, "Confirmada");
  assert.ok([2, 5].includes(reserva.usuarioId));
  const auth = reserva.usuarioId === 2 ? c : b;
  assert.equal(
    (await peticion("/reservas/mias", "GET", undefined, auth)).json.data.length,
    1,
  );
  assert.equal(
    (await peticion("/reservas/gestion", "GET", undefined, otro)).json.data
      .length,
    0,
  );
  assert.equal(
    (await peticion("/reservas/gestion", "GET", undefined, m)).json.data.length,
    1,
  );
  assert.equal(
    (await peticion("/reservas/gestion", "GET", undefined, c)).status,
    403,
  );
  assert.equal(
    (await peticion(`/reservas/${reserva.id}`, "GET", undefined, otro)).status,
    403,
  );
  assert.equal(
    (await peticion(`/reservas/${reserva.id}/cancelar`, "PATCH", {}, otro))
      .status,
    403,
  );
  assert.equal(
    (await peticion(`/reservas/${reserva.id}/cancelar`, "PATCH", {}, admin))
      .status,
    200,
  );
  assert.equal(
    (await peticion(`/reservas/${reserva.id}`, "DELETE", undefined, admin))
      .status,
    404,
  );
});
test("PR6 API: favoritos del comprador, duplicados, propiedad y errores seguros", async () => {
  const c = await login(2),
    b = await login(5),
    m = await login(1);
  assert.equal((await peticion("/favoritos")).status, 401);
  assert.equal((await peticion("/favoritos", "GET", undefined, m)).status, 403);
  assert.equal(
    (await peticion("/favoritos", "POST", { productoId: 1, usuarioId: 5 }, c))
      .status,
    400,
  );
  const f = await peticion("/favoritos", "POST", { productoId: 1 }, c);
  assert.equal(f.status, 201);
  assert.equal(
    (await peticion("/favoritos", "POST", { productoId: 1 }, c)).status,
    409,
  );
  assert.equal(
    (await peticion("/favoritos", "POST", { productoId: 999 }, c)).status,
    404,
  );
  assert.equal(
    (await peticion("/favoritos", "GET", undefined, b)).json.data.length,
    0,
  );
  assert.equal(
    (await peticion(`/favoritos/${f.json.data.id}`, "DELETE", undefined, b))
      .status,
    403,
  );
  assert.equal(
    (await peticion(`/favoritos/${f.json.data.id}`, "DELETE", undefined, c))
      .status,
    200,
  );
});
