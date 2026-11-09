let negocios = [];
let comerciantes = [];
async function cargarNegocios() {
  [negocios, comerciantes] = await Promise.all([
    API.get("/negocios?gestion=true"),
    API.get("/usuarios"),
  ]);
  comerciantes = comerciantes.filter((u) => u.rol === "Comerciante");
  const select = document.getElementById("propietario");
  const anterior = select.value;
  select.innerHTML =
    '<option value="">Selecciona un comerciante</option>' +
    comerciantes
      .map(
        (u) =>
          `<option value="${u.id}">${UI.e(u.nombre)} ${UI.e(u.apellido)} · ${UI.e(u.correo)}</option>`,
      )
      .join("");
  select.value = anterior;
  aplicarFiltrosNegocios();
}
function mostrarNegocios(lista) {
  document.getElementById("contadorNegocios").textContent =
    `${lista.length} negocio(s)`;
  document.getElementById("sinNegocios").hidden = lista.length > 0;
  const contenedor = document.getElementById("listaNegocios");
  contenedor.replaceChildren();
  for (const n of lista) {
    const card = document.createElement("article");
    card.className = "negocio-card";
    card.innerHTML = `<div class="negocio-card-superior"><span class="negocio-avatar">${UI.e(n.nombre.charAt(0))}</span><span class="badge ${n.estado === "Activo" ? "badge-activo" : "badge-inactivo"}">${UI.e(n.estado)}</span></div><div class="negocio-card-contenido"><span class="modulo-tipo">${UI.e(n.categoria)}</span><h3>${UI.e(n.nombre)}</h3><p>Propietario: ${UI.e(n.propietario)}</p><p>${UI.e(n.telefono)}</p><p>${UI.e(n.direccion)}</p></div><div class="acciones-tabla"><button class="boton-accion editar">Editar</button><button class="boton-accion estado">Cambiar estado</button><button class="boton-accion eliminar">Eliminar</button></div>`;
    card.querySelector(".editar").onclick = () => editarNegocio(n.id);
    card.querySelector(".estado").onclick = () => cambiarEstadoNegocio(n.id);
    card.querySelector(".eliminar").onclick = () => eliminarNegocio(n.id);
    contenedor.append(card);
  }
}
function aplicarFiltrosNegocios() {
  const texto = document
    .getElementById("buscarNegocio")
    .value.trim()
    .toLowerCase();
  const categoria = document.getElementById("filtroCategoria").value;
  mostrarNegocios(
    negocios.filter(
      (n) =>
        (!categoria || n.categoria === categoria) &&
        `${n.nombre} ${n.propietario}`.toLowerCase().includes(texto),
    ),
  );
}
async function guardarNegocio(event) {
  event.preventDefault();
  await UI.tarea(
    document.querySelector('#formNegocio button[type="submit"]'),
    async () => {
      const id = Number(document.getElementById("negocioId").value);
      const body = {
        nombre: document.getElementById("nombreNegocio").value,
        usuarioId: Number(document.getElementById("propietario").value),
        categoria: document.getElementById("categoria").value,
        telefono: document.getElementById("telefono").value,
        direccion: document.getElementById("direccion").value,
        municipio: document.getElementById("municipio").value,
        descripcion: document.getElementById("descripcionNegocio").value,
      };
      if (id) await API.put(`/negocios/${id}`, body);
      else await API.post("/negocios", body);
      limpiarFormularioNegocio();
      await cargarNegocios();
      UI.estado("Comercio guardado correctamente.", "exito", "mensajeNegocio");
    },
    "mensajeNegocio",
  );
}
async function editarNegocio(id) {
  try {
    const n = await API.get(`/negocios/${id}`);
    document.getElementById("negocioId").value = id;
    for (const [k, v] of Object.entries({
      nombreNegocio: n.nombre,
      propietario: n.usuarioId,
      categoria: n.categoria,
      telefono: n.telefono,
      direccion: n.direccion,
      municipio: n.municipio ?? "",
      descripcionNegocio: n.descripcion ?? "",
    }))
      document.getElementById(k).value = v;
    document.getElementById("tituloNegocio").textContent = "Editar negocio";
    document.getElementById("btnCancelarNegocio").hidden = false;
    document.getElementById("nombreNegocio").focus();
  } catch (error) {
    UI.estado(error.message, "error", "mensajeNegocio");
  }
}
function limpiarFormularioNegocio() {
  document.getElementById("formNegocio").reset();
  document.getElementById("negocioId").value = "";
  document.getElementById("tituloNegocio").textContent = "Registrar negocio";
  document.getElementById("btnCancelarNegocio").hidden = true;
}
function cancelarEdicionNegocio() {
  limpiarFormularioNegocio();
  UI.estado("Edición cancelada.", "exito", "mensajeNegocio");
}
async function cambiarEstadoNegocio(id) {
  try {
    const n = await API.get(`/negocios/${id}`);
    await API.put(`/negocios/${id}`, {
      estado: n.estado === "Activo" ? "Inactivo" : "Activo",
    });
    await cargarNegocios();
    UI.estado("Estado actualizado.", "exito", "mensajeNegocio");
  } catch (error) {
    UI.estado(error.message, "error", "mensajeNegocio");
  }
}
async function eliminarNegocio(id) {
  if (
    !(await UI.confirmar(
      "¿Eliminar este comercio? Primero debe quedar sin productos.",
    ))
  )
    return;
  try {
    await API.delete(`/negocios/${id}`);
    await cargarNegocios();
    UI.estado("Comercio eliminado.", "exito", "mensajeNegocio");
  } catch (error) {
    UI.estado(error.message, "error", "mensajeNegocio");
  }
}
window.moduloListo = cargarNegocios().catch((error) =>
  UI.estado(error.message, "error", "mensajeNegocio"),
);
