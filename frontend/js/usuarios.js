// ======================================================
// RECUPERAR USUARIOS
// ======================================================

let usuarios =
    JSON.parse(
        localStorage.getItem("usuarios")
    ) || [];



// ======================================================
// GUARDAR EN LOCALSTORAGE
// ======================================================

function guardarLocalStorage() {

    localStorage.setItem(
        "usuarios",
        JSON.stringify(usuarios)
    );
}



// ======================================================
// MOSTRAR USUARIOS
// ======================================================

function mostrarUsuarios(lista) {

    const contenedor =
        document.getElementById("listaUsuarios");

    const contador =
        document.getElementById("contadorUsuarios");

    const sinUsuarios =
        document.getElementById("sinUsuarios");


    contenedor.innerHTML = "";


    contador.innerText =
        `${lista.length} usuario(s)`;


    if (lista.length === 0) {

        sinUsuarios.hidden = false;

        return;
    }


    sinUsuarios.hidden = true;


    lista.forEach(usuario => {

        const fila =
            document.createElement("tr");


        fila.innerHTML = `

            <td>
                ${usuario.id}
            </td>


            <td>

                <div class="usuario-tabla">

                    <strong>
                        ${usuario.nombre}
                        ${usuario.apellido}
                    </strong>

                </div>

            </td>


            <td>
                ${usuario.correo}
            </td>


            <td>

                <span class="badge badge-rol">
                    ${usuario.rol}
                </span>

            </td>


            <td>

                <span class="
                    badge
                    ${
                        usuario.estado === "Activo"
                            ? "badge-activo"
                            : "badge-inactivo"
                    }
                ">

                    ${usuario.estado}

                </span>

            </td>


            <td>

                <div class="acciones-tabla">

                    <button
                        class="boton-accion editar"
                        onclick="editarUsuario(${usuario.id})"
                    >
                        Editar
                    </button>


                    <button
                        class="boton-accion estado"
                        onclick="cambiarEstado(${usuario.id})"
                    >
                        Cambiar estado
                    </button>


                    <button
                        class="boton-accion eliminar"
                        onclick="eliminarUsuario(${usuario.id})"
                    >
                        Eliminar
                    </button>

                </div>

            </td>

        `;


        contenedor.appendChild(
            fila
        );
    });
}



// ======================================================
// CREATE / UPDATE
// ======================================================

function guardarUsuario(event) {

    event.preventDefault();


    const id =
        document
            .getElementById("usuarioId")
            .value;


    const nombre =
        document
            .getElementById("nombre")
            .value
            .trim();


    const apellido =
        document
            .getElementById("apellido")
            .value
            .trim();


    const correo =
        document
            .getElementById("correo")
            .value
            .trim()
            .toLowerCase();


    const password =
        document
            .getElementById("password")
            .value;


    const rol =
        document
            .getElementById("rol")
            .value;


    const mensaje =
        document.getElementById(
            "mensajeUsuario"
        );



    // Validar campos obligatorios

    if (
        nombre === "" ||
        apellido === "" ||
        correo === "" ||
        rol === ""
    ) {

        mostrarMensaje(
            "Todos los campos obligatorios deben completarse.",
            "error"
        );

        return;
    }



    // ==================================================
    // EDITAR
    // ==================================================

    if (id !== "") {

        const idNumero =
            Number(id);


        const usuario =
            usuarios.find(
                usuario =>
                    usuario.id === idNumero
            );


        if (!usuario) {

            mostrarMensaje(
                "Usuario no encontrado.",
                "error"
            );

            return;
        }


        // Validar correo duplicado,
        // ignorando al usuario que editamos.

        const correoExiste =
            usuarios.some(
                otroUsuario =>

                    otroUsuario.correo === correo &&

                    otroUsuario.id !== idNumero
            );


        if (correoExiste) {

            mostrarMensaje(
                "El correo ya pertenece a otro usuario.",
                "error"
            );

            return;
        }


        usuario.nombre =
            nombre;

        usuario.apellido =
            apellido;

        usuario.correo =
            correo;

        usuario.rol =
            rol;


        // Solo reemplazamos contraseña
        // si el usuario escribió una nueva.

        if (password !== "") {

            usuario.password =
                password;
        }


        guardarLocalStorage();


        mostrarMensaje(
            "Usuario actualizado correctamente.",
            "exito"
        );


        limpiarFormulario();


        aplicarFiltros();


        return;
    }



    // ==================================================
    // CREAR
    // ==================================================

    if (password === "") {

        mostrarMensaje(
            "La contraseña es obligatoria al registrar un usuario.",
            "error"
        );

        return;
    }


    const correoExiste =
        usuarios.some(
            usuario =>
                usuario.correo === correo
        );


    if (correoExiste) {

        mostrarMensaje(
            "El correo ya está registrado.",
            "error"
        );

        return;
    }


    const nuevoUsuario = {

        id:
            usuarios.length > 0

                ? Math.max(
                    ...usuarios.map(
                        usuario => usuario.id
                    )
                ) + 1

                : 1,

        nombre:
            nombre,

        apellido:
            apellido,

        correo:
            correo,

        password:
            password,

        rol:
            rol,

        estado:
            "Activo"
    };


    usuarios.push(
        nuevoUsuario
    );


    guardarLocalStorage();


    mostrarMensaje(
        "Usuario registrado correctamente.",
        "exito"
    );


    limpiarFormulario();


    aplicarFiltros();
}



