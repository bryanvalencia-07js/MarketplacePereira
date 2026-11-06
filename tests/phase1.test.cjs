/* Regresiones de Fase 1, ahora contra Express real y sesiones HTTP. */
const { test, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const http = require("node:http");
const { createApplication } = require("../backend/app");
const { createRepositories } = require("../backend/repositories");
const { hashPassword } = require("../backend/utils/password");
let browser, context, page, server, base, sistema, hash, errores, fallos;
const clave = "Una-clave-de-prueba-2026";
const usuarios = [
  {
    id: 1,
    nombre: "Ana",
    apellido: "Admin",
    correo: "admin@example.invalid",
    rol: "Administrador",
    estado: "Activo",
  },
  {
    id: 2,
    nombre: "Camilo",
    apellido: "Comerciante",
    correo: "comerciante@example.invalid",
    rol: "Comerciante",
    estado: "Activo",
  },
  {
    id: 3,
    nombre: "Clara",
    apellido: "Compradora",
    correo: "comprador@example.invalid",
    rol: "Comprador",
    estado: "Activo",
  },
  {
    id: 4,
    nombre: "Otro",
    apellido: "Comprador",
    correo: "otro@example.invalid",
    rol: "Comprador",
    estado: "Activo",
  },
  {
    id: 5,
    nombre: "Otra",
    apellido: "Comerciante",
    correo: "otra@example.invalid",
    rol: "Comerciante",
    estado: "Activo",
  },
];
const negocios = [
  {
    id: 1,
    usuarioId: 2,
    nombre: "Café Pereira",
    propietario: "Camilo Comerciante",
    categoria: "Alimentos",
    direccion: "Calle 1",
    telefono: "3001234567",
    estado: "Activo",
  },
  {
    id: 2,
    usuarioId: 5,
    nombre: "Otro comercio",
    propietario: "Otra Comerciante",
    categoria: "Ropa",
    direccion: "Calle 2",
    telefono: "3001234568",
    estado: "Activo",
  },
];
const productos = [
  {
    id: 1,
    negocioId: 1,
    nombre: "Café",
    descripcion: "Tueste artesanal",
    categoria: "Alimentos",
    precio: 10000,
    stock: 3,
    estado: "Activo",
    popularidad: 0,
    imagen: "",
  },
];
async function sistemaNuevo(datos = {}) {
  const conFechas = (rows) =>
    rows.map((row) => ({
      createdAt: "2026-10-29T12:00:00.000Z",
      updatedAt: "2026-10-29T12:00:00.000Z",
      ...row,
    }));
  const repos = createRepositories({
    usuarios: conFechas(
      (datos.usuarios || usuarios).map((u) => ({ ...u, passwordHash: hash })),
    ),
    negocios: conFechas(datos.negocios || negocios),
    productos: conFechas(datos.productos || productos),
  });
  sistema = await createApplication({ repositories: repos });
}
before(async () => {
  hash = await hashPassword(clave);
  await sistemaNuevo();
  server = http.createServer((req, res) => sistema.app(req, res));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
    headless: true,
  });
});
after(async () => {
  await browser?.close();
  await new Promise((r) => server.close(r));
});
beforeEach(async () => {
  context = await browser.newContext();
  await context.route("https://fonts.googleapis.com/**", (r) =>
    r.fulfill({ status: 200, body: "", contentType: "text/css" }),
  );
  await context.route("https://fonts.gstatic.com/**", (r) =>
    r.fulfill({ status: 200, body: "" }),
  );
  page = await context.newPage();
  errores = [];
  fallos = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      !m.text().startsWith("Failed to load resource:")
    )
      errores.push(m.text());
  });
  page.on("response", (r) => {
    if (
      r.url().startsWith(base) &&
      !r.url().includes("/api/") &&
      r.status() >= 400
    )
      fallos.push(r.status() + " " + r.url());
  });
});
afterEach(async () => {
  await context.close();
  assert.deepEqual(errores, [], "Consola sin excepciones ni violaciones CSP");
  assert.deepEqual(fallos, [], "Recursos locales disponibles");
});
async function abrir(archivo, { usuario = 3, datos = {} } = {}) {
  await page.goto("about:blank");
  await sistemaNuevo(datos);
  await context.clearCookies();
  if (usuario) {
    const u = (datos.usuarios || usuarios).find((u) => u.id === usuario);
    const r = await context.request.post(base + "/api/auth/login", {
      data: { correo: u.correo, password: clave },
    });
    assert.equal(r.status(), 200);
  }
  await page.goto(base + "/login.html");
  await page.waitForFunction(() => document.body.dataset.estado === "listo");
  await page.evaluate((carrito) => {
    localStorage.clear();
    localStorage.setItem(RP.claveCarrito(), JSON.stringify(carrito || []));
  }, datos.carrito);
  await page.goto(base + "/" + archivo);
}
async function listo(func) {
  await page.waitForFunction(
    (n) =>
      typeof window[n] === "function" &&
      document.body.dataset.estado === "listo",
    func,
  );
}
async function texto(id, valor) {
  await page.waitForFunction(
    ({ id, valor }) => document.querySelector(id)?.textContent.includes(valor),
    { id, valor },
  );
}
async function leer(k) {
  if (k === "carrito")
    return page.evaluate(() =>
      JSON.parse(localStorage.getItem(RP.claveCarrito()) || "[]"),
    );
  if (k === "usuarioSesion")
    return page.evaluate(async () => {
      const r = await API.get("/auth/sesion");
      return r.usuario;
    });
  const repo = {
    usuarios: "usuario",
    productos: "producto",
    negocios: "negocio",
  }[k];
  return sistema.repositories[repo].list();
}
async function formularioProducto(nombre = "Nuevo café") {
  for (const [id, v] of [
    ["nombreProducto", nombre],
    ["precioProducto", "20000"],
    ["stockProducto", "4"],
    ["descripcionProducto", "Descripción de prueba"],
  ])
    await page.locator("#" + id).fill(v);
  await page.locator("#categoriaProducto").selectOption("Alimentos");
}
async function subirImagen(color = "#ffffff") {
  const contenido = await page.evaluate((color) => {
    const c = document.createElement("canvas");
    c.width = 1200;
    c.height = 600;
    const x = c.getContext("2d");
    x.fillStyle = color;
    x.fillRect(0, 0, 1200, 600);
    return c.toDataURL("image/png").split(",")[1];
  }, color);
  await page.locator("#imagenProducto").setInputFiles({
    name: "cafe.png",
    mimeType: "image/png",
    buffer: Buffer.from(contenido, "base64"),
  });
  await texto("#mensajeProducto", "lista para guardar");
}
async function guardarProducto() {
  await page.evaluate(() => window.guardarProducto({ preventDefault() {} }));
}
async function confirmar(accion, aceptar = true) {
  const pendiente = page.evaluate(accion);
  await page.locator("dialog[open]").waitFor();
  await page
    .locator(`dialog button[value="${aceptar ? "aceptar" : "cancelar"}"]`)
    .click();
  await pendiente;
}

