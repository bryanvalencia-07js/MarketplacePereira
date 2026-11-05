let negocios = [];
let productos = [];
let categoriaSeleccionada = "";
let negocioSeleccionado = Number(
  new URLSearchParams(location.search).get("negocioId"),
);
function mostrarProductosMarketplace(lista) {
  document.getElementById("listaProductos").innerHTML = lista
    .map((p) => UI.tarjetaProducto(p, negocios))
    .join("");
  document.getElementById("contadorProductos").textContent =
    `${lista.length} producto(s)`;
  document.getElementById("sinProductos").hidden = lista.length > 0;
}
function buscarMarketplace() {
  const texto = document
    .getElementById("buscarMarketplace")
    .value.trim()
    .toLowerCase();
  const filtrados = productos.filter((p) => {
    if (!RP.visible(p, negocios)) return false;
    const negocio = negocios.find((n) => RP.mismoId(n.id, p.negocioId));
    return (
      (!negocioSeleccionado || RP.mismoId(p.negocioId, negocioSeleccionado)) &&
      (!categoriaSeleccionada || p.categoria === categoriaSeleccionada) &&
      [p.nombre, p.descripcion, p.categoria, negocio.nombre].some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(texto),
      )
    );
  });
  mostrarProductosMarketplace(filtrados);
}
function filtrarCategoria(categoria) {

  categoriaSeleccionada =
    categoria;


  const tarjetas =
    document.querySelectorAll(
      "#carruselCategorias .categoria-3d"
    );


  tarjetas.forEach(
    (tarjeta) => {

      const activa =
        tarjeta.dataset.valor ===
        categoria;


      tarjeta.classList.toggle(
        "activa",
        activa
      );


      tarjeta.setAttribute(
        "aria-pressed",
        String(activa)
      );


      if (activa) {

        centrarCategoria(
          tarjeta
        );

      }

    }
  );


  buscarMarketplace();


  document
    .getElementById("productos")
    .scrollIntoView({
      behavior:
        "smooth",

      block:
        "start",
    });

}
function limpiarFiltros() {

  negocioSeleccionado = 0;

  history.replaceState(
    null,
    "",
    location.pathname
  );


  categoriaSeleccionada = "";

  document
    .getElementById(
      "buscarMarketplace"
    )
    .value = "";


  document
    .querySelectorAll(
      "#carruselCategorias .categoria-3d"
    )
    .forEach((boton) => {

      const activa =
        boton.dataset.valor === "";


      boton.classList.toggle(
        "activa",
        activa
      );


      boton.setAttribute(
        "aria-pressed",
        String(activa)
      );

    });


  buscarMarketplace();

}
function mostrarPopulares() {
  const lista = productos
    .filter((p) => RP.visible(p, negocios))
    .sort((a, b) => (Number(b.popularidad) || 0) - (Number(a.popularidad) || 0))
    .slice(0, 4);
  document.getElementById("productosPopulares").innerHTML =
    lista.map((p) => UI.tarjetaProducto(p, negocios)).join("") ||
    '<p class="estado-vacio">Los productos más visitados aparecerán aquí.</p>';
}
function mostrarComercios() {
  document.getElementById("listaComercios").innerHTML =
    negocios
      .filter((n) => n.estado === "Activo")
      .map(UI.tarjetaNegocio)
      .join("") ||
    '<p class="estado-vacio">Todavía no hay comercios publicados.</p>';
}
async function actualizarMarketplace() {
  UI.estado("Cargando productos…", "carga", "mensajeMarketplace");
  try {
    [negocios, productos] = await Promise.all([
      API.get("/negocios"),
      API.get("/productos"),
    ]);
    buscarMarketplace();
    mostrarPopulares();
    mostrarComercios();
    document.getElementById("productosRecientes").innerHTML =
      productos
        .filter((p) => RP.visible(p, negocios))
        .slice()
        .sort(
          (a, b) =>
            String(b.createdAt || "").localeCompare(
              String(a.createdAt || ""),
            ) || b.id - a.id,
        )
        .slice(0, 4)
        .map((p) => UI.tarjetaProducto(p, negocios))
        .join("") || '<p class="estado-vacio">Pronto habrá novedades.</p>';
    if (usuarioSesion?.rol === "Comprador") await RP.contador(usuarioSesion.id);
    UI.estado("", "exito", "mensajeMarketplace");
  } catch (error) {
    UI.estado(error.message, "error", "mensajeMarketplace");
  }
}
window.addEventListener("storage", (event) => {
  if (event.key === null || event.key === RP.claveCarrito())
    actualizarMarketplace();
});
window.moduloListo = actualizarMarketplace();

window.addEventListener("focus", actualizarMarketplace);
