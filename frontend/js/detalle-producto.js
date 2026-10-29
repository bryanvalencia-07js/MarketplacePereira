// ======================================================
// RECUPERAR DATOS
// ======================================================

let productos =
    JSON.parse(
        localStorage.getItem("productos")
    ) || [];


const negocios =
    JSON.parse(
        localStorage.getItem("negocios")
    ) || [];


let carrito =
    JSON.parse(
        localStorage.getItem("carrito")
    ) || [];

// ======================================================
// OBTENER ID DESDE LA URL
// ======================================================

const parametros =
    new URLSearchParams(
        window.location.search
    );


const productoId =
    Number(
        parametros.get("id")
    );



// ======================================================
// BUSCAR PRODUCTO
// ======================================================

const producto =
    productos.find(
        producto =>
            Number(producto.id) ===
            productoId
    );



// ======================================================
// BUSCAR COMERCIO
// ======================================================

const negocio =
    producto

        ? negocios.find(
            negocio =>
                Number(negocio.id) ===
                Number(producto.negocioId)
        )

        : null;



// ======================================================
// VALIDAR DISPONIBILIDAD
// ======================================================

const productoDisponible =

    producto &&

    producto.estado ===
        "Activo" &&

    negocio &&

    negocio.estado ===
        "Activo";



if (!productoDisponible) {

    document.getElementById(
        "productoNoEncontrado"
    ).hidden =
        false;

} else {

    document.getElementById(
        "detalleProducto"
    ).hidden =
        false;

const inputCantidad =
    document.getElementById(
        "cantidadProducto"
    );


inputCantidad.max =
    producto.stock;


    // ==================================================
    // IMAGEN
    // ==================================================

    const imagen =
        document.getElementById(
            "detalleImagen"
        );


    const inicial =
        document.getElementById(
            "detalleInicial"
        );


    if (producto.imagen) {

        imagen.src =
            producto.imagen;


        imagen.alt =
            producto.nombre;


        imagen.hidden =
            false;


        inicial.hidden =
            true;

    } else {

        imagen.hidden =
            true;


        inicial.innerText =
            producto.nombre
                .charAt(0)
                .toUpperCase();


        inicial.hidden =
            false;
    }



    // ==================================================
    // INFORMACIÓN DEL PRODUCTO
    // ==================================================

    document.getElementById(
        "detalleCategoria"
    ).innerText =
        producto.categoria;


    document.getElementById(
        "detalleNombre"
    ).innerText =
        producto.nombre;


    document.getElementById(
        "detallePrecio"
    ).innerText =
        "$" +
        Number(
            producto.precio
        ).toLocaleString(
            "es-CO"
        );


    document.getElementById(
        "detalleDescripcion"
    ).innerText =
        producto.descripcion;



    // ==================================================
    // STOCK
    // ==================================================

    const detalleStock =
        document.getElementById(
            "detalleStock"
        );

    const detalleEstado =
        document.getElementById(
            "detalleEstado"
        );

    if (
        Number(producto.stock) > 0
    ) {

        detalleStock.innerText =
            `${producto.stock} unidad(es) disponibles`;
    } else {

        detalleStock.innerText =
            "Agotado";
    }

    detalleEstado.innerText =
        producto.estado || "Sin estado";

    detalleEstado.className =
        producto.estado === "Activo"
            ? "badge badge-activo"
            : "badge badge-inactivo";



    // ==================================================
    // INFORMACIÓN DEL COMERCIO
    // ==================================================

    const negocio =
        producto

            ? negocios.find(
                negocio =>
                    Number(negocio.id) ===
                    Number(producto.negocioId)
            )

            : null;

    // ==================================================
    // SUMAR VISUALIZACIÓN
    // ==================================================

    producto.popularidad =
        Number(
            producto.popularidad || 0
        ) + 1;


    localStorage.setItem(
        "productos",
        JSON.stringify(productos)
    );
}