// ======================================================
// CARGAR USUARIO PARA EDITAR
// ======================================================

function editarUsuario(id) {

    const usuario =
        usuarios.find(
            usuario =>
                usuario.id === id
        );


    if (!usuario) {

        return;
    }


    document.getElementById(
        "usuarioId"
    ).value =
        usuario.id;


    document.getElementById(
        "nombre"
    ).value =
        usuario.nombre;


    document.getElementById(
        "apellido"
    ).value =
        usuario.apellido;


    document.getElementById(
        "correo"
    ).value =
        usuario.correo;


    document.getElementById(
        "password"
    ).value =
        "";


    document.getElementById(
        "rol"
    ).value =
        usuario.rol;


    document.getElementById(
        "tituloFormulario"
    ).innerText =
        "Editar usuario";


    document.getElementById(
        "btnCancelar"
    ).hidden =
        false;


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}



// ======================================================
// CANCELAR EDICIÓN
// ======================================================

function cancelarEdicion() {

    limpiarFormulario();


    document.getElementById(
        "mensajeUsuario"
    ).innerText =
        "";
}



// ======================================================
// DELETE
// ======================================================

function eliminarUsuario(id) {

    const usuario =
        usuarios.find(
            usuario =>
                usuario.id === id
        );


    if (!usuario) {

        return;
    }


    const confirmar =
        confirm(
            `¿Seguro que deseas eliminar a ${usuario.nombre} ${usuario.apellido}?`
        );


    if (!confirmar) {

        return;
    }


    usuarios =
        usuarios.filter(
            usuario =>
                usuario.id !== id
        );


    guardarLocalStorage();


    aplicarFiltros();
}



// ======================================================
// CAMBIAR ACTIVO / INACTIVO
// ======================================================

function cambiarEstado(id) {

    const usuario =
        usuarios.find(
            usuario =>
                usuario.id === id
        );


    if (!usuario) {

        return;
    }


    if (usuario.estado === "Activo") {

        usuario.estado =
            "Inactivo";

    } else {

        usuario.estado =
            "Activo";
    }


    guardarLocalStorage();


    aplicarFiltros();
}



// ======================================================
// BUSCAR Y FILTRAR
// ======================================================

function aplicarFiltros() {

    const texto =
        document
            .getElementById("buscarUsuario")
            .value
            .trim()
            .toLowerCase();


    const rol =
        document
            .getElementById("filtroRol")
            .value;


    const filtrados =
        usuarios.filter(usuario => {

            const coincideTexto =

                usuario.nombre
                    .toLowerCase()
                    .includes(texto)

                ||

                usuario.apellido
                    .toLowerCase()
                    .includes(texto)

                ||

                usuario.correo
                    .toLowerCase()
                    .includes(texto);


            const coincideRol =

                rol === ""

                ||

                usuario.rol === rol;


            return (
                coincideTexto &&
                coincideRol
            );
        });


    mostrarUsuarios(
        filtrados
    );
}



// ======================================================
// LIMPIAR FORMULARIO
// ======================================================

function limpiarFormulario() {

    document
        .getElementById("formUsuario")
        .reset();


    document.getElementById(
        "usuarioId"
    ).value =
        "";


    document.getElementById(
        "tituloFormulario"
    ).innerText =
        "Registrar usuario";


    document.getElementById(
        "btnCancelar"
    ).hidden =
        true;
}



// ======================================================
// MENSAJES
// ======================================================

function mostrarMensaje(
    texto,
    tipo
) {

    const mensaje =
        document.getElementById(
            "mensajeUsuario"
        );


    mensaje.innerText =
        texto;


    mensaje.className =
        `mensaje-formulario ${tipo}`;
}



// ======================================================
// INICIO
// ======================================================

mostrarUsuarios(
    usuarios
);