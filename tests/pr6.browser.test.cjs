const { test, before, beforeEach, afterEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createApplication } = require("../backend/app");
const { hashPassword } = require("../backend/utils/password");
const { fixture, agenda, comprador, inicio } = require("./pr6.helpers.cjs");
let browser, context, page, server, base, ctx, hash, errors;
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
  ctx = fixture();
  for (const u of await ctx.repos.usuario.list())
    await ctx.repos.usuario.update(u.id, {
      nombre: "Usuario",
      apellido: "Prueba",
      correo: `u${u.id}@example.invalid`,
      estado: "Activo",
      passwordHash: hash,
    });
  for (const n of await ctx.repos.negocio.list())
    await ctx.repos.negocio.update(n.id, {
      nombre: `Local ${n.id}`,
      direccion: "Calle 1",
      telefono: "3001234567",
    });
  await ctx.repos.producto.update(1, {
    descripcion: "Producto local",
    precio: 10,
    imagen: "fixture",
  });
  await agenda(ctx);
  const app = await createApplication({ repositories: ctx.repos });
  server = app.app.listen(0, "127.0.0.1");
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
async function entrar(id) {
  await page.goto(base + "/login.html");
  await page.waitForFunction(() => document.body.dataset.estado === "listo");
  await page.evaluate(
    async ({ id, clave }) => {
      await API.post("/auth/login", {
        correo: `u${id}@example.invalid`,
        password: clave,
      });
    },
    { id, clave },
  );
}
async function abrir(ruta) {
  await page.goto(base + "/" + ruta);
  await page.waitForFunction(() => document.body.dataset.estado === "listo");
}
async function texto(selector, re) {
  await page.waitForFunction(
    ({ selector, re }) =>
      new RegExp(re).test(document.querySelector(selector)?.textContent || ""),
    { selector, re },
  );
}
test("PR6 navegador: catálogo, detalle, reserva real, cupos y cancelación propia", async () => {
  await entrar(2);
  await abrir("servicios.html");
  await page.getByRole("link", { name: "Ver servicio" }).click();
  await page.waitForFunction(() => document.body.dataset.estado === "listo");
  await page.getByLabel("Fecha de la reserva").fill("2099-01-05");
  await page.getByRole("button", { name: "Consultar disponibilidad" }).click();
  await page.locator("[data-reservar]").first().waitFor();
  await page.locator("[data-reservar]").first().click();
  await texto("#mensajeReserva", "confirmada");
  assert.equal((await ctx.r.mias(comprador)).length, 1);
  assert.equal(
    await page.locator("[data-reservar]").first().isDisabled(),
    true,
  );
  await abrir("mis-reservas.html");
  assert.match(await page.locator("#listaReservas").innerText(), /Confirmada/);
  await page.getByRole("button", { name: "Cancelar reserva" }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await texto("#listaReservas", "Cancelada");
  assert.equal((await ctx.r.mias(comprador))[0].estado, "Cancelada");
});
test("PR6 navegador: comerciante crea/edita servicio y administra horarios/recepción", async () => {
  await entrar(1);
  await abrir("mis-servicios.html");
  await page.getByLabel("Nombre del servicio").fill("Asesoría");
  await page.getByLabel("Descripción").fill("Atención local");
  await page.getByLabel("Categoría del servicio").selectOption("Belleza");
  await page.getByLabel("Precio de referencia").fill("0");
  await page.getByLabel("Duración en minutos").fill("30");
  await page.getByLabel("Capacidad simultánea").fill("2");
  await page.getByRole("button", { name: "Guardar servicio" }).click();
  await texto("#listaServicios", "Asesoría");
  const cards = page
    .locator("[data-servicio-card]")
    .filter({ hasText: "Asesoría" });
  await cards.getByRole("button", { name: "Editar servicio" }).click();
  await page.getByLabel("Nombre del servicio").fill("Asesoría local");
  await page.getByRole("button", { name: "Guardar servicio" }).click();
  await texto("#listaServicios", "Asesoría local");
  await page
    .locator("[data-servicio-card]")
    .filter({ hasText: "Asesoría local" })
    .getByRole("button", { name: "Gestionar horarios" })
    .click();
  await page.getByLabel("Día de la semana").selectOption("2");
  await page.getByLabel("Hora de inicio").fill("10:00");
  await page.getByLabel("Hora de fin").fill("12:00");
  await page.getByRole("button", { name: "Guardar horario" }).click();
  await texto("#listaHorarios", "10:00");
  await page.getByRole("button", { name: "Editar horario" }).click();
  await page.getByLabel("Hora de fin").fill("13:00");
  await page.getByRole("button", { name: "Guardar horario" }).click();
  await texto("#listaHorarios", "13:00");
  await page.getByRole("button", { name: "Eliminar horario" }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await texto("#listaHorarios", "Sin horarios");
  await ctx.r.crear(comprador, { servicioId: 1, fechaHoraInicio: inicio });
  await abrir("reservas.html");
  assert.match(await page.locator("#listaReservas").innerText(), /Corte/);
  await page.getByRole("button", { name: "Cancelar reserva" }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await texto("#listaReservas", "Cancelada");
});
test("PR6 navegador: favoritos en tarjeta/detalle, API persistente y quitar", async () => {
  await entrar(2);
  await abrir("marketplace.html");
  await page
    .locator("#listaProductos [data-favorito-producto]")
    .first()
    .click();
  await texto("#estadoAplicacion", "favoritos");
  await abrir("favoritos.html");
  assert.match(await page.locator("#listaFavoritos").innerText(), /Producto/);
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.estado === "listo");
  assert.equal((await ctx.f.listar(comprador)).length, 1);
  await page.getByRole("button", { name: "Quitar favorito" }).click();
  await texto("#listaFavoritos", "No tienes favoritos");
  await abrir("detalle-producto.html?id=1");
  await page.getByRole("button", { name: "Guardar en favoritos" }).click();
  await texto("#estadoAplicacion", "favoritos");
  assert.equal((await ctx.f.listar(comprador)).length, 1);
});
test("PR6 navegador: permisos de páginas y acciones públicas", async () => {
  await abrir("servicios.html");
  assert.equal(await page.locator("[data-reservar]").count(), 0);
  await page.goto(base + "/mis-servicios.html");
  await page.waitForURL("**/login.html");
  await entrar(2);
  await page.goto(base + "/reservas.html");
  await page.waitForURL("**/marketplace.html");
  await entrar(3);
  await abrir("mis-servicios.html");
  assert.doesNotMatch(
    await page.locator("#listaServicios").innerText(),
    /Corte/,
  );
  assert.equal(await page.locator("#negocioServicio option").count(), 1);
});
test("PR6 navegador: error de disponibilidad y reserva no simula confirmación", async () => {
  await entrar(2);
  await abrir("detalle-servicio.html?id=1");
  await page.getByLabel("Fecha de la reserva").fill("2099-01-05");
  await page.route("**/api/servicios/1/disponibilidad?*", (r) => r.abort());
  await page.getByRole("button", { name: "Consultar disponibilidad" }).click();
  await texto("#mensajeReserva", "conectar");
  assert.equal(await page.locator("[data-reservar]").count(), 0);
  await page.unroute("**/api/servicios/1/disponibilidad?*");
  await page.getByRole("button", { name: "Consultar disponibilidad" }).click();
  await page.locator("[data-reservar]").first().waitFor();
  await page.route("**/api/reservas", (r) =>
    r.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, mensaje: "No quedan cupos." }),
    }),
  );
  await page.locator("[data-reservar]").first().click();
  await texto("#mensajeReserva", "No quedan cupos");
  assert.equal((await ctx.r.mias(comprador)).length, 0);
});
test("PR6 navegador: seis pantallas responsive y axe WCAG A/AA", async () => {
  await ctx.r.crear(comprador, { servicioId: 1, fechaHoraInicio: inicio });
  await ctx.f.crear(comprador, { productoId: 1 });
  const paginas = [
    ["servicios.html", 2],
    ["detalle-servicio.html?id=1", 2],
    ["mis-reservas.html", 2],
    ["favoritos.html", 2],
    ["mis-servicios.html", 1],
    ["reservas.html", 1],
  ];
  let capturas = 0,
    analisis = 0;
  for (const [ruta, id] of paginas) {
    await entrar(id);
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await abrir(ruta);
      if (ruta.startsWith("detalle-servicio")) {
        await page.getByLabel("Fecha de la reserva").fill("2099-01-05");
        await page
          .getByRole("button", { name: "Consultar disponibilidad" })
          .click();
        await page.locator("[data-reservar]").first().waitFor();
      }
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        `${ruta}@${width}`,
      );
      if (width === 360) {
        const marca = await page.locator(".market-nav .marca").boundingBox();
        const menu = await page
          .locator(".market-nav .menu-toggle")
          .boundingBox();
        assert.ok(
          marca.x + marca.width <= menu.x,
          `${ruta}: cabecera móvil sin superposición`,
        );
      }
      if ([360, 1440].includes(width)) {
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        assert.deepEqual(
          results.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
          [],
          `${ruta}@${width}`,
        );
        analisis++;
      }
      if (process.env.UI_SCREENSHOTS) {
        await fs.mkdir(process.env.UI_SCREENSHOTS, { recursive: true });
        await page.screenshot({
          path: path.join(
            process.env.UI_SCREENSHOTS,
            `pr6-${ruta.split(".")[0]}-${width}.png`,
          ),
          fullPage: true,
        });
        capturas++;
      }
    }
  }
  assert.equal(analisis, 12);
  if (process.env.UI_SCREENSHOTS) assert.equal(capturas, 24);
});
test("PR6 navegador: admin gestiona globalmente y fallo de guardar conserva formulario", async () => {
  await entrar(4);
  await abrir("mis-servicios.html");
  assert.equal(await page.locator("#negocioServicio option").count(), 2);
  await page.getByLabel("Nombre del servicio").fill("Pendiente de guardar");
  await page.getByLabel("Descripción").fill("Se conserva al fallar la red");
  await page.getByLabel("Categoría del servicio").selectOption("Belleza");
  await page.route("**/api/servicios", (r) =>
    r.request().method() === "POST" ? r.abort() : r.continue(),
  );
  await page.getByRole("button", { name: "Guardar servicio" }).click();
  await texto("#estadoAplicacion", "conectar");
  assert.equal(
    await page.getByLabel("Nombre del servicio").inputValue(),
    "Pendiente de guardar",
  );
  assert.equal(
    await page.getByRole("button", { name: "Guardar servicio" }).isEnabled(),
    true,
  );
  await page.unroute("**/api/servicios");
  await page.getByRole("button", { name: "Guardar servicio" }).click();
  await texto("#listaServicios", "Pendiente de guardar");
  const card = page
    .locator("[data-servicio-card]")
    .filter({ hasText: "Pendiente de guardar" });
  await card.getByRole("button", { name: "Eliminar servicio" }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await texto("#estadoAplicacion", "eliminado");
  assert.equal((await ctx.repos.servicio.list()).length, 1);
});
