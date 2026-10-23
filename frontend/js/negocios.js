// ======================================================
// RECUPERAR NEGOCIOS
// ======================================================

let negocios =
    JSON.parse(
        localStorage.getItem("negocios")
    ) || [];



// ======================================================
// GUARDAR LOCALSTORAGE
// ======================================================

function guardarNegociosLocalStorage() {

    localStorage.setItem(
        "negocios",
        JSON.stringify(negocios)
    );
}



// ======================================================
// MOSTRAR NEGOCIOS
// ======================================================

function mostrarNegocios(lista) {

    const contenedor =
        document.getElementById("listaNegocios");

    const contador =
        document.getElementById("contadorNegocios");

    const sinNegocios =
        document.getElementById("sinNegocios");


    contenedor.innerHTML = "";


    contador.innerText =
        `${lista.length} negocio(s)`;


    if (lista.length === 0) {

        sinNegocios.hidden =
            false;

        return;
    }


    sinNegocios.hidden =
        true;


    lista.forEach(negocio => {

        const tarjeta =
            document.createElement("article");


        tarjeta.className =
            "negocio-card";


        tarjeta.innerHTML = `

            <div class="negocio-card-superior">

                <div class="negocio-avatar">

                    ${negocio.nombre.charAt(0).toUpperCase()}

                </div>


                <span class="
                    badge
                    ${
                        negocio.estado === "Activo"
                            ? "badge-activo"
                            : "badge-inactivo"
                    }
                ">

                    ${negocio.estado}

                </span>

            </div>


            <div class="negocio-card-contenido">

                <span class="modulo-tipo">

                    ${negocio.categoria}

                </span>


                <h3>

                    ${negocio.nombre}

                </h3>


                <p>

                    <strong>
                        Propietario:
                    </strong>

                    ${negocio.propietario}

                </p>


                <p>

                    <strong>
                        Teléfono:
                    </strong>

                    ${negocio.telefono}

                </p>


                <p>

                    <strong>
                        Dirección:
                    </strong>

                    ${negocio.direccion}

                </p>

            </div>


            <div class="acciones-tabla">

                <button
                    class="boton-accion editar"
                    onclick="editarNegocio(${negocio.id})"
                >
                    Editar
                </button>


                <button
                    class="boton-accion estado"
                    onclick="cambiarEstadoNegocio(${negocio.id})"
                >
                    Cambiar estado
                </button>


                <button
                    class="boton-accion eliminar"
                    onclick="eliminarNegocio(${negocio.id})"
                >
                    Eliminar
                </button>

            </div>

        `;


        contenedor.appendChild(
            tarjeta
        );
    });
}



// ======================================================
// CREATE / UPDATE
// ======================================================

function guardarNegocio(event) {

    event.preventDefault();


    const id =
        document
            .getElementById("negocioId")
            .value;


    const nombre =
        document
            .getElementById("nombreNegocio")
            .value
            .trim();


    const propietario =
        document
            .getElementById("propietario")
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



    // Validación

    if (
        nombre === "" ||
        propietario === "" ||
        categoria === "" ||
        telefono === "" ||
        direccion === ""
    ) {

        mostrarMensajeNegocio(
            "Todos los campos son obligatorios.",
            "error"
        );

        return;
    }



    // ==================================================
    // UPDATE
    // ==================================================

    if (id !== "") {

        const negocio =
            negocios.find(
                negocio =>
                    negocio.id === Number(id)
            );


        if (!negocio) {

            mostrarMensajeNegocio(
                "Negocio no encontrado.",
                "error"
            );

            return;
        }


        negocio.nombre =
            nombre;

        negocio.propietario =
            propietario;

        negocio.categoria =
            categoria;

        negocio.telefono =
            telefono;

        negocio.direccion =
            direccion;


        guardarNegociosLocalStorage();


        mostrarMensajeNegocio(
            "Negocio actualizado correctamente.",
            "exito"
        );


        limpiarFormularioNegocio();


        aplicarFiltrosNegocios();


        return;
    }



    // ==================================================
    // CREATE
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

        nombre:
            nombre,

        propietario:
            propietario,

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


    guardarNegociosLocalStorage();


    mostrarMensajeNegocio(
        "Negocio registrado correctamente.",
        "exito"
    );


    limpiarFormularioNegocio();


    aplicarFiltrosNegocios();
}