test("roles: login real y sesión sin contraseña ni token en LocalStorage", async () => {
  for (const [id, destino] of [
    [1, "dashboard.html"],
    [2, "mi-negocio.html"],
    [3, "marketplace.html"],
  ]) {
    await abrir("login.html", { usuario: null });
    await listo("iniciarSesion");
    await page.locator("#correo").fill(usuarios[id - 1].correo);
    await page.locator("#password").fill(clave);
    await page.locator("button[type=submit]").click();
    await page.waitForURL("**/" + destino);
    assert.equal((await leer("usuarioSesion")).password, undefined);
    assert.equal(
      await page.evaluate(() => localStorage.getItem("usuarioSesion")),
      null,
    );
  }
});

test("autorización: módulo privado no carga con otro rol ni sin sesión", async () => {
  await abrir("mis-productos.html");
  await page.waitForURL("**/marketplace.html");
  await listo("buscarMarketplace");
  assert.equal(await page.evaluate(() => typeof guardarProducto), "undefined");
  await page.goto(base + "/dashboard.html");
  await page.waitForURL("**/marketplace.html");
  await abrir("carrito.html", { usuario: 2 });
  await page.waitForURL("**/mi-negocio.html");
  await abrir("carrito.html", { usuario: null });
  await page.waitForURL("**/login.html");
});

test("cuenta inactiva invalida cookie existente y acceso protegido", async () => {
  await abrir("carrito.html");
  await listo("vaciarCarrito");
  await sistema.repositories.usuario.update(3, { estado: "Inactivo" });
  await page.reload();
  await page.waitForURL("**/login.html");
});

test("administrador: usuarios, negocios, productos y KPIs reales", async () => {
  await abrir("usuarios.html", { usuario: 1 });
  await listo("guardarUsuario");
  assert.equal(await page.locator("#listaUsuarios tr").count(), 5);
  await page.goto(base + "/negocios.html");
  await listo("guardarNegocio");
  assert.equal(await page.locator("#listaNegocios article").count(), 2);
  await page.goto(base + "/dashboard.html");
  await listo("presentarResumen");
  assert.equal(await page.locator("#kpisAdministrador .kpi").count(), 12);
  await page.goto(base + "/productos.html");
  await listo("guardarProducto");
  assert.equal(await page.locator("#productoNegocioId option").count(), 3);
});

test("comerciante: crea comercio vinculado y navega a productos", async () => {
  await abrir("mi-negocio.html", {
    usuario: 2,
    datos: { negocios: [], productos: [] },
  });
  await listo("guardarMiNegocio");
  assert.equal(await page.locator("#btnProductos").isVisible(), false);
  for (const [id, v] of [
    ["nombreNegocio", "Mi café"],
    ["telefono", "3001234567"],
    ["direccion", "Calle 2"],
  ])
    await page.locator("#" + id).fill(v);
  await page.locator("#categoria").selectOption("Alimentos");
  await page.locator("button[type=submit]").click();
  await texto("#mensajeMiNegocio", "guardada");
  assert.equal((await leer("negocios"))[0].usuarioId, 2);
  await page.locator("#btnProductos").click();
  await listo("guardarProducto");
});