// ======================================================
// GUARDAR CARRITO
// ======================================================

function guardarCarrito() {

    localStorage.setItem(
        "carrito",
        JSON.stringify(carrito)
    );
}



// ======================================================
// AGREGAR PRODUCTO AL CARRITO
// ======================================================

function agregarAlCarrito() {

    if (!productoDisponible) {

        return;
    }


    const cantidad =
        Number(
            document
                .getElementById(
                    "cantidadProducto"
                )
                .value
        );


    const mensaje =
        document.getElementById(
            "mensajeCarrito"
        );



    // ==============================================
    // VALIDAR CANTIDAD
    // ==============================================

    if (
        cantidad <= 0 ||
        !Number.isInteger(cantidad)
    ) {

        mensaje.innerText =
            "Ingresa una cantidad válida.";

        mensaje.className =
            "mensaje-formulario error";

        return;
    }



    // ==============================================
    // VALIDAR STOCK
    // ==============================================

    if (
        cantidad >
        Number(producto.stock)
    ) {

        mensaje.innerText =
            `Solo hay ${producto.stock} unidad(es) disponibles.`;

        mensaje.className =
            "mensaje-formulario error";

        return;
    }



    // ==============================================
    // BUSCAR SI YA ESTÁ EN EL CARRITO
    // ==============================================

    const productoEnCarrito =
        carrito.find(
            item =>
                Number(item.usuarioId) ===
                    Number(usuarioSesion.id)

                &&

                Number(item.productoId) ===
                    Number(producto.id)
        );



    // ==============================================
    // YA EXISTE
    // ==============================================

    if (productoEnCarrito) {

        const nuevaCantidad =
            Number(
                productoEnCarrito.cantidad
            ) + cantidad;


        if (
            nuevaCantidad >
            Number(producto.stock)
        ) {

            mensaje.innerText =
                `No puedes agregar más de ${producto.stock} unidad(es).`;

            mensaje.className =
                "mensaje-formulario error";

            return;
        }


        productoEnCarrito.cantidad =
            nuevaCantidad;
    }



    // ==============================================
    // PRODUCTO NUEVO EN EL CARRITO
    // ==============================================

    else {

        carrito.push({

            usuarioId:
                usuarioSesion.id,

            productoId:
                producto.id,

            cantidad:
                cantidad
        });
    }



    guardarCarrito();


    actualizarContadorCarrito();


    mensaje.innerText =
        "Producto agregado al carrito.";

    mensaje.className =
        "mensaje-formulario exito";
}



// ======================================================
// CONTADOR DEL CARRITO
// ======================================================

function actualizarContadorCarrito() {

    const contador =
        document.getElementById(
            "contadorCarrito"
        );


    if (!contador) {

        return;
    }


    const carritoUsuario =
        carrito.filter(
            item =>
                Number(item.usuarioId) ===
                Number(usuarioSesion.id)
        );


    const total =
        carritoUsuario.reduce(
            (acumulador, item) =>
                acumulador +
                Number(item.cantidad),

            0
        );


    contador.innerText =
        total;
}

function cambiarCantidadDetalle(cambio) {

    const input =
        document.getElementById(
            "cantidadProducto"
        );


    const visual =
        document.getElementById(
            "cantidadVisual"
        );


    let cantidad =
        Number(input.value);


    const nuevaCantidad =
        cantidad + cambio;


    if (nuevaCantidad < 1) {
        return;
    }


    if (
        nuevaCantidad >
        Number(producto.stock)
    ) {

        const mensaje =
            document.getElementById(
                "mensajeCarrito"
            );


        mensaje.innerText =
            `Solo hay ${producto.stock} unidad(es) disponibles.`;


        mensaje.className =
            "mensaje-formulario error";


        return;
    }


    input.value =
        nuevaCantidad;


    visual.innerText =
        nuevaCantidad;


    document.getElementById(
        "mensajeCarrito"
    ).innerText =
        "";
}

actualizarContadorCarrito();
