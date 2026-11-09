let serviciosGestion = [],
  horariosGestion = [],
  servicioEditado = null,
  servicioHorario = null,
  horarioEditado = null;
const diasGestion = [
  "",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
const camposServicio = {
  nombreServicioForm: "nombre",
  categoriaServicio: "categoria",
  precioServicioForm: "precioReferencia",
  duracionServicioForm: "duracionMinutos",
  capacidadServicioForm: "capacidadSimultanea",
  estadoServicio: "estado",
  descripcionServicioForm: "descripcion",
  negocioServicio: "negocioId",
};
function nuevoServicio() {
  servicioEditado = null;
  document.getElementById("formServicio").reset();
  document.getElementById("tituloFormServicio").textContent = "Crear servicio";
  document
    .getElementById("categoriaServicio")
    .querySelector("[data-historica]")
    ?.remove();
}
async function listarServiciosGestion() {
  serviciosGestion = await API.get("/servicios?gestion=true");
  document.getElementById("listaServicios").innerHTML =
    serviciosGestion
      .map(
        (s) =>
          `<article class="panel-admin" data-servicio-card="${s.id}"><h2>${RP.escapar(s.nombre)}</h2><p>${RP.escapar(s.categoria)} · ${RP.escapar(s.estado)}</p><p>${s.duracionMinutos} minutos · ${s.capacidadSimultanea} cupos</p><div class="acciones-formulario"><button type="button" class="boton boton-secundario" data-editar-servicio="${s.id}">Editar servicio</button><button type="button" class="boton boton-secundario" data-horarios-servicio="${s.id}">Gestionar horarios</button><button type="button" class="boton boton-secundario" data-eliminar-servicio="${s.id}">Eliminar servicio</button></div></article>`,
      )
      .join("") || '<p class="estado-vacio">Sin servicios publicados.</p>';
}
async function listarHorariosGestion() {
  horariosGestion = await API.get(`/servicios/${servicioHorario.id}/horarios`);
  document.getElementById("listaHorarios").innerHTML =
    horariosGestion
      .map(
        (h) =>
          `<article class="agenda-horario"><p>${diasGestion[h.diaSemana]} · ${h.horaInicio}–${h.horaFin}</p><div class="acciones-formulario"><button type="button" class="boton boton-secundario" data-editar-horario="${h.id}">Editar horario</button><button type="button" class="boton boton-secundario" data-eliminar-horario="${h.id}">Eliminar horario</button></div></article>`,
      )
      .join("") || "<p>Sin horarios publicados.</p>";
}
document
  .getElementById("nuevoServicio")
  .addEventListener("click", nuevoServicio);
document.getElementById("formServicio").addEventListener("submit", (e) => {
  e.preventDefault();
  UI.tarea(e.submitter, async () => {
    const body = {};
    for (const [id, campo] of Object.entries(camposServicio)) {
      const value = document.getElementById(id).value;
      body[campo] = [
        "precioReferencia",
        "duracionMinutos",
        "capacidadSimultanea",
        "negocioId",
      ].includes(campo)
        ? Number(value)
        : value;
    }
    if (servicioEditado && body.categoria === servicioEditado.categoria)
      delete body.categoria;
    if (servicioEditado)
      await API.put(`/servicios/${servicioEditado.id}`, body);
    else await API.post("/servicios", body);
    nuevoServicio();
    await listarServiciosGestion();
    UI.estado("Servicio guardado.");
  });
});
document
  .getElementById("listaServicios")
  .addEventListener("click", async (e) => {
    const editar = e.target.closest("[data-editar-servicio]"),
      horarios = e.target.closest("[data-horarios-servicio]"),
      eliminar = e.target.closest("[data-eliminar-servicio]");
    if (editar) {
      const s = serviciosGestion.find(
        (s) => s.id === Number(editar.dataset.editarServicio),
      );
      servicioEditado = s;
      const select = document.getElementById("categoriaServicio");
      select.querySelector("[data-historica]")?.remove();
      if (![...select.options].some((o) => o.value === s.categoria)) {
        const op = new Option(`${s.categoria} (inactiva)`, s.categoria);
        op.dataset.historica = "true";
        select.add(op);
      }
      for (const [id, campo] of Object.entries(camposServicio))
        document.getElementById(id).value = s[campo];
      document.getElementById("tituloFormServicio").textContent =
        "Editar servicio";
      document.getElementById("nombreServicioForm").focus();
    }
    if (horarios)
      await UI.tarea(horarios, async () => {
        servicioHorario = serviciosGestion.find(
          (s) => s.id === Number(horarios.dataset.horariosServicio),
        );
        horarioEditado = null;
        document.getElementById("formHorario").reset();
        document.getElementById("gestionHorarios").hidden = false;
        document.getElementById("tituloHorarios").textContent =
          `Horarios de ${servicioHorario.nombre}`;
        await listarHorariosGestion();
        document.getElementById("diaHorario").focus();
      });
    if (
      eliminar &&
      (await UI.confirmar(
        "¿Eliminar este servicio? Si tiene reservas, debes desactivarlo.",
      ))
    )
      await UI.tarea(eliminar, async () => {
        await API.delete(`/servicios/${eliminar.dataset.eliminarServicio}`);
        if (servicioHorario?.id === Number(eliminar.dataset.eliminarServicio))
          document.getElementById("gestionHorarios").hidden = true;
        nuevoServicio();
        await listarServiciosGestion();
        UI.estado("Servicio eliminado.");
      });
  });
document.getElementById("nuevoHorario").addEventListener("click", () => {
  horarioEditado = null;
  document.getElementById("formHorario").reset();
});
document.getElementById("formHorario").addEventListener("submit", (e) => {
  e.preventDefault();
  UI.tarea(
    e.submitter,
    async () => {
      const body = {
        diaSemana: Number(document.getElementById("diaHorario").value),
        horaInicio: document.getElementById("inicioHorario").value,
        horaFin: document.getElementById("finHorario").value,
      };
      if (horarioEditado)
        await API.put(`/horarios-servicio/${horarioEditado.id}`, body);
      else await API.post(`/servicios/${servicioHorario.id}/horarios`, body);
      horarioEditado = null;
      document.getElementById("formHorario").reset();
      await listarHorariosGestion();
      UI.estado("Horario guardado.", "exito", "mensajeHorario");
    },
    "mensajeHorario",
  );
});
document
  .getElementById("listaHorarios")
  .addEventListener("click", async (e) => {
    const editar = e.target.closest("[data-editar-horario]"),
      eliminar = e.target.closest("[data-eliminar-horario]");
    if (editar) {
      horarioEditado = horariosGestion.find(
        (h) => h.id === Number(editar.dataset.editarHorario),
      );
      document.getElementById("diaHorario").value = horarioEditado.diaSemana;
      document.getElementById("inicioHorario").value =
        horarioEditado.horaInicio;
      document.getElementById("finHorario").value = horarioEditado.horaFin;
      document.getElementById("inicioHorario").focus();
    }
    if (
      eliminar &&
      (await UI.confirmar(
        "¿Eliminar este horario? Las reservas confirmadas se conservarán.",
      ))
    )
      await UI.tarea(
        eliminar,
        async () => {
          await API.delete(
            `/horarios-servicio/${eliminar.dataset.eliminarHorario}`,
          );
          horarioEditado = null;
          document.getElementById("formHorario").reset();
          await listarHorariosGestion();
          UI.estado("Horario eliminado.", "exito", "mensajeHorario");
        },
        "mensajeHorario",
      );
  });
window.moduloListo = (async () => {
  const [negocios, categorias] = await Promise.all([
    API.get("/negocios?gestion=true"),
    API.get("/categorias"),
  ]);
  document.getElementById("negocioServicio").innerHTML = negocios
    .map((n) => `<option value="${n.id}">${RP.escapar(n.nombre)}</option>`)
    .join("");
  document
    .getElementById("categoriaServicio")
    .insertAdjacentHTML(
      "beforeend",
      categorias
        .map(
          (c) =>
            `<option value="${RP.escapar(c.nombre)}">${RP.escapar(c.nombre)}</option>`,
        )
        .join(""),
    );
  document.getElementById("formServicio").hidden = negocios.length === 0;
  document.getElementById("sinNegocioServicio").hidden = negocios.length > 0;
  await listarServiciosGestion();
})();