test("productos: CRUD, imagen conservada/reemplazada y recursos propios", async () => {
  const ajeno = { ...productos[0], id: 90, negocioId: 2, nombre: "Ajeno" };
  await abrir("mis-productos.html", {
    usuario: 2,
    datos: { productos: [ajeno] },
  });
  await listo("guardarProducto");
  await formularioProducto();
  await subirImagen();
  assert.deepEqual(
    await page
      .locator("#previewProducto")
      .evaluate((i) => [i.naturalWidth, i.naturalHeight]),
    [900, 450],
  );
  await guardarProducto();
  let nuevo = (await leer("productos")).find((p) => p.negocioId === 1);
  assert.ok(nuevo);
  const previa = nuevo.imagen;
  await page.evaluate((id) => editarProducto(id), nuevo.id);
  await page.locator("#nombreProducto").fill("Café editado");
  await guardarProducto();
  assert.equal(
    (await leer("productos")).find((p) => p.id === nuevo.id).imagen,
    previa,
  );
  await page.evaluate((id) => editarProducto(id), nuevo.id);
  await subirImagen("#cc3333");
  await guardarProducto();
  assert.notEqual(
    (await leer("productos")).find((p) => p.id === nuevo.id).imagen,
    previa,
  );
  await page.evaluate((id) => cambiarEstadoProducto(id), nuevo.id);
  assert.equal(
    (await leer("productos")).find((p) => p.id === nuevo.id).estado,
    "Inactivo",
  );
  await page.evaluate(() => cambiarEstadoProducto(90));
  assert.equal(
    (await leer("productos")).find((p) => p.id === 90).estado,
    "Activo",
  );
  await confirmar(`eliminarProducto(${nuevo.id})`);
  assert.equal((await leer("productos")).length, 1);
});

test("imagen corrupta libera carga y no se publica sin imagen", async () => {
  await abrir("mis-productos.html", { usuario: 2, datos: { productos: [] } });
  await listo("guardarProducto");
  await formularioProducto();
  await page.locator("#imagenProducto").setInputFiles({
    name: "rota.png",
    mimeType: "image/png",
    buffer: Buffer.from("no es imagen"),
  });
  await texto("#mensajeProducto", "No se pudo procesar");
  assert.equal(await page.locator("button[type=submit]").isEnabled(), true);
  await guardarProducto();
  assert.deepEqual(await leer("productos"), []);
});

test("fallo HTTP al guardar conserva formulario y no muestra éxito falso", async () => {
  await abrir("mis-productos.html", { usuario: 2 });
  await listo("guardarProducto");
  await page.evaluate(() => editarProducto(1));
  await page.locator("#nombreProducto").fill("No persistido");
  await subirImagen();
  await page.route("**/api/productos/1", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            ok: false,
            mensaje: "No se pudo guardar. Intenta nuevamente.",
          }),
        })
      : route.continue(),
  );
  await guardarProducto();
  assert.match(
    await page.locator("#mensajeProducto").innerText(),
    /No se pudo guardar/,
  );
  assert.equal((await leer("productos"))[0].nombre, "Café");
  assert.equal(
    await page.locator("#nombreProducto").inputValue(),
    "No persistido",
  );
});

test("catálogo: visibilidad en búsqueda, categorías, populares y recientes", async () => {
  const lista = [
    productos[0],
    { ...productos[0], id: 2, estado: "Inactivo" },
    { ...productos[0], id: 3, negocioId: 99 },
    { ...productos[0], id: 4, negocioId: 2 },
  ];
  await abrir("marketplace.html", {
    datos: {
      productos: lista,
      negocios: [negocios[0], { ...negocios[1], estado: "Inactivo" }],
    },
  });
  await listo("buscarMarketplace");
  for (const id of [
    "listaProductos",
    "productosPopulares",
    "productosRecientes",
  ])
    assert.equal(await page.locator("#" + id + " article").count(), 1);
  await page.locator("#buscarMarketplace").fill("artesanal");
  await page.evaluate(() => filtrarCategoria("Alimentos"));
  assert.equal(await page.locator("#listaProductos article").count(), 1);
  await page.locator("#buscarMarketplace").fill("inexistente");
  assert.equal(await page.locator("#sinProductos").isVisible(), true);
  await page.evaluate(() => limpiarFiltros());
  assert.equal(await page.locator("#listaProductos article").count(), 1);
});

test("Coverflow: categorías, SVG, filtro, selección accesible y limpiar", async () => {
  await abrir("marketplace.html");
  await listo("buscarMarketplace");
  const tarjetas = page.locator("#carruselCategorias .categoria-3d");
  assert.equal(await tarjetas.count(), 25);
  assert.equal(await tarjetas.locator("svg use").count(), 25);
  for (const href of await tarjetas
    .locator("use")
    .evaluateAll((xs) => xs.map((x) => x.getAttribute("href")))) {
    assert.match(href, /^assets\/icons\/categorias.svg#[\w-]+$/);
  }
  const ropa = page.locator('.categoria-3d[data-valor="Ropa"]');
  await ropa.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () =>
      document
        .querySelector('.categoria-3d[data-valor="Ropa"]')
        .getAttribute("aria-pressed") === "true",
  );
  assert.equal(await page.locator("#listaProductos article").count(), 0);
  assert.equal(await tarjetas.locator(".categoria-3d-contenido").count(), 25);
  await page.evaluate(() => limpiarFiltros());
  assert.equal(await page.locator("#listaProductos article").count(), 1);
  assert.equal(
    await page
      .locator('.categoria-3d[data-valor=""]')
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(await page.locator(".categoria-3d.activa").count(), 1);
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await tarjetas.first().isVisible(), true);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      true,
    );
  }
});

