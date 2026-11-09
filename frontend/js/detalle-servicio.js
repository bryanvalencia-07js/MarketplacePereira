const servicioIdDetalle = Number(
  new URLSearchParams(location.search).get("id"),
);
const diasServicio = [
  "",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
const horaPereira = (iso) =>
  new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
let fechaConsultada = "";
async function consultarSlots() {
  document.getElementById("slotsServicio").replaceChildren();
  const dia = document.getElementById("fechaReserva").value;
  const d = await API.get(
    `/servicios/${servicioIdDetalle}/disponibilidad?fecha=${encodeURIComponent(dia)}`,
  );
  fechaConsultada = dia;
  const esComprador = usuarioSesion?.rol === "Comprador";
  document.getElementById("slotsServicio").innerHTML =
    d.slots
      .map(
        (s) =>
          `<article class="agenda-slot"><strong>${horaPereira(s.fechaHoraInicio)}</strong><p>${s.cuposDisponibles} de ${s.capacidadTotal} cupos disponibles</p>${esComprador ? `<button class="boton boton-primario" type="button" data-reservar="${s.fechaHoraInicio}" ${s.disponible ? "" : "disabled"}>${s.disponible ? "Reservar" : "No disponible"}</button>` : ""}</article>`,
      )
      .join("") ||
    '<p class="estado-vacio">No hay horarios para esta fecha.</p>';
}
document
  .getElementById("formDisponibilidad")
  .addEventListener("submit", (e) => {
    e.preventDefault();
    UI.tarea(
      e.submitter,
      async () => {
        await consultarSlots();
        UI.estado("Disponibilidad actualizada.", "exito", "mensajeReserva");
      },
      "mensajeReserva",
    );
  });
document.getElementById("fechaReserva").addEventListener("change", () => {
  fechaConsultada = "";
  document.getElementById("slotsServicio").replaceChildren();
});
document
  .getElementById("slotsServicio")
  .addEventListener("click", async (e) => {
    const b = e.target.closest("[data-reservar]");
    if (!b || !fechaConsultada) return;
    await UI.tarea(
      b,
      async () => {
        const r = await API.post("/reservas", {
          servicioId: servicioIdDetalle,
          fechaHoraInicio: b.dataset.reservar,
        });
        UI.estado(
          `Reserva #${r.id} confirmada. Consulta los datos en Mis reservas.`,
          "exito",
          "mensajeReserva",
        );
        try {
          await consultarSlots();
        } catch {
          document.getElementById("slotsServicio").replaceChildren();
          UI.estado(
            `Reserva #${r.id} confirmada. No pudimos actualizar los cupos; consulta Mis reservas.`,
            "exito",
            "mensajeReserva",
          );
        }
      },
      "mensajeReserva",
    );
  });
window.moduloListo = (async () => {
  const s = await API.get(`/servicios/${servicioIdDetalle}`),
    [n, horarios] = await Promise.all([
      API.get(`/negocios/${s.negocioId}`),
      API.get(`/servicios/${s.id}/horarios`),
    ]);
  const datos = {
    nombreServicio: s.nombre,
    categoriaServicioDetalle: s.categoria,
    descripcionServicio: s.descripcion,
    precioServicio:
      s.precioReferencia === 0
        ? "Consultar precio"
        : `${RP.dinero(s.precioReferencia)} de referencia`,
    duracionServicio: `${s.duracionMinutos} minutos · ${s.capacidadSimultanea} cupo(s) simultáneos`,
    comercioServicio: `${n.nombre} · ${n.direccion} · ${n.telefono}`,
  };
  for (const [id, valor] of Object.entries(datos))
    document.getElementById(id).textContent = valor;
  document.getElementById("horariosServicio").innerHTML =
    horarios
      .map(
        (h) =>
          `<li>${diasServicio[h.diaSemana]}: ${h.horaInicio}–${h.horaFin}</li>`,
      )
      .join("") || "<li>Sin horarios publicados.</li>";
  document.getElementById("fechaReserva").min = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  ).format(new Date());
  document.getElementById("accesoReserva").textContent =
    usuarioSesion?.rol === "Comprador"
      ? "Selecciona un horario disponible para confirmar tu reserva."
      : "Inicia sesión con una cuenta Comprador para reservar.";
  document.getElementById("enlaceMisReservas").hidden =
    usuarioSesion?.rol !== "Comprador";
})();
