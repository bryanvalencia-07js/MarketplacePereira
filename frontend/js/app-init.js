/* Enlaces de eventos sin JavaScript inline: compatibles con CSP script-src self. */
const accionesPermitidas = new Set([
  "cerrarSesion",
  "iniciarSesion",
  "registrarUsuario",
  "guardarMiNegocio",
  "cambiarEstadoMiNegocio",
  "guardarProducto",
  "previsualizarImagen",
  "cancelarEdicionProducto",
  "filtrarMisProductos",
  "buscarMarketplace",
  "limpiarFiltros",
  "filtrarCategoria",
  "moverCarruselCategorias",
  "cambiarCantidadDetalle",
  "agregarAlCarrito",
  "vaciarCarrito",
  "guardarUsuario",
  "cancelarEdicion",
  "aplicarFiltros",
  "guardarNegocio",
  "cancelarEdicionNegocio",
  "aplicarFiltrosNegocios",
]);
UI.preparar();
const esqueletos = [
  ...document.querySelectorAll(
    "#listaProductos, #productosPopulares, #productosRecientes, #listaComercios, #landingProductos, #landingComercios, #kpisAdministrador, #kpisComerciante",
  ),
];
esqueletos.forEach((nodo) => UI.carga(nodo));
for (const evento of ["click", "submit", "input", "change"])
  document.addEventListener(evento, async (e) => {
    const nodo = e.target.closest(`[data-${evento}]`);
    if (!nodo || !accionesPermitidas.has(nodo.dataset[evento])) return;
    if (evento === "submit" || evento === "click") e.preventDefault();
    const accion = window[nodo.dataset[evento]];
    if (typeof accion !== "function") return;
    const argumento = nodo.hasAttribute("data-numero")
      ? Number(nodo.dataset.numero)
      : nodo.hasAttribute("data-valor")
        ? nodo.dataset.valor
        : e;
    try {
      await accion(argumento);
    } catch (error) {
      UI.estado(error.message, "error");
    }
  });
function cargarScript(archivo) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = archivo;
    script.onload = resolve;
    script.onerror = () =>
      reject(new Error("No se pudo cargar el módulo. Recarga la página."));
    document.body.append(script);
  });
}
(async () => {
  const pagina = location.pathname.split("/").pop() || "index.html";
  const paginas = {
    "index.html": { script: "landing" },
    "login.html": { script: "login" },
    "registro.html": { script: "registro" },
    "marketplace.html": { script: "marketplace" },
    "detalle-producto.html": { script: "detalle-producto" },
    "carrito.html": { script: "carrito", roles: ["Comprador"] },
    "mi-negocio.html": { script: "mi-negocio", roles: ["Comerciante"] },
    "mis-productos.html": { script: "mis-productos", roles: ["Comerciante"] },
    "productos.html": { script: "mis-productos", roles: ["Administrador"] },
    "dashboard.html": { script: "dashboard", roles: ["Administrador"] },
    "usuarios.html": { script: "usuarios", roles: ["Administrador"] },
    "negocios.html": { script: "negocios", roles: ["Administrador"] },
  };
  const config = paginas[pagina];
  if (!config) return;
  try {
    UI.estado("Cargando…", "carga");
    await sesionLista;
    if (config.roles && !protegerPorRol(config.roles)) return;
    if (config.script === "mis-productos") await cargarScript("js/imagenes.js");
    await cargarScript(`js/${config.script}.js`);
    if (window.moduloListo) await window.moduloListo;
    if (
      document.getElementById("estadoAplicacion")?.classList.contains("carga")
    )
      UI.estado("", "exito");
    document.body.dataset.estado = "listo";
  } catch (error) {
    UI.estado(error.message, "error");
    const reintentar = document.createElement("button");
    reintentar.className = "boton boton-secundario";
    reintentar.textContent = "Reintentar";
    reintentar.addEventListener("click", () => location.reload());
    document.querySelector("main")?.append(reintentar);
  } finally {
    esqueletos.forEach((nodo) => UI.carga(nodo, false));
  }
})();
