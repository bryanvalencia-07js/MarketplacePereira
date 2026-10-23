// ======================================================
// RECUPERAR NEGOCIOS
// ======================================================

let negocios =
    JSON.parse(
        localStorage.getItem("negocios")
    ) || [];



// ======================================================
// BUSCAR EL COMERCIO DEL USUARIO ACTUAL
// ======================================================

function obtenerMiNegocio() {

    return negocios.find(
        negocio =>
            negocio.usuarioId ===
            usuarioSesion.id
    );
}



// ======================================================
// GUARDAR LOCALSTORAGE
// ======================================================

function guardarNegocios() {

    localStorage.setItem(
        "negocios",
        JSON.stringify(negocios)
    );
}



// ======================================================
// GUARDAR / ACTUALIZAR MI COMERCIO
// ======================================================

function guardarMiNegocio(event) {

    event.preventDefault();


    const nombre =
        document
            .getElementById("nombreNegocio")
            .value
            .trim();


    const categoria =
        document
            .getElementById("categoria")
            .value;


    const telefono =
        document
            .getElementById("telefono")
            .value
            .trim();


    const direccion =
        document
            .getElementById("direccion")
            .value
            .trim();



    if (
        nombre === "" ||
        categoria === "" ||
        telefono === "" ||
        direccion === ""
    ) {

        mostrarMensajeMiNegocio(
            "Todos los campos son obligatorios.",
            "error"
        );

        return;
    }



    let miNegocio =
        obtenerMiNegocio();



    // ==================================================
    // ACTUALIZAR COMERCIO EXISTENTE
    // ==================================================

    if (miNegocio) {

        miNegocio.nombre =
            nombre;

        miNegocio.categoria =
            categoria;

        miNegocio.telefono =
            telefono;

        miNegocio.direccion =
            direccion;


        guardarNegocios();


        mostrarMensajeMiNegocio(
            "Información actualizada correctamente.",
            "exito"
        );


        cargarMiNegocio();


        return;
    }



    // ==================================================
    // REGISTRAR PRIMER COMERCIO
    // ==================================================

    const nuevoNegocio = {

        id:
            negocios.length > 0

                ? Math.max(
                    ...negocios.map(
                        negocio => negocio.id
                    )
                ) + 1

                : 1,


        // Esta propiedad indica quién
        // es el dueño del comercio.

        usuarioId:
            usuarioSesion.id,


        nombre:
            nombre,


        propietario:
            usuarioSesion.nombre +
            " " +
            usuarioSesion.apellido,


        categoria:
            categoria,


        telefono:
            telefono,


        direccion:
            direccion,


        estado:
            "Activo"
    };


    negocios.push(
        nuevoNegocio
    );


    guardarNegocios();


    mostrarMensajeMiNegocio(
        "Comercio registrado correctamente.",
        "exito"
    );


    cargarMiNegocio();
}



// ======================================================
// CARGAR INFORMACIÓN
// ======================================================

function cargarMiNegocio() {

    const miNegocio =
        obtenerMiNegocio();


    const sinComercio =
        document.getElementById(
            "estadoSinComercio"
        );


    const seccionComercio =
        document.getElementById(
            "seccionMiComercio"
        );



    // ==================================================
    // NO TIENE COMERCIO
    // ==================================================

    if (!miNegocio) {

        sinComercio.hidden =
            false;

        document.getElementById(
            "btnProductos"
        ).hidden = false;

        seccionComercio.hidden =
            true;


        return;
    }



    // ==================================================
    // YA TIENE COMERCIO
    // ==================================================

    sinComercio.hidden =
        true;


    seccionComercio.hidden =
        false;



    // Cambiamos el título porque
    // ya no estamos registrando.

    document.getElementById(
        "tituloFormularioComercio"
    ).innerText =
        "Editar mi comercio";



    // Cargamos los datos en el formulario.

    document.getElementById(
        "nombreNegocio"
    ).value =
        miNegocio.nombre;


    document.getElementById(
        "categoria"
    ).value =
        miNegocio.categoria;


    document.getElementById(
        "telefono"
    ).value =
        miNegocio.telefono;


    document.getElementById(
        "direccion"
    ).value =
        miNegocio.direccion;



    // ==================================================
    // MOSTRAR TARJETA
    // ==================================================

    document.getElementById(
        "inicialComercio"
    ).innerText =
        miNegocio.nombre
            .charAt(0)
            .toUpperCase();


    document.getElementById(
        "vistaNombreNegocio"
    ).innerText =
        miNegocio.nombre;


    document.getElementById(
        "vistaCategoria"
    ).innerText =
        miNegocio.categoria;


    document.getElementById(
        "vistaPropietario"
    ).innerText =
        miNegocio.propietario;


    document.getElementById(
        "vistaTelefono"
    ).innerText =
        miNegocio.telefono;


    document.getElementById(
        "vistaDireccion"
    ).innerText =
        miNegocio.direccion;



    // ==================================================
    // ESTADO
    // ==================================================

    const estado =
        document.getElementById(
            "estadoMiComercio"
        );


    estado.innerText =
        miNegocio.estado;


    estado.className =
        miNegocio.estado === "Activo"

            ? "badge badge-activo"

            : "badge badge-inactivo";
}



// ======================================================
// CAMBIAR ESTADO
// ======================================================

function cambiarEstadoMiNegocio() {

    const miNegocio =
        obtenerMiNegocio();


    if (!miNegocio) {

        return;
    }


    miNegocio.estado =

        miNegocio.estado === "Activo"

            ? "Inactivo"

            : "Activo";


    guardarNegocios();


    cargarMiNegocio();
}



// ======================================================
// MENSAJES
// ======================================================

function mostrarMensajeMiNegocio(
    texto,
    tipo
) {

    const mensaje =
        document.getElementById(
            "mensajeMiNegocio"
        );


    mensaje.innerText =
        texto;


    mensaje.className =
        `mensaje-formulario ${tipo}`;
}



// ======================================================
// INICIO
// ======================================================

cargarMiNegocio();
