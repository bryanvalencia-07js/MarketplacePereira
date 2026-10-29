let usuarios = [];
async function cargarUsuarios() {
  usuarios = await API.get("/usuarios");
  aplicarFiltros();
}
function mostrarUsuarios(lista) {
  document.getElementById("contadorUsuarios").textContent =
    `${lista.length} usuario(s)`;
  document.getElementById("sinUsuarios").hidden = lista.length > 0;
  const contenedor = document.getElementById("listaUsuarios");
  contenedor.replaceChildren();
  for (const u of lista) {
    const fila = document.createElement("tr");
    fila.innerHTML = `<td>${u.id}</td><td><strong>${UI.e(u.nombre)} ${UI.e(u.apellido)}</strong></td><td>${UI.e(u.correo)}</td><td><span class="badge badge-rol">${UI.e(u.rol)}</span></td><td><span class="badge ${u.estado === "Activo" ? "badge-activo" : "badge-inactivo"}">${UI.e(u.estado)}</span></td><td><div class="acciones-tabla"><button class="boton-accion editar">Editar</button><button class="boton-accion estado">Cambiar estado</button><button class="boton-accion eliminar">Eliminar</button></div></td>`;
    fila.querySelector(".editar").onclick = () => editarUsuario(u.id);
    fila.querySelector(".estado").onclick = () => cambiarEstado(u.id);
    fila.querySelector(".eliminar").onclick = () => eliminarUsuario(u.id);
    contenedor.append(fila);
  }
}
function aplicarFiltros() {
  const texto = document
    .getElementById("buscarUsuario")
    .value.trim()
    .toLowerCase();
  const rol = document.getElementById("filtroRol").value;
  mostrarUsuarios(
    usuarios.filter(
      (u) =>
        (!rol || u.rol === rol) &&
        `${u.nombre} ${u.apellido} ${u.correo}`.toLowerCase().includes(texto),
    ),
  );
}
async function guardarUsuario(event) {
  event.preventDefault();
  await UI.tarea(
    document.querySelector('#formUsuario button[type="submit"]'),
    async () => {
      const id = Number(document.getElementById("usuarioId").value);
      const body = {};
      for (const k of ["nombre", "apellido", "correo", "rol"])
        body[k] = document.getElementById(k).value;
      const password = document.getElementById("password").value;
      if (password || !id) body.password = password;
      if (id) await API.put(`/usuarios/${id}`, body);
      else await API.post("/usuarios", body);
      limpiarFormulario();
      await cargarUsuarios();
      UI.estado("Usuario guardado correctamente.", "exito", "mensajeUsuario");
    },
    "mensajeUsuario",
  );
}
async function editarUsuario(id) {
  try {
    const u = await API.get(`/usuarios/${id}`);
    document.getElementById("usuarioId").value = u.id;
    for (const k of ["nombre", "apellido", "correo", "rol"])
      document.getElementById(k).value = u[k];
    document.getElementById("password").value = "";
    document.getElementById("tituloFormulario").textContent = "Editar usuario";
    document.getElementById("btnCancelar").hidden = false;
    document.getElementById("nombre").focus();
  } catch (error) {
    UI.estado(error.message, "error", "mensajeUsuario");
  }
}
function limpiarFormulario() {
  document.getElementById("formUsuario").reset();
  document.getElementById("usuarioId").value = "";
  document.getElementById("tituloFormulario").textContent = "Registrar usuario";
  document.getElementById("btnCancelar").hidden = true;
}
function cancelarEdicion() {
  limpiarFormulario();
  UI.estado("Edición cancelada.", "exito", "mensajeUsuario");
}
async function cambiarEstado(id) {
  try {
    const u = await API.get(`/usuarios/${id}`);
    await API.put(`/usuarios/${id}`, {
      estado: u.estado === "Activo" ? "Inactivo" : "Activo",
    });
    await cargarUsuarios();
    UI.estado("Estado actualizado.", "exito", "mensajeUsuario");
  } catch (error) {
    UI.estado(error.message, "error", "mensajeUsuario");
  }
}
async function eliminarUsuario(id) {
  if (
    !(await UI.confirmar(
      "¿Eliminar este usuario? No podrá iniciar sesión nuevamente.",
    ))
  )
    return;
  try {
    await API.delete(`/usuarios/${id}`);
    await cargarUsuarios();
    UI.estado("Usuario eliminado.", "exito", "mensajeUsuario");
  } catch (error) {
    UI.estado(error.message, "error", "mensajeUsuario");
  }
}
window.moduloListo = cargarUsuarios().catch((error) =>
  UI.estado(error.message, "error", "mensajeUsuario"),
);
