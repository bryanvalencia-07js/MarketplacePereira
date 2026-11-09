const { test, before, beforeEach, afterEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createApplication } = require("../backend/app");
const { hashPassword } = require("../backend/utils/password");
const { fixture, comprador } = require("./pr6.helpers.cjs");
const { createPedidoService } = require("../backend/services/pedido.service");
let browser, context, page, server, base, repos, service, hash, errors;
const clave = "Una-clave-de-prueba-2026";
before(async () => {
  hash = await hashPassword(clave);
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox"],
  });
});
after(async () => browser?.close());
beforeEach(async () => {
  ({ repos } = fixture({
    productos: [
      {
        id: 1,
        negocioId: 1,
        categoriaId: 9,
        nombre: "Café",
        descripcion: "Tueste local",
        precio: 30000,
        stock: 5,
        estado: "Activo",
        imagen: "",
      },
      {
        id: 2,
        negocioId: 2,
        categoriaId: 9,
        nombre: "Pan",
        descripcion: "Local",
        precio: 10.25,
        stock: 5,
        estado: "Activo",
        imagen: "",
      },
    ],
  }));
  for (const u of await repos.usuario.list())
    await repos.usuario.update(u.id, {
      nombre: "Usuario",
      apellido: "Prueba",
      correo: `u${u.id}@example.invalid`,
      passwordHash: hash,
      estado: "Activo",
    });
  for (const n of await repos.negocio.list())
    await repos.negocio.update(n.id, {
      nombre: `Local ${n.id}`,
      direccion: "Calle 1",
      telefono: "3001234567",
    });
  service = createPedidoService(repos);
  server = (await createApplication({ repositories: repos })).app.listen(
    0,
    "127.0.0.1",
  );
  await new Promise((ok) => server.once("listening", ok));
  base = `http://127.0.0.1:${server.address().port}`;
  context = await browser.newContext({ reducedMotion: "reduce" });
  page = await context.newPage();
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
});
afterEach(async () => {
  await context?.close();
  await new Promise((ok) => server.close(ok));
  assert.deepEqual(errors, []);
});
async function abrir(ruta) {
  await page.goto(base + "/" + ruta);
  await page.waitForFunction(() => document.body.dataset.estado === "listo");
}
async function entrar(id) {
  await abrir("login.html");
  await page.evaluate(
    async ({ id, clave }) =>
      API.post("/auth/login", {
        correo: `u${id}@example.invalid`,
        password: clave,
      }),
    { id, clave },
  );
}
async function llenar(
  items = [
    { productoId: 1, cantidad: 2 },
    { productoId: 2, cantidad: 1 },
  ],
) {
  await page.evaluate(
    (items) =>
      RP.guardarLista(
        RP.claveCarrito(),
        items.map((i) => ({ ...i, usuarioId: 2 })),
      ),
    items,
  );
  await abrir("carrito.html");
}
async function texto(selector, re) {
  await page.waitForFunction(
    ({ selector, re }) =>
      new RegExp(re).test(document.querySelector(selector)?.textContent || ""),
    { selector, re },
  );
}
test("PR7 navegador: carrito multinegocio real, POST estricto, limpieza y Mis pedidos históricos", async () => {
  await entrar(2);
  await llenar();
  await page.getByLabel("Observaciones del pedido").fill("Horario comercial");
  const requests = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/api/pedidos") && r.method() === "POST")
      requests.push(r.postDataJSON());
  });
  await page
    .getByRole("button", { name: "Confirmar pedido", exact: true })
    .click();
  await texto("#mensajeCarrito", "creado");
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0], {
    items: [
      { productoId: 1, cantidad: 2 },
      { productoId: 2, cantidad: 1 },
    ],
    observaciones: "Horario comercial",
  });
  assert.equal((await repos.pedido.list()).length, 2);
  assert.equal((await repos.producto.find(1)).stock, 3);
  assert.deepEqual(
    await page.evaluate(() => RP.leerLista(RP.claveCarrito())),
    [],
  );
  assert.equal(await page.locator("#contadorCarrito").textContent(), "0");
  assert.match(await page.locator("#pedidosCreados").innerText(), /Pedido #/i);
  await repos.producto.update(1, { precio: 40000 });
  await abrir("mis-pedidos.html");
  assert.match(await page.locator("#listaPedidos").innerText(), /30\.000/);
  assert.match(await page.locator("#listaPedidos").innerText(), /60\.000/);
  assert.equal(await page.locator("[data-pedido]").count(), 2);
  await page.locator("[data-cancelar-pedido]").first().click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await texto("#listaPedidos", "Cancelado");
  assert.equal((await repos.producto.find(2)).stock, 5);
});
test("PR7 navegador: 409 y red conservan carrito, cantidades y observaciones", async () => {
  await entrar(2);
  await llenar();
  await page.getByLabel("Observaciones del pedido").fill("Conservar esta nota");
  const anterior = await page.evaluate(() => RP.leerLista(RP.claveCarrito()));
  for (const mode of ["conflict", "offline"]) {
    await page.route("**/api/pedidos", (r) =>
      mode === "offline"
        ? r.abort()
        : r.fulfill({
            status: 409,
            contentType: "application/json",
            body: JSON.stringify({ ok: false, mensaje: "Stock insuficiente." }),
          }),
    );
    await page
      .getByRole("button", { name: "Confirmar pedido", exact: true })
      .click();
    await texto(
      "#mensajeCarrito",
      mode === "offline" ? "conectar" : "Stock insuficiente",
    );
    assert.deepEqual(
      await page.evaluate(() => RP.leerLista(RP.claveCarrito())),
      anterior,
    );
    assert.equal(
      await page.getByLabel("Observaciones del pedido").inputValue(),
      "Conservar esta nota",
    );
    assert.equal((await repos.pedido.list()).length, 0);
    assert.equal(
      await page.locator("#pedidosCreados [data-pedido]").count(),
      0,
    );
    await page.unroute("**/api/pedidos");
  }
});
test("PR7 navegador: evita doble envío y conserva otros compradores/ítems añadidos en otra pestaña", async () => {
  await entrar(2);
  await llenar([{ productoId: 1, cantidad: 1 }]);
  await page.route("**/api/pedidos", async (route) => {
    await new Promise((ok) => setTimeout(ok, 150));
    await route.continue();
  });
  await page.evaluate(() => {
    const b = document.getElementById("confirmarPedido");
    b.click();
    b.click();
    const clave = RP.claveCarrito();
    RP.guardarLista(clave, [
      { usuarioId: 2, productoId: 1, cantidad: 3 },
      { usuarioId: 5, productoId: 2, cantidad: 1 },
    ]);
  });
  await texto("#mensajeCarrito", "creado");
  assert.equal((await repos.pedido.list()).length, 1);
  const carrito = await page.evaluate(() => RP.leerLista(RP.claveCarrito()));
  assert.deepEqual(carrito, [
    { usuarioId: 2, productoId: 1, cantidad: 2 },
    { usuarioId: 5, productoId: 2, cantidad: 1 },
  ]);
});
test("PR7 navegador: gestión propia, confirmar/completar/cancelar y administración global", async () => {
  await service.crear(comprador, {
    items: [
      { productoId: 1, cantidad: 1 },
      { productoId: 2, cantidad: 1 },
    ],
  });
  await entrar(1);
  await abrir("pedidos.html");
  assert.equal(await page.locator("[data-pedido]").count(), 1);
  await page
    .getByRole("button", { name: "Confirmar pedido", exact: true })
    .click();
  await texto("#listaPedidos", "Confirmado");
  await page.getByRole("button", { name: "Completar pedido" }).click();
  await texto("#listaPedidos", "Completado");
  assert.equal(await page.locator("[data-cancelar-pedido]").count(), 0);
  await entrar(4);
  await abrir("pedidos.html");
  assert.equal(await page.locator("[data-pedido]").count(), 2);
  await page.getByRole("button", { name: "Cancelar pedido" }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await texto("#listaPedidos", "Cancelado");
  await page.getByLabel("Filtrar por estado").selectOption("Cancelado");
  await page.getByRole("button", { name: "Filtrar pedidos" }).click();
  await page.waitForFunction(
    () => document.querySelectorAll("[data-pedido]").length === 1,
  );
  assert.equal(await page.locator("[data-pedido]").count(), 1);
});
test("PR7 navegador: protección de páginas, navegación y errores recuperables de listados", async () => {
  await page.goto(base + "/mis-pedidos.html");
  await page.waitForURL("**/login.html");
  await entrar(2);
  await abrir("mis-pedidos.html");
  for (const ruta of [
    "marketplace.html",
    "servicios.html",
    "favoritos.html",
    "mis-reservas.html",
    "mis-pedidos.html",
    "carrito.html",
  ])
    assert.ok(await page.locator(`a[href="${ruta}"]`).count(), ruta);
  await page.goto(base + "/pedidos.html");
  await page.waitForURL("**/marketplace.html");
  await page.route("**/api/pedidos/mios", (r) => r.abort());
  await page.goto(base + "/mis-pedidos.html");
  await texto("#estadoAplicacion", "conectar");
  await page.unroute("**/api/pedidos/mios");
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await page.waitForFunction(() => document.body.dataset.estado === "listo");
  await texto("#listaPedidos", "No hay pedidos");
  await entrar(1);
  await abrir("pedidos.html");
  for (const ruta of [
    "mi-negocio.html",
    "mis-productos.html",
    "mis-servicios.html",
    "reservas.html",
    "pedidos.html",
  ])
    assert.ok(await page.locator(`a[href="${ruta}"]`).count(), ruta);
});
test("PR7 navegador: carrito e historial/gestión responsive y axe WCAG A/AA", async () => {
  await service.crear(comprador, {
    items: [
      { productoId: 1, cantidad: 1 },
      { productoId: 2, cantidad: 1 },
    ],
    observaciones: "<img src=x onerror=alert(1)> Nota segura",
  });
  let analisis = 0,
    capturas = 0;
  for (const [ruta, id] of [
    ["carrito.html", 2],
    ["mis-pedidos.html", 2],
    ["pedidos.html", 1],
  ]) {
    await entrar(id);
    if (ruta === "carrito.html") await llenar([{ productoId: 1, cantidad: 1 }]);
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await abrir(ruta);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        `${ruta}@${width}`,
      );
      if (width === 360) {
        await page.getByRole("button", { name: "Menú de navegación" }).click();
        assert.equal(
          await page
            .locator(
              `nav a[href="${id === 2 ? "mis-pedidos.html" : "pedidos.html"}"]`,
            )
            .isVisible(),
          true,
        );
        await page
          .getByRole("button", { name: "Menú de navegación" })
          .press("Escape");
      }
      if ([360, 1440].includes(width)) {
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        assert.deepEqual(
          result.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
          [],
          `${ruta}@${width}`,
        );
        analisis++;
      }
      assert.equal(await page.locator("#listaPedidos img").count(), 0);
      if (process.env.UI_SCREENSHOTS) {
        await fs.mkdir(process.env.UI_SCREENSHOTS, { recursive: true });
        await page.screenshot({
          path: path.join(
            process.env.UI_SCREENSHOTS,
            `pr7-${ruta.split(".")[0]}-${width}.png`,
          ),
          fullPage: true,
        });
        capturas++;
      }
    }
  }
  assert.equal(analisis, 6);
  if (process.env.UI_SCREENSHOTS) assert.equal(capturas, 12);
});

test("PR7 navegador: cambio de instancia no reutiliza el carrito anterior para comprar", async () => {
  await entrar(2);
  await llenar([{ productoId: 1, cantidad: 1 }]);
  const anterior = await page.evaluate(() => ({
    clave: RP.claveCarrito(),
    items: RP.leerLista(RP.claveCarrito()),
  }));
  await page.route("**/api/auth/sesion", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    json.data.instancia = "otra-instancia-de-prueba";
    await route.fulfill({ response, json });
  });
  await page
    .getByRole("button", { name: "Confirmar pedido", exact: true })
    .click();
  await texto("#mensajeCarrito", "Recarga el carrito");
  assert.equal((await repos.pedido.list()).length, 0);
  assert.deepEqual(
    await page.evaluate((clave) => RP.leerLista(clave), anterior.clave),
    anterior.items,
  );
});
