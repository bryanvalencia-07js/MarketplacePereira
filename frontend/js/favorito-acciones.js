// La API es la fuente de verdad; no hay favoritos en LocalStorage.
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-favorito-producto]");
  if (!b || usuarioSesion?.rol !== "Comprador") return;
  await UI.tarea(b, async () => {
    await API.post("/favoritos", {
      productoId: Number(b.dataset.favoritoProducto),
    });
    UI.estado("Producto guardado en favoritos.");
  });
});