test("detalle: vendedor, visita, stock acumulado y contador global", async () => {
  await abrir("detalle-producto.html?id=1");
  await listo("agregarAlCarrito");
  assert.equal(
    await page.locator("#detalleComercio").innerText(),
    "Café Pereira",
  );
  assert.equal((await leer("productos"))[0].popularidad, 1);
  for (let i = 0; i < 4; i++) await page.evaluate(() => agregarAlCarrito());
  assert.equal((await leer("carrito"))[0].cantidad, 3);
  assert.equal(await page.locator("#contadorCarrito").innerText(), "3");
  await page.goto(base + "/marketplace.html");
  await listo("buscarMarketplace");
  assert.equal(await page.locator("#contadorCarrito").innerText(), "3");
});

test("detalle: inactivo, comercio inactivo, huérfano, ID inválido y agotado", async () => {
  for (const datos of [
    { productos: [{ ...productos[0], estado: "Inactivo" }] },
    { negocios: [{ ...negocios[0], estado: "Inactivo" }] },
    { productos: [] },
  ]) {
    await abrir("detalle-producto.html?id=1", { datos });
    await listo("agregarAlCarrito");
    assert.equal(await page.locator("#productoNoEncontrado").isVisible(), true);
    await page.evaluate(() => agregarAlCarrito());
    assert.deepEqual(await leer("carrito"), []);
  }
  await abrir("detalle-producto.html?id=incorrecto");
  await listo("agregarAlCarrito");
  assert.equal(await page.locator("#productoNoEncontrado").isVisible(), true);
  await abrir("detalle-producto.html?id=1", {
    datos: { productos: [{ ...productos[0], stock: 0 }] },
  });
  await listo("agregarAlCarrito");
  assert.equal(await page.locator("#btnAgregarCarrito").isDisabled(), true);
  assert.equal(
    await page.locator(".selector-cantidad button:enabled").count(),
    0,
  );
  assert.equal((await leer("productos"))[0].popularidad, 0);
});

test("carrito: stock, huérfanos, subtotales, eliminación y otro usuario", async () => {
  const ajeno = { usuarioId: 4, productoId: 99, cantidad: 5 };
  await abrir("carrito.html", {
    datos: {
      carrito: [
        { usuarioId: 3, productoId: 1, cantidad: 8 },
        { usuarioId: 3, productoId: 99, cantidad: 1 },
        ajeno,
      ],
    },
  });
  await listo("vaciarCarrito");
  assert.equal(
    (await leer("carrito")).find((i) => i.usuarioId === 3).cantidad,
    3,
  );
  assert.equal(await page.locator("#resumenCantidad").innerText(), "3");
  assert.match(await page.locator("#resumenTotal").innerText(), /30.000/);
  await page.evaluate(() => cambiarCantidad(1, -1));
  assert.match(await page.locator("#resumenSubtotal").innerText(), /20.000/);
  await page.evaluate(() => eliminarDelCarrito(1));
  assert.deepEqual(await leer("carrito"), [ajeno]);
  assert.equal(await page.locator("#carritoVacio").isVisible(), true);
});

test("modal de vaciado: cancelar, confirmar y preservar al otro comprador", async () => {
  const ajeno = { usuarioId: 4, productoId: 1, cantidad: 1 };
  await abrir("carrito.html", {
    datos: { carrito: [{ usuarioId: 3, productoId: 1, cantidad: 2 }, ajeno] },
  });
  await listo("vaciarCarrito");
  await confirmar("vaciarCarrito()", false);
  assert.equal((await leer("carrito")).length, 2);
  await confirmar("vaciarCarrito()");
  assert.deepEqual(await leer("carrito"), [ajeno]);
  assert.equal(await page.locator("#carritoVacio").isVisible(), true);
});

test("carrito descarta inactivos, agotados y productos de comercio inactivo", async () => {
  for (const cambio of [
    { estado: "Inactivo" },
    { stock: 0 },
    { negocioId: 99 },
  ]) {
    await abrir("carrito.html", {
      datos: {
        productos: [{ ...productos[0], ...cambio }],
        carrito: [{ usuarioId: 3, productoId: 1, cantidad: 1 }],
      },
    });
    await listo("vaciarCarrito");
    assert.deepEqual(await leer("carrito"), []);
    assert.equal(await page.locator("#carritoVacio").isVisible(), true);
  }
  await abrir("carrito.html", {
    datos: {
      negocios: [{ ...negocios[0], estado: "Inactivo" }],
      carrito: [{ usuarioId: 3, productoId: 1, cantidad: 1 }],
    },
  });
  await listo("vaciarCarrito");
  assert.deepEqual(await leer("carrito"), []);
});

test("revalidar stock del servidor y cerrar sesión entre pestañas", async () => {
  await abrir("carrito.html", {
    datos: { carrito: [{ usuarioId: 3, productoId: 1, cantidad: 3 }] },
  });
  await listo("vaciarCarrito");
  await sistema.repositories.producto.update(1, { stock: 1 });
  await page.evaluate(() => mostrarCarrito());
  assert.equal(await page.locator("#resumenCantidad").innerText(), "1");
  const otra = await context.newPage();
  await otra.goto(base + "/index.html");
  await otra.waitForFunction(() => document.body.dataset.estado === "listo");
  await otra.evaluate(async () => {
    await API.post("/auth/logout");
    localStorage.setItem("rp_cambio_sesion", String(Date.now()));
  });
  await page.waitForURL("**/login.html");
});

