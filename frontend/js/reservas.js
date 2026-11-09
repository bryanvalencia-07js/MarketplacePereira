const gestionReservas = location.pathname.endsWith("/reservas.html");
const formatoReserva = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  dateStyle: "long",
  timeStyle: "short",
});
async function cargarReservas() {
  const lista = await API.get(
    gestionReservas ? "/reservas/gestion" : "/reservas/mias",
  );
  document.getElementById("listaReservas").innerHTML =
    lista
      .map(
        (r) =>
          `<article class="panel-admin"><span class="modulo-tipo">Reserva #${r.id}</span><h2>${RP.escapar(r.servicio.nombre)}</h2><p>${RP.escapar(r.negocio.nombre)}</p><p>${RP.escapar(formatoReserva.format(new Date(r.fechaHoraInicio)))} · Pereira</p><p>${r.servicio.duracionMinutos} minutos</p><p class="badge ${r.estado === "Confirmada" ? "badge-activo" : "badge-inactivo"}">${RP.escapar(r.estado)}</p>${gestionReservas ? `<p>Comprador #${r.usuarioId}</p>` : ""}${r.estado === "Confirmada" ? `<button type="button" class="boton boton-secundario" data-cancelar-reserva="${r.id}">Cancelar reserva</button>` : ""}</article>`,
      )
      .join("") || '<p class="estado-vacio">No hay reservas para mostrar.</p>';
}
document
  .getElementById("listaReservas")
  .addEventListener("click", async (e) => {
    const b = e.target.closest("[data-cancelar-reserva]");
    if (
      !b ||
      !(await UI.confirmar("¿Cancelar esta reserva? Se liberará su cupo."))
    )
      return;
    await UI.tarea(b, async () => {
      await API.patch(`/reservas/${b.dataset.cancelarReserva}/cancelar`, {});
      await cargarReservas();
      UI.estado("Reserva cancelada.");
    });
  });
window.moduloListo = cargarReservas();
