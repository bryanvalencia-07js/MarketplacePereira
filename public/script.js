
const API_URL = "/api/usuarios";


const tabla = document.getElementById("tablaUsuarios");
const totalUsuarios = document.getElementById("totalUsuarios");
const aviso = document.getElementById("aviso");

const modal = document.getElementById("modal");
const tituloModal = document.getElementById("tituloModal");
const formulario = document.getElementById("formUsuario");
const errorFormulario = document.getElementById("errorFormulario");
const btnGuardar = document.getElementById("btnGuardar");

const btnNuevo = document.getElementById("btnNuevo");
const btnCerrar = document.getElementById("btnCerrar");
const btnCancelar = document.getElementById("btnCancelar");

const inputId = document.getElementById("idUsuario");
const inputNombre = document.getElementById("nombre");
const inputApellido = document.getElementById("apellido");
const inputCorreo = document.getElementById("correo");
const inputTelefono = document.getElementById("telefono");
const inputRol = document.getElementById("rol");





function abrirModal() {
    modal.classList.remove("oculto");
}


function cerrarModal() {
    modal.classList.add("oculto");
    formulario.reset();
    inputId.value = "";
    errorFormulario.textContent = "";
}


btnNuevo.addEventListener("click", function () {
    tituloModal.textContent = "Nuevo usuario";
    btnGuardar.textContent = "Guardar";
    abrirModal();
});

btnCerrar.addEventListener("click", cerrarModal);
btnCancelar.addEventListener("click", cerrarModal);


modal.addEventListener("click", function (evento) {
    if (evento.target === modal) {
        cerrarModal();
    }
});



function mostrarAviso(texto, esError) {
    aviso.textContent = texto;
    aviso.className = "aviso";

    if (esError) {
        aviso.classList.add("error");
    }

   
    setTimeout(function () {
        aviso.classList.add("oculto");
    }, 3000);
}



async function cargarUsuarios() {
    try {
        const respuesta = await fetch(API_URL);
        const datos = await respuesta.json();

        const listaUsuarios = datos.usuarios;

        totalUsuarios.textContent = datos.total + " usuarios registrados";

        tabla.innerHTML = "";

        if (listaUsuarios.length === 0) {
            tabla.innerHTML = `<tr><td colspan="5" class="vacio">No hay usuarios todavía</td></tr>`;
            return;
        }

        listaUsuarios.forEach(function (usuario) {
            const fila = document.createElement("tr");

            const iniciales = usuario.nombre[0] + usuario.apellido[0];

            let claseRol = "etiqueta-cliente";
            if (usuario.rol === "Administrador") {
                claseRol = "etiqueta-admin";
            }

            fila.innerHTML = `
                <td>
                    <div class="usuario-celda">
                        <div class="avatar">${iniciales.toUpperCase()}</div>
                        <div>
                            <div class="nombre-completo">${usuario.nombre} ${usuario.apellido}</div>
                            <div class="id-usuario">ID: ${usuario.id}</div>
                        </div>
                    </div>
                </td>
                <td>${usuario.correo}</td>
                <td>${usuario.telefono || "-"}</td>
                <td><span class="etiqueta ${claseRol}">${usuario.rol || "Sin rol"}</span></td>
                <td class="acciones">
                    <button class="btn-tabla" onclick="editarUsuario(${usuario.id})">Editar</button>
                    <button class="btn-tabla btn-tabla-eliminar" onclick="eliminarUsuario(${usuario.id})">Eliminar</button>
                </td>
            `;

            tabla.appendChild(fila);
        });

    } catch (error) {
        totalUsuarios.textContent = "Error de conexión";
        mostrarAviso("No se pudo conectar con la API. ¿Está encendido el servidor?", true);
    }
}


formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    const usuario = {
        nombre: inputNombre.value,
        apellido: inputApellido.value,
        correo: inputCorreo.value,
        telefono: inputTelefono.value,
        rol: inputRol.value
    };

    const id = inputId.value;
    let url = API_URL;
    let metodo = "POST";

    if (id) {
        url = API_URL + "/" + id;
        metodo = "PUT";
    }

    try {
        const respuesta = await fetch(url, {
            method: metodo,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(usuario)
        });

        const datos = await respuesta.json();

        if (respuesta.ok) {
            cerrarModal();
            mostrarAviso(datos.mensaje, false);
            cargarUsuarios();
        } else {
            // Mostramos el error dentro del modal (ej: correo repetido)
            errorFormulario.textContent = datos.mensaje;
        }

    } catch (error) {
        errorFormulario.textContent = "No se pudo conectar con la API.";
    }
});


async function editarUsuario(id) {
    try {
        const respuesta = await fetch(API_URL + "/" + id);
        const usuario = await respuesta.json();

        inputId.value = usuario.id;
        inputNombre.value = usuario.nombre;
        inputApellido.value = usuario.apellido;
        inputCorreo.value = usuario.correo;
        inputTelefono.value = usuario.telefono || "";
        inputRol.value = usuario.rol || "Cliente";

        tituloModal.textContent = "Actualizar usuario";
        btnGuardar.textContent = "Actualizar";
        abrirModal();

    } catch (error) {
        mostrarAviso("No se pudo cargar el usuario.", true);
    }
}


async function eliminarUsuario(id) {
    // Preguntamos antes de borrar
    const confirmar = confirm("¿Seguro que quieres eliminar este usuario?");

    if (!confirmar) {
        return;
    }

    try {
        const respuesta = await fetch(API_URL + "/" + id, {
            method: "DELETE"
        });

        const datos = await respuesta.json();

        if (respuesta.ok) {
            mostrarAviso(datos.mensaje, false);
            cargarUsuarios();
        } else {
            mostrarAviso(datos.mensaje, true);
        }

    } catch (error) {
        mostrarAviso("No se pudo conectar con la API.", true);
    }
}


cargarUsuarios();