test("carrito corrupto se preserva y un fallo de red no lo vacía", async () => {
  await abrir("carrito.html", {
    datos: { carrito: [{ usuarioId: 3, productoId: 1, cantidad: 2 }] },
  });
  await listo("vaciarCarrito");
  await page.route("**/api/productos", (r) => r.abort());
  await page.evaluate(() => mostrarCarrito());
  assert.equal((await leer("carrito"))[0].cantidad, 2);
  await page.unroute("**/api/productos");
  await page.evaluate(() => localStorage.setItem(RP.claveCarrito(), "{roto"));
  await page.reload();
  await listo("vaciarCarrito");
  assert.equal(
    await page.evaluate(() => localStorage.getItem(RP.claveCarrito())),
    "{roto",
  );
  assert.match(await page.locator("#mensajeCarrito").innerText(), /recuperar/);
});

test("XSS: catálogo y administración tratan contenido como texto", async () => {
  await abrir("marketplace.html", {
    datos: {
      productos: [
        {
          ...productos[0],
          nombre: '<img src=x onerror="window.inyectado=true">',
          imagen: "javascript:alert(1)",
        },
      ],
    },
  });
  await listo("buscarMarketplace");
  assert.equal(await page.evaluate(() => window.inyectado), undefined);
  assert.equal(await page.locator("#listaProductos img").count(), 0);
  assert.match(await page.locator("#listaProductos h3").innerText(), /<img/);
});

test("normalización combina duplicados y rechaza cantidades inválidas", async () => {
  await abrir("carrito.html");
  await listo("vaciarCarrito");
  const r = await page.evaluate(
    ({ productos, negocios }) =>
      RP.normalizarCarrito(
        [
          { usuarioId: 3, productoId: 1, cantidad: 1 },
          { usuarioId: 3, productoId: 1, cantidad: 1 },
          { usuarioId: 3, productoId: 1, cantidad: -2 },
          { usuarioId: 3, productoId: 1, cantidad: 1.5 },
          { usuarioId: 4, productoId: 1, cantidad: 3 },
        ],
        3,
        productos,
        negocios,
      ),
    { productos, negocios },
  );
  assert.equal(r.find((i) => i.usuarioId === 3).cantidad, 2);
  assert.equal(r.find((i) => i.usuarioId === 4).cantidad, 3);
});

test("datos antiguos: respaldo sin contraseñas, sin importación automática de roles", async () => {
  await abrir("login.html", { usuario: null });
  await listo("iniciarSesion");
  await page.evaluate(() => {
    localStorage.setItem(
      "usuarios",
      JSON.stringify([
        {
          id: 1,
          password: "NO_PERSISTIR",
          passwordHash: "NO_HASH",
          rol: "Administrador",
          correo: "legado@example.invalid",
        },
      ]),
    );
    localStorage.setItem(
      "usuarioSesion",
      JSON.stringify({ password: "NO_PERSISTIR" }),
    );
    localStorage.setItem(
      "negocios",
      JSON.stringify([{ id: 1, nombre: "Legado" }]),
    );
  });
  await page.reload();
  await listo("iniciarSesion");
  const raw = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  assert.doesNotMatch(raw, /NO_PERSISTIR|NO_HASH/);
  assert.equal((await leer("usuarios")).length, 5);
  assert.equal(
    await page
      .getByRole("button", { name: "Descargar respaldo anterior" })
      .isVisible(),
    true,
  );
});

test("landing pública: contenido real, narrativa y movimiento reducido", async () => {
  await context.addInitScript(() => {});
  await page.emulateMedia({ reducedMotion: "reduce" });
  await abrir("index.html", { usuario: null });
  await listo("activarNarrativa");
  assert.equal(await page.locator("#landingComercios article").count(), 2);
  assert.equal(await page.locator("#landingProductos article").count(), 1);
  assert.equal(await page.locator("#landingImpacto .kpi").count(), 4);
  assert.equal(await page.locator(".hero-rp h1").isVisible(), true);
  assert.equal(
    await page.evaluate(() =>
      document.documentElement.classList.contains("reveal-listo"),
    ),
    false,
  );
  await page.screenshot({
    path: "/tmp/reactiva-landing-desktop.png",
    fullPage: true,
  });
});

test("navegación pública y preview del comerciante sin permitir compra", async () => {
  await abrir("marketplace.html", { usuario: null });
  await listo("buscarMarketplace");
  await page.locator("#listaProductos a.boton").click();
  await listo("agregarAlCarrito");
  assert.match(
    await page.locator("#btnAgregarCarrito").innerText(),
    /Iniciar sesión/,
  );
  await abrir("mi-negocio.html", { usuario: 2 });
  await listo("guardarMiNegocio");
  await page.locator("#previewComercio").click();
  await listo("buscarMarketplace");
  assert.equal(await page.locator("#listaProductos article").count(), 1);
  await page.locator("#listaProductos a.boton").click();
  await listo("agregarAlCarrito");
  assert.equal(await page.locator("#btnAgregarCarrito").isDisabled(), true);
});

