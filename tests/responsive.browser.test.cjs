/* Regresiones de presentación; fixtures memory, sin datos ni servidor externos. */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { createApplication } = require("../backend/app");
const { hashPassword } = require("../backend/utils/password");
const { fixture, agenda, comprador, inicio } = require("./pr6.helpers.cjs");
const { createPedidoService } = require("../backend/services/pedido.service");

const viewports = [
  [360, 800],
  [375, 812],
  [390, 844],
  [412, 915],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1440, 900],
];
const clave = "Una-clave-de-prueba-2026";
let browser, server, base;
before(async () => {
  const ctx = fixture();
  const passwordHash = await hashPassword(clave);
  for (const u of await ctx.repos.usuario.list()) {
    await ctx.repos.usuario.update(u.id, {
      nombre: "Administración",
      apellido: "Reactiva Pereira",
      correo: `usuario${u.id}.correo.largo@example.invalid`,
      passwordHash,
      estado: "Activo",
    });
  }
  for (const n of await ctx.repos.negocio.list()) {
    await ctx.repos.negocio.update(n.id, {
      nombre: "Comercio de la comunidad de Pereira",
      direccion: "Calle 1, centro de Pereira",
      telefono: "3001234567",
    });
  }
  await ctx.repos.producto.update(1, {
    nombre: "Café artesanal de Pereira",
    descripcion: "Producto local",
    precio: 30000,
    stock: 10,
    imagen: "",
  });
  await agenda(ctx);
  await ctx.r.crear(comprador, { servicioId: 1, fechaHoraInicio: inicio });
  await ctx.repos.favorito.create({ usuarioId: 2, productoId: 1 });
  await createPedidoService(ctx.repos).crear(comprador, {
    items: [{ productoId: 1, cantidad: 1 }],
    observaciones: "Recoger en el comercio.",
  });
  server = (await createApplication({ repositories: ctx.repos })).app.listen(
    0,
    "127.0.0.1",
  );
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox"],
  });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});
async function abrir(page, ruta) {
  await page.goto(`${base}/${ruta}`);
  await page.waitForFunction(() => document.body.dataset.estado === "listo");
  await page.evaluate(() => document.fonts.ready);
}
async function entrar(page, id) {
  await abrir(page, "login.html");
  await page.evaluate(
    ({ id, clave }) =>
      API.post("/auth/login", {
        correo: `usuario${id}.correo.largo@example.invalid`,
        password: clave,
      }),
    { id, clave },
  );
}
async function comprobarAncho(page, contexto) {
  const resultado = await page.evaluate(() => {
    const fuera = [
      ...document.querySelectorAll(
        "input:not([type=hidden]), select, textarea, button, .boton, .tabla-usuarios td",
      ),
    ]
      .filter((n) => {
        // Coverflow es un carrusel con desplazamiento interno intencional.
        if (n.closest(".categorias-3d-viewport")) return false;
        const r = n.getBoundingClientRect();
        return (
          r.width > 0 &&
          r.height > 0 &&
          (r.left < -1 || r.right > innerWidth + 1)
        );
      })
      .map((n) => n.id || n.className || n.tagName);
    return {
      ancho: innerWidth,
      documento: document.documentElement.scrollWidth,
      fuera,
    };
  });
  assert.ok(
    resultado.documento <= resultado.ancho,
    `${contexto}: overflow global`,
  );
  assert.deepEqual(
    resultado.fuera,
    [],
    `${contexto}: controles fuera del viewport`,
  );
}

