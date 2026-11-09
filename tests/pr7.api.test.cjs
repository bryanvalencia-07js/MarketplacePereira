const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { createApplication } = require("../backend/app");
const { hashPassword } = require("../backend/utils/password");
const { fixture } = require("./pr6.helpers.cjs");
let server, base, repos;
const clave = "Una-clave-de-prueba-2026";
before(async () => {
  ({ repos } = fixture());
  const hash = await hashPassword(clave);
  for (const u of await repos.usuario.list())
    await repos.usuario.update(u.id, {
      nombre: "Test",
      apellido: "PR7",
      correo: `u${u.id}@example.invalid`,
      passwordHash: hash,
      estado: "Activo",
    });
  await repos.producto.update(1, { precio: 30000, stock: 5 });
  server = (await createApplication({ repositories: repos })).app.listen(
    0,
    "127.0.0.1",
  );
  await new Promise((ok) => server.once("listening", ok));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => new Promise((ok) => server.close(ok)));
async function req(path, method = "GET", body, auth = {}, csrf = true) {
  const r = await fetch(base + path, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(auth.cookie ? { Cookie: auth.cookie } : {}),
      ...(csrf && auth.csrf ? { "X-CSRF-Token": auth.csrf } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: r.status, json: await r.json(), headers: r.headers };
}
async function login(id) {
  const r = await req("/auth/login", "POST", {
    correo: `u${id}@example.invalid`,
    password: clave,
  });
  assert.equal(r.status, 200);
  return {
    cookie: r.headers.get("set-cookie").split(";")[0],
    csrf: r.json.data.csrfToken,
  };
}
const body = { items: [{ productoId: 1, cantidad: 1 }] };
test("PR7 API: sesión, Comprador, CSRF y campos inyectados", async () => {
  const b = await login(2),
    m = await login(1),
    a = await login(4);
  assert.equal((await req("/pedidos", "POST", body)).status, 401);
  for (const auth of [m, a])
    assert.equal((await req("/pedidos", "POST", body, auth)).status, 403);
  assert.equal((await req("/pedidos", "POST", body, b, false)).status, 403);
  for (const campo of [
    "usuarioId",
    "idUsuario",
    "id_usuario",
    "negocioId",
    "estado",
    "precioUnitario",
    "total",
    "subtotal",
  ])
    assert.equal(
      (await req("/pedidos", "POST", { ...body, [campo]: 1 }, b)).status,
      400,
    );
  assert.equal(
    (
      await req(
        "/pedidos",
        "POST",
        { items: [{ ...body.items[0], precioUnitario: 1 }] },
        b,
      )
    ).status,
    400,
  );
});
test("PR7 API: pedido real, historial, ownership y estados", async () => {
  const b = await login(2),
    o = await login(5),
    m = await login(1),
    x = await login(3),
    a = await login(4);
  const r = await req("/pedidos", "POST", body, b);
  assert.equal(r.status, 201);
  const p = r.json.data[0];
  assert.equal(p.usuarioId, 2);
  assert.equal(p.total, 30000);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal(
    (await req("/pedidos/mios", "GET", undefined, b)).json.data.length,
    1,
  );
  assert.equal(
    (await req("/pedidos/mios", "GET", undefined, o)).json.data.length,
    0,
  );
  for (const auth of [o, x]) {
    assert.equal(
      (await req(`/pedidos/${p.id}`, "GET", undefined, auth)).status,
      403,
    );
    assert.equal(
      (await req(`/pedidos/${p.id}/cancelar`, "PATCH", {}, auth)).status,
      403,
    );
    assert.equal(
      (
        await req(
          `/pedidos/${p.id}/estado`,
          "PATCH",
          { estado: "Confirmado" },
          auth,
        )
      ).status,
      403,
    );
  }
  assert.equal(
    (await req("/pedidos/gestion", "GET", undefined, b)).status,
    403,
  );
  assert.equal(
    (await req("/pedidos/gestion?negocioId=1", "GET", undefined, x)).json.data
      .length,
    0,
  );
  for (const auth of [m, a])
    assert.equal(
      (await req("/pedidos/gestion", "GET", undefined, auth)).json.data.length,
      1,
    );
  assert.equal(
    (await req(`/pedidos/${p.id}/estado`, "PATCH", { estado: "Completado" }, m))
      .status,
    409,
  );
  assert.equal(
    (await req(`/pedidos/${p.id}/estado`, "PATCH", { estado: "Confirmado" }, m))
      .status,
    200,
  );
  assert.equal(
    (await req(`/pedidos/${p.id}/cancelar`, "PATCH", {}, b)).status,
    409,
  );
  assert.equal(
    (await req(`/pedidos/${p.id}/estado`, "PATCH", { estado: "Completado" }, a))
      .status,
    200,
  );
  assert.equal(
    (await req(`/pedidos/${p.id}/cancelar`, "PATCH", {}, a)).status,
    409,
  );
  assert.equal(
    (await req(`/pedidos/${p.id}`, "DELETE", undefined, a)).status,
    404,
  );
});
test("PR7 API: concurrencia HTTP, 409 seguro y cancelación idempotente", async () => {
  const b = await login(2),
    o = await login(5);
  await repos.producto.update(1, { stock: 1 });
  const rr = await Promise.all([
    req("/pedidos", "POST", body, b),
    req("/pedidos", "POST", body, o),
  ]);
  assert.deepEqual(rr.map((x) => x.status).sort(), [201, 409]);
  const fallo = rr.find((x) => x.status === 409).json;
  assert.match(fallo.mensaje, /producto #1/);
  assert.doesNotMatch(JSON.stringify(fallo), /SELECT|UPDATE|stack|password/i);
  const p = rr.find((x) => x.status === 201).json.data[0],
    auth = p.usuarioId === 2 ? b : o;
  for (let i = 0; i < 2; i++)
    assert.equal(
      (await req(`/pedidos/${p.id}/cancelar`, "PATCH", {}, auth)).status,
      200,
    );
  assert.equal((await repos.producto.find(1)).stock, 1);
});