test("registro público crea cuenta por HTTP y no guarda credenciales en navegador", async () => {
  await abrir("registro.html?rol=Comerciante", { usuario: null });
  await listo("registrarUsuario");
  assert.equal(await page.locator("#rol").inputValue(), "Comerciante");
  for (const [id, v] of [
    ["nombre", "Nueva"],
    ["apellido", "Persona"],
    ["correo", "nueva@example.invalid"],
    ["password", clave],
  ])
    await page.locator("#" + id).fill(v);
  await page.locator("button[type=submit]").click();
  await page.waitForURL("**/login.html");
  assert.equal((await leer("usuarios")).length, 6);
  assert.doesNotMatch(
    await page.evaluate(() => JSON.stringify({ ...localStorage })),
    new RegExp(clave),
  );
});

test("responsive, IDs, enlaces locales y formularios en todos los roles", async () => {
  const fs = require("node:fs/promises");
  const path = require("node:path");
  const capturas =
    process.env.UI_SCREENSHOTS && path.resolve(process.env.UI_SCREENSHOTS);
  if (capturas) await fs.mkdir(capturas, { recursive: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [archivo, usuario, func] of [
    ["mis-productos.html", 2, "guardarProducto"],
    ["marketplace.html", 3, "buscarMarketplace"],
    ["detalle-producto.html?id=1", 3, "agregarAlCarrito"],
    ["carrito.html", 3, "vaciarCarrito"],
    ["mi-negocio.html", 2, "guardarMiNegocio"],
    ["dashboard.html", 1, "presentarResumen"],
    ["usuarios.html", 1, "guardarUsuario"],
    ["negocios.html", 1, "guardarNegocio"],
    ["productos.html", 1, "guardarProducto"],
    ["index.html", null, "activarNarrativa"],
    ["registro.html", null, "registrarUsuario"],
    ["login.html", null, "iniciarSesion"],
  ]) {
    await abrir(archivo, {
      usuario,
      datos: { carrito: [{ usuarioId: 3, productoId: 1, cantidad: 2 }] },
    });
    await listo(func);
    const duplicados = await page
      .locator("[id]")
      .evaluateAll((ns) =>
        ns.map((n) => n.id).filter((id, i, ids) => ids.indexOf(id) !== i),
      );
    assert.deepEqual(duplicados, []);
    assert.equal(
      await page
        .locator("[onclick],[onsubmit],[oninput],[onchange],script:not([src])")
        .count(),
      0,
    );
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const excedidos = await page.evaluate(() =>
        [...document.querySelectorAll("body *")]
          .filter(
            (n) =>
              n.getBoundingClientRect().right > innerWidth + 1 &&
              n.getBoundingClientRect().width > 0,
          )
          .map((n) => n.tagName + "." + n.className + "#" + n.id),
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        true,
        `${archivo} a ${width}: ${excedidos.join(",")}`,
      );
      if (capturas)
        await page.screenshot({
          path: path.join(
            capturas,
            `${archivo.split("?")[0].replace(".html", "")}-${width}.png`,
          ),
          fullPage: true,
        });
    }
    if (archivo === "marketplace.html") {
      await page.setViewportSize({ width: 360, height: 900 });
      await page.screenshot({
        path: "/tmp/reactiva-marketplace-mobile.png",
        fullPage: true,
      });
    }
  }
});

test("carga visible mientras llegan datos y recuperación de fallo de inicio", async () => {
  let liberar;
  const bloqueo = new Promise((r) => (liberar = r));
  await page.route("**/api/productos?gestion=true", async (route) => {
    await bloqueo;
    await route.continue();
  });
  await abrir("mis-productos.html", { usuario: 2 });
  try {
    await page.waitForFunction(() => typeof guardarProducto === "function");
    assert.match(
      await page.locator("#estadoAplicacion").innerText(),
      /Cargando/,
    );
  } finally {
    liberar();
  }
  await listo("guardarProducto");
  await page.unroute("**/api/productos?gestion=true");
  await page.route("**/api/auth/sesion", (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        mensaje: "Servicio temporalmente no disponible.",
      }),
    }),
  );
  await page.reload();
  await page.getByRole("button", { name: "Reintentar", exact: true }).waitFor();
  assert.match(
    await page.locator("#estadoAplicacion").innerText(),
    /temporalmente/,
  );
  await page.unroute("**/api/auth/sesion");
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await listo("guardarProducto");
});

test("modal: Escape cancela y devuelve el foco; teclado accesible", async () => {
  await abrir("carrito.html", {
    datos: { carrito: [{ usuarioId: 3, productoId: 1, cantidad: 1 }] },
  });
  await listo("vaciarCarrito");
  await page.locator(".boton-vaciar").click();
  await page.locator("dialog[open]").waitFor();
  await page.keyboard.press("Escape");
  await page.locator("dialog").waitFor({ state: "detached" });
  assert.equal(
    await page
      .locator(".boton-vaciar")
      .evaluate((n) => n === document.activeElement),
    true,
  );
  assert.equal((await leer("carrito")).length, 1);
});

test("instancia temporal nueva no reutiliza carritos por coincidencia de IDs", async () => {
  await abrir("carrito.html", {
    datos: { carrito: [{ usuarioId: 3, productoId: 1, cantidad: 3 }] },
  });
  await listo("vaciarCarrito");
  const anterior = await page.evaluate(() => RP.claveCarrito());
  await sistemaNuevo();
  const r = await context.request.post(base + "/api/auth/login", {
    data: { correo: usuarios[2].correo, password: clave },
  });
  assert.equal(r.status(), 200);
  await page.reload();
  await listo("vaciarCarrito");
  assert.notEqual(await page.evaluate(() => RP.claveCarrito()), anterior);
  assert.deepEqual(await leer("carrito"), []);
});

