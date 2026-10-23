// Recuperamos los usuarios almacenados previamente.
// Si todavía no existen, comenzamos con un arreglo vacío.

let usuarios =
    JSON.parse(
        localStorage.getItem("usuarios")
    ) || [];


// ======================================================
// REGISTRAR USUARIO
// ======================================================

function registrarUsuario(event) {

    // Evita que el formulario recargue la página.
    event.preventDefault();


    // Obtenemos los valores escritos en el formulario.

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
        document.getElementById("mensaje");



    // ==================================================
    // VALIDAR CAMPOS OBLIGATORIOS
    // ==================================================

    if (
        nombre === "" ||
        apellido === "" ||
        correo === "" ||
        password === "" ||
        rol === ""
    ) {

        mensaje.innerText =
            "Todos los campos son obligatorios.";

        mensaje.className =
            "mensaje-formulario error";

        return;
    }



    // ==================================================
    // VALIDAR CORREO DUPLICADO
    // ==================================================

    const correoExiste =
        usuarios.some(
            usuario =>
                usuario.correo === correo
        );


    if (correoExiste) {

        mensaje.innerText =
            "El correo ya está registrado.";

        mensaje.className =
            "mensaje-formulario error";

        return;
    }



    // ==================================================
    // CREAR NUEVO USUARIO
    // ==================================================

    const nuevoUsuario = {

        id:
            usuarios.length > 0

                ? Math.max(
                    ...usuarios.map(
                        usuario => usuario.id
                    )
                ) + 1

                : 1,

        nombre: nombre,

        apellido: apellido,

        correo: correo,

        password: password,

        rol: rol,

        estado: "Activo"
    };



    // Agregamos el usuario al arreglo.

    usuarios.push(
        nuevoUsuario
    );



    // Guardamos nuevamente el arreglo completo
    // dentro de LocalStorage.

    localStorage.setItem(
        "usuarios",
        JSON.stringify(usuarios)
    );



    // Mensaje de éxito.

    mensaje.innerText =
        "Usuario registrado correctamente.";

    mensaje.className =
        "mensaje-formulario exito";



    // Después de un pequeño momento,
    // enviamos al usuario al login.

    setTimeout(
        function () {

            window.location.href =
                "login.html";

        },
        1000
    );
}