test("responsive: veinte páginas y cuatro roles en ocho viewports, menú y tabla accesibles", async () => {
  for (const [id, rutas] of [
    [
      null,
      [
        "index.html",
        "login.html",
        "registro.html",
        "marketplace.html",
        "servicios.html",
      ],
    ],
    [
      2,
      [
        "marketplace.html",
        "detalle-producto.html?id=1",
        "carrito.html",
        "servicios.html",
        "detalle-servicio.html?id=1",
        "favoritos.html",
        "mis-reservas.html",
        "mis-pedidos.html",
      ],
    ],
    [
      1,
      [
        "mi-negocio.html",
        "mis-productos.html",
        "mis-servicios.html",
        "reservas.html",
        "pedidos.html",
        "marketplace.html",
      ],
    ],
    [
      4,
      [
        "dashboard.html",
        "usuarios.html",
        "negocios.html",
        "productos.html",
        "mis-servicios.html",
        "reservas.html",
        "pedidos.html",
        "marketplace.html",
      ],
    ],
  ]) {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      if (!id) {
        // Una sesión lenta no debe mostrar fugazmente un carrito de invitado.
        for (const ruta of ["marketplace.html", "detalle-producto.html?id=1"]) {
          let liberar, recibida;
          const espera = new Promise((resolve) => {
            liberar = resolve;
          });
          const solicitada = new Promise((resolve) => {
            recibida = resolve;
          });
          await page.route("**/api/auth/sesion", async (route) => {
            recibida();
            await espera;
            await route.continue();
          });
          const carga = page.goto(`${base}/${ruta}`);
          await solicitada;
          try {
            assert.equal(
              await page.locator(".carrito-navbar").isVisible(),
              false,
            );
          } finally {
            liberar();
            await carga;
            await page.unroute("**/api/auth/sesion");
          }
        }
      }
      if (id) await entrar(page, id);
      if (id === 2) {
        await abrir(page, "marketplace.html");
        await page.evaluate(() =>
          RP.guardarLista(RP.claveCarrito(), [
            { usuarioId: 2, productoId: 1, cantidad: 2 },
          ]),
        );
      }
      for (const ruta of rutas) {
        await abrir(page, ruta);
        for (const [width, height] of viewports) {
          await page.setViewportSize({ width, height });
          // Esperar al nuevo layout, incluidos los listeners de matchMedia.
          await page.waitForFunction((width) => innerWidth === width, width);
          await page.evaluate(
            () =>
              new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              ),
          );
          const nombre = `${id || "invitado"}/${ruta}/${width}`;
          await comprobarAncho(page, nombre);
          if (ruta === "marketplace.html") {
            assert.equal(
              await page.locator(".carrito-navbar").isVisible(),
              id === 2,
              nombre,
            );
            if (width <= 768) {
              const buscador = await page
                .locator(".market-buscador")
                .boundingBox();
              const menu = await page.locator(".menu-toggle").boundingBox();
              assert.ok(
                buscador.x + buscador.width <= menu.x,
                `${nombre}: menú sobre buscador`,
              );
              assert.ok(
                Math.abs(buscador.y - menu.y) <= 2,
                `${nombre}: controles en la misma fila`,
              );
            }
          }
          if (ruta === "usuarios.html") {
            assert.equal(await page.getByRole("table").count(), 1);
            assert.equal(await page.getByRole("columnheader").count(), 6);
            assert.equal(await page.getByRole("cell").count(), 30);
            if (width <= 768) {
              assert.equal(await page.locator("td[data-label]").count(), 30);
              assert.ok(
                await page
                  .locator("td[data-label=Correo]")
                  .first()
                  .evaluate((n) => n.scrollWidth <= n.clientWidth),
              );
            } else {
              assert.equal(
                await page
                  .locator("table")
                  .evaluate((n) => getComputedStyle(n).display),
                "table",
              );
            }
          }
          if (width <= 768 && (await page.locator(".menu-toggle").count())) {
            const toggle = page.getByRole("button", {
              name: "Menú de navegación",
            });
            await toggle.click();
            assert.equal(await toggle.getAttribute("aria-expanded"), "true");
            await comprobarAncho(page, `${nombre}/menú abierto`);
            await toggle.press("Escape");
            assert.equal(await toggle.getAttribute("aria-expanded"), "false");
          }
        }
      }
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  }
});

test("responsive: narrativa sin recortes con movimiento normal o reducido en móvil", async () => {
  for (const reducedMotion of ["reduce", "no-preference"]) {
    const context = await browser.newContext({ reducedMotion });
    try {
      const page = await context.newPage();
      for (const [width, height] of viewports.filter(([w]) => w <= 768)) {
        await page.setViewportSize({ width, height });
        await abrir(page, "index.html");
        const medidas = await page.evaluate(() => {
          const marco = document
            .querySelector("#storyMarketplaceUI")
            .getBoundingClientRect();
          const producto = document
            .querySelector(".story-producto-digital")
            .getBoundingClientRect();
          const foto = document
            .querySelector(".story-impacto-imagen")
            .getBoundingClientRect();
          const contenido = document
            .querySelector(".story-impacto-contenido")
            .getBoundingClientRect();
          return {
            animada:
              document.documentElement.classList.contains("narrativa-animada"),
            contenidoCompleto:
              producto.bottom <= marco.bottom && producto.top >= marco.top,
            fotoCompleta: foto.height >= contenido.height && foto.height > 0,
          };
        });
        assert.equal(medidas.animada, false);
        assert.equal(
          medidas.contenidoCompleto,
          true,
          `Mockup recortado a ${width}`,
        );
        assert.equal(medidas.fotoCompleta, true, `Fondo sin altura a ${width}`);
      }
    } finally {
      await context.close();
    }
  }
});

test("responsive: estados vacíos compactos y filtros funcionales", async () => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    // API vacía solo en este escenario visual; el resto usa Express y datos reales.
    await page.route(/\/api\/(productos|negocios|servicios)(\?.*)?$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: [] }),
      }),
    );
    for (const ruta of ["marketplace.html", "servicios.html"]) {
      for (const [width, height] of viewports.filter(([w]) => w <= 768)) {
        await page.setViewportSize({ width, height });
        await abrir(page, ruta);
        const vacios = page.locator(
          ".estado-vacio:visible, .mensaje-vacio:visible",
        );
        assert.ok(await vacios.count());
        for (const vacio of await vacios.all()) {
          assert.ok(
            (await vacio.boundingBox()).height < 240,
            `${ruta}/${width}: vacío sobredimensionado`,
          );
        }
        await comprobarAncho(page, `${ruta}/${width}/vacío`);
      }
    }
    await page.unrouteAll();
    await entrar(page, 4);
    await page.setViewportSize({ width: 360, height: 800 });
    await abrir(page, "usuarios.html");
    await page.locator(".editar").first().click();
    // Editar carga el usuario por HTTP; el click no espera esa respuesta.
    await page.waitForFunction(
      () => document.getElementById("nombre").value === "Administración",
    );
    assert.equal(await page.locator("#nombre").inputValue(), "Administración");
    await page.locator("#buscarUsuario").fill("sin coincidencias");
    assert.equal(await page.locator("#sinUsuarios").isVisible(), true);
    await page.locator("#buscarUsuario").fill("");
    assert.equal(await page.locator("#listaUsuarios tr").count(), 5);
  } finally {
    await context.close();
  }
});