test("precios decimales: subtotal y total conservan centavos", async () => {
  await abrir("carrito.html", {
    datos: {
      productos: [{ ...productos[0], precio: 10.25 }],
      carrito: [{ usuarioId: 3, productoId: 1, cantidad: 2 }],
    },
  });
  await listo("vaciarCarrito");
  assert.match(await page.locator("#resumenTotal").innerText(), /20,50/);
  assert.match(await page.locator("#resumenSubtotal").innerText(), /20,50/);
  assert.match(await page.locator(".carrito-precio").innerText(), /10,25/);
});

test("UI: tarea muestra loading, impide doble envío y restaura el botón tras error", async () => {
  await abrir("login.html", { usuario: 0 });
  await listo("iniciarSesion");
  const boton = page.locator('button[type="submit"]');
  const original = await boton.innerText();
  await page.evaluate(() => {
    window.finTarea = null;
    window.pruebaTarea = UI.tarea(
      document.querySelector('button[type="submit"]'),
      () =>
        new Promise((_, reject) => {
          window.finTarea = reject;
        }),
      "mensaje",
    );
  });
  assert.equal(await boton.isDisabled(), true);
  assert.equal(await boton.getAttribute("aria-busy"), "true");
  assert.match(await boton.innerText(), /Procesando/);
  await page.evaluate(async () => {
    window.finTarea(new Error("Intenta nuevamente"));
    await window.pruebaTarea;
  });
  assert.equal(await boton.isEnabled(), true);
  assert.equal(await boton.innerText(), original);
  assert.match(
    await page.locator("#mensaje").innerText(),
    /Intenta nuevamente/,
  );
});

test("UI: validación asociada al campo y contraseña visible sin perder valor", async () => {
  await abrir("registro.html", { usuario: 0 });
  await listo("registrarUsuario");
  await page.locator('button[type="submit"]').click();
  const campo = page.locator("input:invalid").first();
  assert.equal(await campo.getAttribute("aria-invalid"), "true");
  const id = await campo.getAttribute("aria-describedby");
  assert.ok(id);
  assert.ok((await page.locator('[id="' + id + '"]').innerText()).length > 0);
  await page.locator("#password").fill(clave);
  await page
    .getByRole("button", { name: "Mostrar contraseña", exact: true })
    .click();
  assert.equal(await page.locator("#password").getAttribute("type"), "text");
  assert.equal(await page.locator("#password").inputValue(), clave);
});

test("UI: menú móvil, Escape, foco y navegación vigente", async () => {
  await page.setViewportSize({ width: 360, height: 900 });
  await abrir("marketplace.html");
  await listo("buscarMarketplace");
  const menu = page.getByRole("button", {
    name: "Menú de navegación",
    exact: true,
  });
  await menu.click();
  assert.equal(await menu.getAttribute("aria-expanded"), "true");
  assert.equal(await page.locator("#navegacionPrincipal").isVisible(), true);
  await page.keyboard.press("Escape");
  assert.equal(await menu.getAttribute("aria-expanded"), "false");
  assert.equal(await menu.evaluate((e) => e === document.activeElement), true);
});

test("UI: skeleton durante red lenta, recuperación y estado vacío accionable", async () => {
  await abrir("marketplace.html");
  await listo("buscarMarketplace");
  let liberar;
  const espera = new Promise((r) => {
    liberar = r;
  });
  await page.route("**/api/productos", async (route) => {
    await espera;
    await route.continue();
  });
  await page.reload();
  await page
    .locator("#listaProductos[aria-busy=true] .skeleton-card")
    .first()
    .waitFor();
  liberar();
  await page.waitForFunction(() => document.body.dataset.estado === "listo");
  assert.equal(await page.locator("#listaProductos .skeleton-card").count(), 0);
  assert.equal(
    await page.locator("#listaProductos").getAttribute("aria-busy"),
    "false",
  );
  await page.locator("#buscarMarketplace").fill("inexistente");
  await page.locator("#sinProductos button").click();
  assert.equal(await page.locator("#listaProductos article").count(), 1);
});

test("UI: toast descartable, SVG locales y Coverflow con flechas", async () => {
  await abrir("marketplace.html");
  await listo("buscarMarketplace");
  await page.evaluate(() => UI.estado("Cambios guardados", "exito"));
  assert.match(
    await page.locator("#notificaciones").innerText(),
    /Cambios guardados/,
  );
  await page.getByRole("button", { name: "Descartar notificación" }).click();
  assert.equal(await page.locator("#notificaciones .toast").count(), 0);
  assert.ok(
    (await page
      .locator('svg.icono use[href^="assets/icons/lucide.svg#"]')
      .count()) > 0,
  );
  await page.waitForFunction(() =>
    [...document.querySelectorAll("svg.icono")].some(
      (n) => n.getBBox().width > 0,
    ),
  );
  const primera = page.locator(".categoria-3d").first();
  await primera.focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await page
      .locator(".categoria-3d")
      .nth(1)
      .evaluate((e) => e === document.activeElement),
    true,
  );
});

