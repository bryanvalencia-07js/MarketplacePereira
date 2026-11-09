async function cargarFavoritos() {
  const lista = await API.get("/favoritos");
  document.getElementById("listaFavoritos").innerHTML =
    lista
      .map(
        (f) =>
          `<article class="panel-admin"><h2>${RP.escapar(f.producto?.nombre || "Producto no disponible")}</h2>${f.producto ? `<p>${RP.escapar(f.producto.descripcion)}</p><p>${RP.dinero(f.producto.precio)}</p><a class="boton boton-secundario" href="detalle-producto.html?id=${f.productoId}">Ver producto</a>` : "<p>El producto ya no está disponible públicamente.</p>"}<button type="button" class="boton boton-secundario" data-quitar-favorito="${f.id}">Quitar favorito</button></article>`,
      )
      .join("") ||
    '<p class="estado-vacio">No tienes favoritos. <a href="marketplace.html">Explorar productos</a></p>';
}
document
  .getElementById("listaFavoritos")
  .addEventListener("click", async (e) => {
    const b = e.target.closest("[data-quitar-favorito]");
    if (!b) return;
    await UI.tarea(b, async () => {
      await API.delete(`/favoritos/${b.dataset.quitarFavorito}`);
      await cargarFavoritos();
      UI.estado("Favorito eliminado.");
    });
  });
window.moduloListo = cargarFavoritos();