// ======================================================
// EDITAR
// ======================================================

function editarNegocio(id) {

    const negocio =
        negocios.find(
            negocio =>
                negocio.id === id
        );


    if (!negocio) {

        return;
    }


    document.getElementById(
        "negocioId"
    ).value =
        negocio.id;


    document.getElementById(
        "nombreNegocio"
    ).value =
        negocio.nombre;


    document.getElementById(
        "propietario"
    ).value =
        negocio.propietario;


    document.getElementById(
        "categoria"
    ).value =
        negocio.categoria;


    document.getElementById(
        "telefono"
    ).value =
        negocio.telefono;


    document.getElementById(
        "direccion"
    ).value =
        negocio.direccion;


    document.getElementById(
        "tituloNegocio"
    ).innerText =
        "Editar negocio";


    document.getElementById(
        "btnCancelarNegocio"
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

function cancelarEdicionNegocio() {

    limpiarFormularioNegocio();


    document.getElementById(
        "mensajeNegocio"
    ).innerText =
        "";
}



// ======================================================
// DELETE
// ======================================================

function eliminarNegocio(id) {

    const negocio =
        negocios.find(
            negocio =>
                negocio.id === id
        );


    if (!negocio) {

        return;
    }


    const confirmar =
        confirm(
            `¿Seguro que deseas eliminar ${negocio.nombre}?`
        );


    if (!confirmar) {

        return;
    }


    negocios =
        negocios.filter(
            negocio =>
                negocio.id !== id
        );


    guardarNegociosLocalStorage();


    aplicarFiltrosNegocios();
}



// ======================================================
// CAMBIAR ESTADO
// ======================================================

function cambiarEstadoNegocio(id) {

    const negocio =
        negocios.find(
            negocio =>
                negocio.id === id
        );


    if (!negocio) {

        return;
    }


    negocio.estado =
        negocio.estado === "Activo"
            ? "Inactivo"
            : "Activo";


    guardarNegociosLocalStorage();


    aplicarFiltrosNegocios();
}



// ======================================================
// BUSCAR Y FILTRAR
// ======================================================

function aplicarFiltrosNegocios() {

    const texto =
        document
            .getElementById("buscarNegocio")
            .value
            .trim()
            .toLowerCase();


    const categoria =
        document
            .getElementById("filtroCategoria")
            .value;


    const filtrados =
        negocios.filter(negocio => {

            const coincideTexto =

                negocio.nombre
                    .toLowerCase()
                    .includes(texto)

                ||

                negocio.propietario
                    .toLowerCase()
                    .includes(texto);


            const coincideCategoria =

                categoria === ""

                ||

                negocio.categoria === categoria;


            return (
                coincideTexto &&
                coincideCategoria
            );
        });


    mostrarNegocios(
        filtrados
    );
}



// ======================================================
// LIMPIAR FORMULARIO
// ======================================================

function limpiarFormularioNegocio() {

    document
        .getElementById("formNegocio")
        .reset();


    document.getElementById(
        "negocioId"
    ).value =
        "";


    document.getElementById(
        "tituloNegocio"
    ).innerText =
        "Registrar negocio";


    document.getElementById(
        "btnCancelarNegocio"
    ).hidden =
        true;
}



// ======================================================
// MENSAJES
// ======================================================

function mostrarMensajeNegocio(
    texto,
    tipo
) {

    const mensaje =
        document.getElementById(
            "mensajeNegocio"
        );


    mensaje.innerText =
        texto;


    mensaje.className =
        `mensaje-formulario ${tipo}`;
}



// ======================================================
// INICIO
// ======================================================

mostrarNegocios(
    negocios
);