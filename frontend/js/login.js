// ======================================================
// RECUPERAR USUARIOS
// ======================================================

// Recuperamos todos los usuarios registrados
// previamente en LocalStorage.
//
// Si no existen usuarios, utilizamos
// un arreglo vacío.

const usuarios =
    JSON.parse(
        localStorage.getItem("usuarios")
    ) || [];



// ======================================================
// INICIAR SESIÓN
// ======================================================

function iniciarSesion(event) {

    // Evitamos que el formulario
    // recargue la página.
    event.preventDefault();


    // Obtenemos los datos ingresados.

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


    const mensaje =
        document.getElementById("mensaje");



    // ==================================================
    // VALIDAR CAMPOS VACÍOS
    // ==================================================

    if (
        correo === "" ||
        password === ""
    ) {

        mensaje.innerText =
            "Debe ingresar correo y contraseña.";

        mensaje.className =
            "mensaje-formulario error";

        return;
    }



    // ==================================================
    // BUSCAR USUARIO
    // ==================================================

    const usuarioEncontrado =
        usuarios.find(
            usuario =>
                usuario.correo === correo &&
                usuario.password === password
        );



    // ==================================================
    // CREDENCIALES INCORRECTAS
    // ==================================================

    if (!usuarioEncontrado) {

        mensaje.innerText =
            "Correo o contraseña incorrectos.";

        mensaje.className =
            "mensaje-formulario error";

        return;
    }



    // ==================================================
    // VALIDAR ESTADO DEL USUARIO
    // ==================================================

    if (
        usuarioEncontrado.estado !== "Activo"
    ) {

        mensaje.innerText =
            "El usuario está inactivo.";

        mensaje.className =
            "mensaje-formulario error";

        return;
    }



    // ==================================================
    // CREAR SESIÓN
    // ==================================================

    localStorage.setItem(
        "usuarioSesion",
        JSON.stringify(usuarioEncontrado)
    );



    // ==================================================
    // MENSAJE DE ÉXITO
    // ==================================================

    mensaje.innerText =
        "Inicio de sesión correcto.";

    mensaje.className =
        "mensaje-formulario exito";



    // ==================================================
    // REDIRECCIONAR AL DASHBOARD
    // ==================================================

    setTimeout(
        function () {

            // ======================================================
            // REDIRECCIONAR SEGÚN EL ROL
            // ======================================================

            if (
                usuarioEncontrado.rol ===
                "Administrador"
            ) {

                window.location.href =
                    "dashboard.html";

            } else if (
                usuarioEncontrado.rol ===
                "Comerciante"
            ) {

                window.location.href =
                    "mi-negocio.html";

            } else if (
                usuarioEncontrado.rol ===
                "Comprador"
            ) {

                window.location.href =
                    "marketplace.html";
            }

        },
        700
    );
}