test("dashboard: indicadores principales y detalle accesible por teclado", async () => {
  await abrir("dashboard.html", { usuario: 1 });
  await listo("presentarResumen");
  assert.equal(
    await page.locator("#kpisAdministrador > .kpi-grid .kpi").count(),
    4,
  );
  assert.equal(
    await page.locator("#kpisAdministrador details .kpi").count(),
    8,
  );
  const resumen = page.locator("#kpisAdministrador summary");
  await resumen.focus();
  await page.keyboard.press("Enter");
  assert.equal(
    await page.locator("#kpisAdministrador details").getAttribute("open"),
    "",
  );
  assert.equal(
    await page.locator('a[aria-current="page"]').getAttribute("href"),
    "dashboard.html",
  );
});

test("landing: ScrollTrigger solo en escritorio y limpieza al cambiar preferencia", async () => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await abrir("index.html", { usuario: 0 });
  await page.waitForFunction(() => document.body.dataset.estado === "listo");
  assert.equal(await page.evaluate(() => ScrollTrigger.getAll().length), 4);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(
    () => !document.documentElement.classList.contains("narrativa-animada"),
  );
  assert.equal(await page.evaluate(() => ScrollTrigger.getAll().length), 0);
  assert.equal(
    await page
      .locator(".story-fragmento")
      .first()
      .evaluate((e) => getComputedStyle(e).opacity),
    "1",
  );
});

test("marketplace: error recuperable y logout móvil disponible", async () => {
  await page.setViewportSize({ width: 360, height: 900 });
  await abrir("marketplace.html");
  await listo("buscarMarketplace");
  await page.route("**/api/productos", (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        mensaje: "Servicio temporalmente ocupado",
      }),
    }),
  );
  await page.evaluate(() => actualizarMarketplace());
  assert.equal(
    await page.locator("#listaProductos").getAttribute("aria-busy"),
    "false",
  );
  assert.match(
    await page.locator("#mensajeMarketplace").innerText(),
    /temporalmente/,
  );
  await page.unroute("**/api/productos");
  await page.getByRole("button", { name: "Reintentar carga" }).click();
  await page.waitForFunction(
    () =>
      !document.querySelector("#reintentarMarketplace") &&
      document.querySelector("#mensajeMarketplace").textContent === "",
  );
  assert.equal(await page.locator("#listaProductos article").count(), 1);
  await page
    .getByRole("button", { name: "Menú de navegación", exact: true })
    .click();
  await page.locator(".salir-movil").click();
  await page.waitForURL("**/login.html");
  assert.equal(
    (await page.evaluate(() => API.get("/auth/sesion"))).usuario,
    null,
  );
});

test("móvil: carrito conserva acciones y gestión ofrece logout en el menú", async () => {
  await page.setViewportSize({ width: 360, height: 900 });
  await abrir("carrito.html", {
    datos: { carrito: [{ usuarioId: 3, productoId: 1, cantidad: 1 }] },
  });
  await listo("vaciarCarrito");
  assert.equal(
    await page
      .getByRole("link", { name: "Seguir comprando", exact: true })
      .isVisible(),
    true,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Cerrar sesión", exact: true })
      .isVisible(),
    true,
  );
  for (const rect of await page
    .locator(".cantidad-controles button")
    .evaluateAll((xs) =>
      xs.map((x) => ({
        width: x.getBoundingClientRect().width,
        height: x.getBoundingClientRect().height,
      })),
    )) {
    assert.ok(rect.width >= 44 && rect.height >= 44);
  }
  await abrir("usuarios.html", { usuario: 1 });
  await listo("guardarUsuario");
  await page
    .getByRole("button", { name: "Menú de navegación", exact: true })
    .click();
  assert.equal(await page.locator(".salir-movil").isVisible(), true);
});

test("accesibilidad: páginas públicas y tres roles sin infracciones WCAG A/AA detectadas", async () => {
  const { AxeBuilder } = require("@axe-core/playwright");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const resultados = [];
  for (const [archivo, usuario] of [
    ["index.html", 0],
    ["marketplace.html", 3],
    ["detalle-producto.html?id=1", 3],
    ["carrito.html", 3],
    ["login.html", 0],
    ["registro.html", 0],
    ["dashboard.html", 1],
    ["usuarios.html", 1],
    ["negocios.html", 1],
    ["mi-negocio.html", 2],
    ["mis-productos.html", 2],
    ["productos.html", 1],
  ]) {
    await abrir(archivo, { usuario });
    await page.waitForFunction(() => document.body.dataset.estado === "listo");
    await page.evaluate(() => document.fonts.ready);
    for (const width of [360, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      resultados.push(
        ...violations.map((v) => ({
          archivo,
          width,
          regla: v.id,
          impacto: v.impact,
          nodos: v.nodes.map((n) => ({
            target: n.target,
            resumen: n.failureSummary,
          })),
        })),
      );
    }
  }
  assert.deepEqual(resultados, []);
});

test("landing: movimiento reducido evita vídeo y ScrollTrigger; acceso inmediato", async () => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await abrir("index.html", { usuario: 0 });
  await page.waitForFunction(() => document.body.dataset.estado === "listo");
  assert.equal(await page.locator("#introPereira").count(), 0);
  assert.equal(
    await page.evaluate(() => window.ScrollTrigger?.getAll().length || 0),
    0,
  );
  assert.equal(
    await page.locator("video").evaluateAll((xs) => xs.every((x) => x.paused)),
    true,
  );
  assert.equal(
    await page
      .locator(".story-fragmento")
      .first()
      .evaluate((e) => getComputedStyle(e).opacity),
    "1",
  );
});
