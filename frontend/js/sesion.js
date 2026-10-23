// ======================================================
// RECUPERAR USUARIO EN SESIÓN
// ======================================================

const usuarioSesion =
    JSON.parse(
        localStorage.getItem("usuarioSesion")
    );



// ======================================================
// PROTEGER PÁGINAS
// ======================================================

if (!usuarioSesion) {

    window.location.href =
        "login.html";
}



// ======================================================
// MOSTRAR DATOS DEL USUARIO
// ======================================================

if (usuarioSesion) {

    const bienvenida =
        document.getElementById("bienvenida");

    const nombreUsuario =
        document.getElementById("nombreUsuario");

    const rolUsuario =
        document.getElementById("rolUsuario");


    if (bienvenida) {

        bienvenida.innerText =
            "Bienvenido, " +
            usuarioSesion.nombre +
            " " +
            usuarioSesion.apellido;
    }


    if (nombreUsuario) {

        nombreUsuario.innerText =
            usuarioSesion.nombre +
            " " +
            usuarioSesion.apellido;
    }


    if (rolUsuario) {

        rolUsuario.innerText =
            usuarioSesion.rol;
    }
}



// ======================================================
// AUTORIZACIÓN SEGÚN ROL
// ======================================================

function protegerPorRol(
    rolesPermitidos
) {

    if (!usuarioSesion) {

        return;
    }


    const permitido =
        rolesPermitidos.includes(
            usuarioSesion.rol
        );


    if (!permitido) {

        alert(
            "No tienes permisos para acceder a este módulo."
        );


        window.location.href =
            "dashboard.html";
    }
}



// ======================================================
// CREAR DASHBOARD SEGÚN ROL
// ======================================================

function cargarModulosDashboard() {

    const contenedor =
        document.getElementById(
            "modulosDashboard"
        );


    // Si esta página no tiene
    // el dashboard, no hacemos nada.
    if (!contenedor) {

        return;
    }


    let contenido = "";



    // ==================================================
    // ADMINISTRADOR
    // ==================================================

    if (
        usuarioSesion.rol ===
        "Administrador"
    ) {

        contenido += `

            <article class="modulo-card">

                <div class="modulo-icono">
                    U
                </div>

                <div>

                    <span class="modulo-tipo">
                        Administración
                    </span>

                    <h2>
                        Usuarios
                    </h2>

                    <p>
                        Registra, consulta, edita,
                        elimina y administra los
                        usuarios de la plataforma.
                    </p>

                </div>

                <a
                    href="usuarios.html"
                    class="boton boton-primario"
                >
                    Gestionar usuarios
                </a>

            </article>

        `;


        contenido += `

            <article class="modulo-card">

                <div class="modulo-icono">
                    N
                </div>

                <div>

                    <span class="modulo-tipo">
                        Administración
                    </span>

                    <h2>
                        Negocios
                    </h2>

                    <p>
                        Consulta y administra todos
                        los negocios registrados en
                        Reactiva Pereira.
                    </p>

                </div>

                <a
                    href="negocios.html"
                    class="boton boton-primario"
                >
                    Gestionar negocios
                </a>

            </article>

        `;
    }



    // ==================================================
    // COMERCIANTE
    // ==================================================

    if (
        usuarioSesion.rol ===
        "Comerciante"
    ) {

        contenido += `

            <article class="modulo-card">

                <div class="modulo-icono">
                    M
                </div>

                <div>

                    <span class="modulo-tipo">
                        Mi espacio
                    </span>

                    <h2>
                        Mi comercio
                    </h2>

                    <p>
                        Registra y administra
                        únicamente la información
                        de tu propio comercio.
                    </p>

                </div>

                <a
                    href="mi-negocio.html"
                    class="boton boton-primario"
                >
                    Administrar mi comercio
                </a>

            </article>

        `;
    }



    // ==================================================
    // COMPRADOR
    // ==================================================

    if (
        usuarioSesion.rol ===
        "Comprador"
    ) {

        contenido += `

            <article class="modulo-card">

                <div class="modulo-icono">
                    P
                </div>

                <div>

                    <span class="modulo-tipo">
                        Marketplace
                    </span>

                    <h2>
                        Explorar comercios
                    </h2>

                    <p>
                        Descubre negocios locales
                        registrados en Reactiva Pereira
                        y conoce lo que ofrecen.
                    </p>

                </div>

                <a
                    href="comercios.html"
                    class="boton boton-primario"
                >
                    Explorar comercios
                </a>

            </article>

        `;
    }



    contenedor.innerHTML =
        contenido;
}



// ======================================================
// CERRAR SESIÓN
// ======================================================

function cerrarSesion() {

    localStorage.removeItem(
        "usuarioSesion"
    );


    window.location.href =
        "login.html";
}



// ======================================================
// INICIAR DASHBOARD
// ======================================================

if (usuarioSesion) {

    cargarModulosDashboard();
}