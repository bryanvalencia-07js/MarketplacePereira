const escaparServicio = RP.escapar;
const precioServicio = (p) =>
  p === 0 ? "Consultar precio" : `${RP.dinero(p)} de referencia`;
async function cargarServicios() {
  const q = new URLSearchParams();
  const buscar = document.getElementById("buscarServicio").value.trim(),
    categoria = document.getElementById("categoriaServicioFiltro").value;
  if (buscar) q.set("buscar", buscar);
  if (categoria) q.set("categoria", categoria);
  const lista = await API.get(`/servicios?${q}`);
  document.getElementById("listaServicios").innerHTML =
    lista
      .map(
        (s) =>
          `<article class="panel-admin"><span class="modulo-tipo">${escaparServicio(s.categoria)}</span><h2>${escaparServicio(s.nombre)}</h2><p>${escaparServicio(s.descripcion)}</p><p><strong>${precioServicio(s.precioReferencia)}</strong></p><p>${s.duracionMinutos} minutos · ${s.capacidadSimultanea} cupo(s) por horario</p><a class="boton boton-secundario" href="detalle-servicio.html?id=${s.id}">Ver servicio</a></article>`,
      )
      .join("") ||
    '<p class="estado-vacio">No hay servicios para estos filtros.</p>';
}
document.getElementById("filtrosServicios").addEventListener("submit", (e) => {
  e.preventDefault();
  UI.tarea(e.submitter, cargarServicios);
});
window.moduloListo = (async () => {
  const categorias = await API.get("/categorias");
  document
    .getElementById("categoriaServicioFiltro")
    .insertAdjacentHTML(
      "beforeend",
      categorias
        .map(
          (c) =>
            `<option value="${escaparServicio(c.nombre)}">${escaparServicio(c.nombre)}</option>`,
        )
        .join(""),
    );
  await cargarServicios();
})();
