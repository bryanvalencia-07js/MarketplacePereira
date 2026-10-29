const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { createApplication } = require("../backend/app");
const { verifyPassword } = require("../backend/utils/password");
let servidor, base, sistema;
const clave = "Una-clave-de-prueba-2026";
const imagen =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jI5kAAAAASUVORK5CYII=";
function cliente() {
  let cookie = "",
    csrf = "";
  return {
    async pedir(
      ruta,
      { method = "GET", body, headers = {}, esperado = 200 } = {},
    ) {
      const r = await fetch(base + "/api" + ruta, {
        method,
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await r.json();
      assert.equal(r.status, esperado, JSON.stringify(json));
      if (r.headers.get("set-cookie"))
        cookie = r.headers.get("set-cookie").split(";")[0];
      if (json.data?.csrfToken) csrf = json.data.csrfToken;
      return { json, headers: r.headers };
    },
    get cookie() {
      return cookie;
    },
  };
}
async function registro(
  rol = "Comerciante",
  correo = "comerciante@example.invalid",
) {
  const c = cliente();
  const { json } = await c.pedir("/auth/registro", {
    method: "POST",
    body: {
      nombre: "Prueba",
      apellido: "Pereira",
      correo,
      password: clave,
      rol,
    },
    esperado: 201,
  });
  await c.pedir("/auth/login", {
    method: "POST",
    body: { correo, password: clave },
  });
  return { c, usuario: json.data };
}
async function admin() {
  const c = cliente();
  await c.pedir("/auth/login", {
    method: "POST",
    body: { correo: "admin@example.invalid", password: clave },
  });
  return c;
}
async function comercio(c) {
  return (
    await c.pedir("/negocios", {
      method: "POST",
      body: {
        nombre: "Café Pereira",
        categoria: "Alimentos",
        telefono: "3001234567",
        direccion: "Calle 1",
      },
      esperado: 201,
    })
  ).json.data;
}
async function producto(c, negocioId) {
  return (
    await c.pedir("/productos", {
      method: "POST",
      body: {
        negocioId,
        nombre: "Café",
        descripcion: "Tueste artesanal",
        categoria: "Alimentos",
        precio: 10000,
        stock: 3,
        imagen,
      },
      esperado: 201,
    })
  ).json.data;
}
beforeEach(async () => {
  sistema = await createApplication({
    admin: { correo: "admin@example.invalid", password: clave },
  });
  await new Promise((resolve) => {
    servidor = sistema.app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${servidor.address().port}`;
});
afterEach(async () => {
  await new Promise((resolve) => servidor.close(resolve));
});

test("auth: hash seguro, cookie HttpOnly, me, logout y respuesta sin credenciales", async () => {
  const { c, usuario } = await registro(
    "Comprador",
    "comprador@example.invalid",
  );
  assert.equal(usuario.password, undefined);
  assert.equal(usuario.passwordHash, undefined);
  const guardado = (await sistema.repositories.usuario.list()).find(
    (u) => u.id === usuario.id,
  );
  assert.notEqual(guardado.passwordHash, clave);
  assert.equal(await verifyPassword(clave, guardado.passwordHash), true);
  const { json } = await c.pedir("/auth/me");
  assert.equal(json.data.usuario.id, usuario.id);
  const raw = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      correo: "comprador@example.invalid",
      password: clave,
    }),
  });
  assert.match(raw.headers.get("set-cookie"), /HttpOnly/);
  assert.match(raw.headers.get("set-cookie"), /SameSite=Strict/);
  await c.pedir("/auth/logout", { method: "POST" });
  await c.pedir("/auth/me", { esperado: 401 });
});

test("registro no permite autoasignar Administrador ni campos protegidos", async () => {
  const c = cliente();
  await c.pedir("/auth/registro", {
    method: "POST",
    body: {
      nombre: "A",
      apellido: "B",
      correo: "a@example.invalid",
      password: clave,
      rol: "Administrador",
    },
    esperado: 400,
  });
  await c.pedir("/auth/registro", {
    method: "POST",
    body: {
      nombre: "A",
      apellido: "B",
      correo: "a@example.invalid",
      password: clave,
      rol: "Comprador",
      estado: "Activo",
    },
    esperado: 400,
  });
  await c.pedir("/auth/registro", {
    method: "POST",
    body: {
      nombre: "A",
      apellido: "B",
      correo: "a@example.invalid",
      password: "corta",
      rol: "Comprador",
    },
    esperado: 400,
  });
});

test("roles: anónimo 401 y comprador 403 en CRUD administrativo", async () => {
  await cliente().pedir("/usuarios", { esperado: 401 });
  const { c } = await registro("Comprador", "buyer@example.invalid");
  await c.pedir("/usuarios", { esperado: 403 });
  await c.pedir("/negocios", { method: "POST", body: {}, esperado: 403 });
  await c.pedir("/productos?gestion=true", { esperado: 403 });
});

test("CSRF y origen: deniega escritura sin token y solicitudes de otro origen", async () => {
  const c = await admin();
  await c.pedir("/usuarios/1", {
    method: "PUT",
    body: { nombre: "Cambio" },
    headers: { "X-CSRF-Token": "" },
    esperado: 403,
  });
  await c.pedir("/usuarios/1", {
    method: "PUT",
    body: { nombre: "Cambio" },
    headers: { Origin: "https://otro.example.invalid" },
    esperado: 403,
  });
  await cliente().pedir("/auth/login", {
    method: "POST",
    body: { correo: "admin@example.invalid", password: clave },
    headers: { Origin: "https://otro.example.invalid" },
    esperado: 403,
  });
});

test("propiedad: comerciante no puede leer gestión ni mutar recursos ajenos", async () => {
  const uno = await registro();
  const dos = await registro("Comerciante", "otro@example.invalid");
  const n = await comercio(uno.c);
  const p = await producto(uno.c, n.id);
  await dos.c.pedir(`/negocios/${n.id}`, {
    method: "PUT",
    body: { nombre: "Robo" },
    esperado: 403,
  });
  await dos.c.pedir(`/productos/${p.id}`, {
    method: "PUT",
    body: { stock: 4 },
    esperado: 403,
  });
  await dos.c.pedir(`/productos/${p.id}`, { method: "DELETE", esperado: 403 });
  await dos.c.pedir("/negocios", {
    method: "POST",
    body: {
      usuarioId: uno.usuario.id,
      nombre: "Robo",
      categoria: "A",
      telefono: "T",
      direccion: "D",
    },
    esperado: 403,
  });
  assert.equal(
    (await dos.c.pedir("/productos?gestion=true")).json.data.length,
    0,
  );
});

test("CRUD y filtros: timestamps, datos vigentes y relaciones válidas", async () => {
  const { c } = await registro();
  const n = await comercio(c);
  const p = await producto(c, n.id);
  assert.ok(p.createdAt);
  assert.ok(p.updatedAt);
  assert.equal(
    (
      await cliente().pedir(
        "/productos?buscar=artesanal&categoria=Alimentos&negocioId=" + n.id,
      )
    ).json.data.length,
    1,
  );
  await c.pedir(`/productos/${p.id}`, {
    method: "PUT",
    body: { nombre: "Nuevo café", stock: 5 },
  });
  assert.equal((await c.pedir(`/productos/${p.id}`)).json.data.stock, 5);
  await c.pedir(`/negocios/${n.id}`, { method: "DELETE", esperado: 400 });
  await c.pedir(`/productos/${p.id}`, { method: "DELETE" });
  await c.pedir(`/productos/${p.id}`, { esperado: 404 });
  await c.pedir(`/negocios/${n.id}`, { method: "DELETE" });
});

test("inactivos y agotados: catálogo público, detalle y visitas coherentes", async () => {
  const { c } = await registro();
  const n = await comercio(c);
  const p = await producto(c, n.id);
  await cliente().pedir(`/productos/${p.id}/visita`, { method: "POST" });
  assert.equal((await c.pedir(`/productos/${p.id}`)).json.data.popularidad, 1);
  await c.pedir(`/productos/${p.id}`, { method: "PUT", body: { stock: 0 } });
  await cliente().pedir(`/productos/${p.id}/visita`, {
    method: "POST",
    esperado: 404,
  });
  await c.pedir(`/negocios/${n.id}`, {
    method: "PUT",
    body: { estado: "Inactivo" },
  });
  assert.deepEqual((await cliente().pedir("/productos")).json.data, []);
  assert.deepEqual((await cliente().pedir("/negocios")).json.data, []);
  await cliente().pedir(`/productos/${p.id}`, { esperado: 404 });
  assert.equal((await c.pedir("/productos?gestion=true")).json.data.length, 1);
});

test("administración: dueño real, correo único, revocación y último admin", async () => {
  const a = await admin();
  const { c, usuario } = await registro("Comprador", "buyer@example.invalid");
  await a.pedir("/usuarios/1", {
    method: "PUT",
    body: { estado: "Inactivo" },
    esperado: 400,
  });
  await a.pedir(`/usuarios/${usuario.id}`, {
    method: "PUT",
    body: { correo: "admin@example.invalid" },
    esperado: 400,
  });
  await a.pedir(`/usuarios/${usuario.id}`, {
    method: "PUT",
    body: { estado: "Inactivo" },
  });
  await c.pedir("/auth/me", { esperado: 401 });
  await a.pedir(`/usuarios/${usuario.id}`, { method: "DELETE" });
});

test("concurrencia: correo y comercio únicos incluso en solicitudes simultáneas", async () => {
  const body = {
    nombre: "A",
    apellido: "B",
    correo: "igual@example.invalid",
    password: clave,
    rol: "Comerciante",
  };
  const respuestas = await Promise.all(
    [1, 2].map(() =>
      fetch(base + "/api/auth/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    ),
  );
  assert.deepEqual(respuestas.map((r) => r.status).sort(), [201, 400]);
  const { c } = await registro();
  await comercio(c);
  await c.pedir("/negocios", {
    method: "POST",
    body: { nombre: "Segundo", categoria: "A", telefono: "T", direccion: "D" },
    esperado: 400,
  });
});

test("validación: stock entero, imagen real, precio finito, IDs y recurso inexistente", async () => {
  const { c } = await registro();
  const n = await comercio(c);
  const p = await producto(c, n.id);
  for (const body of [
    { stock: -1 },
    { stock: 1.5 },
    { precio: 0 },
    { imagen: "data:image/png;base64,ZmFsc28=" },
    { popularidad: 99 },
    { negocioId: 999 },
  ])
    await c.pedir(`/productos/${p.id}`, { method: "PUT", body, esperado: 400 });
  await c.pedir("/productos/no-numero", { esperado: 400 });
  await c.pedir("/productos/999", { esperado: 404 });
  await c.pedir("/ruta-no-existe", { esperado: 404 });
});

test("cabeceras de seguridad y JSON inválido controlado", async () => {
  const r = await fetch(base + "/index.html");
  assert.match(r.headers.get("content-security-policy"), /script-src 'self'/);
  assert.doesNotMatch(
    r.headers.get("content-security-policy"),
    /unsafe-inline/,
  );
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  const malo = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{roto",
  });
  assert.equal(malo.status, 400);
  assert.deepEqual(Object.keys(await malo.json()).sort(), ["mensaje", "ok"]);
});

test("persistencia desacoplada: copias y IDs no reutilizados", async () => {
  const repo = sistema.repositories.producto;
  const a = await repo.create({ nombre: "A" });
  a.nombre = "Mutado";
  assert.equal((await repo.find(a.id)).nombre, "A");
  await repo.delete(a.id);
  const b = await repo.create({ nombre: "B" });
  assert.ok(b.id > a.id);
});

test("errores internos no filtran detalles; repositorio reemplazable", async () => {
  const original = sistema.repositories.producto.list;
  sistema.repositories.producto.list = async () => {
    throw new Error("INTERNAL_SECRET");
  };
  const previo = console.error;
  console.error = () => {};
  try {
    const { json } = await cliente().pedir("/productos", { esperado: 500 });
    assert.doesNotMatch(JSON.stringify(json), /INTERNAL_SECRET|stack/);
  } finally {
    console.error = previo;
    sistema.repositories.producto.list = original;
  }
});

test("login: error uniforme y límite de intentos por correo", async () => {
  const c = cliente();
  for (let i = 0; i < 12; i++)
    await c.pedir("/auth/login", {
      method: "POST",
      body: { correo: "no-existe@example.invalid", password: clave },
      esperado: 401,
    });
  const { json, headers } = await c.pedir("/auth/login", {
    method: "POST",
    body: { correo: "no-existe@example.invalid", password: clave },
    esperado: 429,
  });
  assert.match(json.mensaje, /Demasiados/);
  assert.ok(headers.get("retry-after"));
});

test("sesiones: expiración determinista y token distinto por login", async () => {
  const { createAuthService } = require("../backend/services/auth.service");
  let reloj = Date.now();
  const auth = createAuthService(sistema.repositories, {
    ttl: 1000,
    ahora: () => reloj,
  });
  const a = await auth.login({
    correo: "admin@example.invalid",
    password: clave,
  });
  const b = await auth.login({
    correo: "admin@example.invalid",
    password: clave,
  });
  assert.notEqual(a.token, b.token);
  assert.ok(await auth.resolver(a.token));
  reloj += 1001;
  assert.equal(await auth.resolver(a.token), null);
});

test("administrador: CRUD de cuentas, asignación de comercio y propietario actualizado", async () => {
  const a = await admin();
  const u = (
    await a.pedir("/usuarios", {
      method: "POST",
      body: {
        nombre: "Nueva",
        apellido: "Dueña",
        correo: "dueña@example.invalid",
        rol: "Comerciante",
        password: clave,
      },
      esperado: 201,
    })
  ).json.data;
  const n = (
    await a.pedir("/negocios", {
      method: "POST",
      body: {
        usuarioId: u.id,
        nombre: "Tienda",
        categoria: "Ropa",
        direccion: "Calle",
        telefono: "300",
      },
      esperado: 201,
    })
  ).json.data;
  assert.equal(n.usuarioId, u.id);
  await a.pedir(`/usuarios/${u.id}`, {
    method: "PUT",
    body: { nombre: "Actualizada" },
  });
  assert.match(
    (await cliente().pedir("/negocios/" + n.id)).json.data.propietario,
    /Actualizada/,
  );
  await a.pedir(`/usuarios/${u.id}`, {
    method: "PUT",
    body: { rol: "Comprador" },
    esperado: 400,
  });
  await a.pedir(`/usuarios/${u.id}`, { method: "DELETE", esperado: 400 });
  await a.pedir(`/negocios/${n.id}`, { method: "DELETE" });
  await a.pedir(`/usuarios/${u.id}`, { method: "DELETE" });
});

test("concurrencia real: dos solicitudes de creación no duplican comercio", async () => {
  const { c } = await registro();
  const { json } = await c.pedir("/auth/me");
  const body = {
    nombre: "Un comercio",
    categoria: "Alimentos",
    direccion: "Calle",
    telefono: "300",
  };
  const respuestas = await Promise.all(
    [1, 2].map(() =>
      fetch(base + "/api/negocios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: c.cookie,
          "X-CSRF-Token": json.data.csrfToken,
        },
        body: JSON.stringify(body),
      }),
    ),
  );
  assert.deepEqual(respuestas.map((r) => r.status).sort(), [201, 400]);
});

test("solicitud demasiado grande se rechaza sin detalles internos", async () => {
  const r = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "x".repeat(2100000) }),
  });
  assert.equal(r.status, 413);
  const j = await r.json();
  assert.equal(j.ok, false);
  assert.doesNotMatch(JSON.stringify(j), /stack|node_modules/);
});

test("contrato de repositorios: rechaza adaptadores incompletos al iniciar", async () => {
  await assert.rejects(createApplication({ repositories: {} }), /Repositorio/);
});

test("cuerpos comprimidos se rechazan antes del parser y consultas usan parser simple", async () => {
  const { gzipSync } = require("node:zlib");
  const cuerpo = Buffer.concat([
    gzipSync(Buffer.from("{}")),
    Buffer.from("trailing-bytes"),
  ]);
  const r = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" },
    body: cuerpo,
  });
  assert.equal(r.status, 415);
  assert.match((await r.json()).mensaje, /comprimidos/);
  assert.equal(sistema.app.get("query parser"), "simple");
});

test("resumen público atraviesa controller/service y expone solo conteos", async () => {
  const { c } = await registro();
  const n = await comercio(c);
  await producto(c, n.id);
  const { json } = await cliente().pedir("/publico/resumen");
  assert.deepEqual(json.data, {
    comercios: 1,
    productos: 1,
    usuarios: 2,
    categorias: 1,
  });
  assert.doesNotMatch(JSON.stringify(json), /password|csrf|@/);
});

test("auth rechaza tipos de correo inválidos con 400, sin invocar toString del input", async () => {
  await cliente().pedir("/auth/login", {
    method: "POST",
    body: { correo: { toString: "no invocar" }, password: clave },
    esperado: 400,
  });
});
