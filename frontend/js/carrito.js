// ======================================================
// RECUPERAR DATOS
// ======================================================

let carrito =
    JSON.parse(
        localStorage.getItem("carrito")
    ) || [];


const productos =
    JSON.parse(
        localStorage.getItem("productos")
    ) || [];


const negocios =
    JSON.parse(
        localStorage.getItem("negocios")
    ) || [];



// ======================================================
// OBTENER SOLO EL CARRITO DEL USUARIO ACTUAL
// ======================================================

function obtenerCarritoUsuario() {

    return carrito.filter(
        item =>
            Number(item.usuarioId) ===
            Number(usuarioSesion.id)
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
// MOSTRAR CARRITO
// ======================================================

function mostrarCarrito() {

    const lista =
        document.getElementById(
            "listaCarrito"
        );


    const carritoVacio =
        document.getElementById(
            "carritoVacio"
        );


    const contenido =
        document.getElementById(
            "contenidoCarrito"
        );


    const itemsUsuario =
        obtenerCarritoUsuario();


    lista.innerHTML =
        "";



    // ==================================================
    // CARRITO VACÍO
    // ==================================================

    if (
        itemsUsuario.length === 0
    ) {

        carritoVacio.hidden =
            false;


        contenido.hidden =
            true;


        return;
    }



    carritoVacio.hidden =
        true;


    contenido.hidden =
        false;



    // ==================================================
    // MOSTRAR PRODUCTOS
    // ==================================================

    itemsUsuario.forEach(item => {

        const producto =
            productos.find(
                producto =>
                    Number(producto.id) ===
                    Number(item.productoId)
            );


        // Si el producto fue eliminado,
        // no intentamos mostrarlo.

        if (!producto) {

            return;
        }


        const negocio =
            negocios.find(
                negocio =>
                    Number(negocio.id) ===
                    Number(producto.negocioId)
            );


        const subtotal =
            Number(producto.precio) *
            Number(item.cantidad);


        const tarjeta =
            document.createElement(
                "article"
            );


        tarjeta.className =
            "carrito-producto";


        tarjeta.innerHTML = `

            <div class="carrito-producto-imagen">

                ${
                    producto.imagen

                        ? `
                            <img
                                src="${producto.imagen}"
                                alt="${producto.nombre}"
                            >
                        `

                        : `
                            <span>
                                ${producto.nombre
                                    .charAt(0)
                                    .toUpperCase()}
                            </span>
                        `
                }

            </div>


            <div class="carrito-producto-info">

                <span class="producto-categoria">
                    ${producto.categoria}
                </span>


                <h3>
                    ${producto.nombre}
                </h3>


                <p>
                    ${
                        negocio
                            ? negocio.nombre
                            : "Comercio local"
                    }
                </p>


                <strong class="carrito-precio">

                    $${Number(
                        producto.precio
                    ).toLocaleString("es-CO")}

                </strong>


                <button
                    class="carrito-eliminar"
                    onclick="eliminarDelCarrito(${producto.id})"
                >
                    Eliminar
                </button>

            </div>


            <div class="carrito-producto-cantidad">

                <span>
                    Cantidad
                </span>


                <div class="cantidad-controles">

                    <button
                        onclick="cambiarCantidad(
                            ${producto.id},
                            -1
                        )"
                    >
                        −
                    </button>


                    <strong>
                        ${item.cantidad}
                    </strong>


                    <button
                        onclick="cambiarCantidad(
                            ${producto.id},
                            1
                        )"
                    >
                        +
                    </button>

                </div>


                <small>
                    Stock: ${producto.stock}
                </small>


                <small
                    id="mensaje-stock-${producto.id}"
                    class="mensaje-stock"
                >
                </small>

            </div>


            <div class="carrito-producto-subtotal">

                <span>
                    Subtotal
                </span>

                <strong>

                    $${subtotal.toLocaleString(
                        "es-CO"
                    )}

                </strong>

            </div>

        `;


        lista.appendChild(
            tarjeta
        );
    });


    actualizarResumen();
}



// ======================================================
// CAMBIAR CANTIDAD
// ======================================================

function cambiarCantidad(
    productoId,
    cambio
) {

    const item =
        carrito.find(
            item =>
                Number(item.usuarioId) ===
                    Number(usuarioSesion.id)

                &&

                Number(item.productoId) ===
                    Number(productoId)
        );


    const producto =
        productos.find(
            producto =>
                Number(producto.id) ===
                Number(productoId)
        );


    if (
        !item ||
        !producto
    ) {

        return;
    }


    const nuevaCantidad =
        Number(item.cantidad) +
        cambio;



    // Si intenta bajar de 1,
    // eliminamos el producto.

    if (
        nuevaCantidad <= 0
    ) {

        eliminarDelCarrito(
            productoId
        );

        return;
    }



    // No permitir superar stock.

    if (
        nuevaCantidad >
        Number(producto.stock)
    ) {

        const mensajeStock =
            document.getElementById(
                `mensaje-stock-${producto.id}`
            );


        if (mensajeStock) {

            mensajeStock.innerText =
                `Solo hay ${producto.stock} unidad(es) disponibles.`;
        }


        return;
    }

const mensajeStock =
    document.getElementById(
        `mensaje-stock-${producto.id}`
    );


if (mensajeStock) {

    mensajeStock.innerText =
        "";
}


    item.cantidad =
        nuevaCantidad;


    guardarCarrito();


    mostrarCarrito();
}



// ======================================================
// ELIMINAR PRODUCTO
// ======================================================

function eliminarDelCarrito(
    productoId
) {

    carrito =
        carrito.filter(
            item =>

                !(
                    Number(item.usuarioId) ===
                        Number(usuarioSesion.id)

                    &&

                    Number(item.productoId) ===
                        Number(productoId)
                )
        );


    guardarCarrito();


    mostrarCarrito();
}



// ======================================================
// VACIAR CARRITO
// ======================================================

function vaciarCarrito() {

    const confirmar =
        confirm(
            "¿Seguro que deseas vaciar tu carrito?"
        );


    if (!confirmar) {

        return;
    }


    // Eliminamos solamente los productos
    // del usuario conectado.

    carrito =
        carrito.filter(
            item =>
                Number(item.usuarioId) !==
                Number(usuarioSesion.id)
        );


    guardarCarrito();


    mostrarCarrito();
}



// ======================================================
// ACTUALIZAR RESUMEN
// ======================================================

function actualizarResumen() {

    const itemsUsuario =
        obtenerCarritoUsuario();


    let cantidadTotal =
        0;


    let subtotalTotal =
        0;


    itemsUsuario.forEach(item => {

        const producto =
            productos.find(
                producto =>
                    Number(producto.id) ===
                    Number(item.productoId)
            );


        if (!producto) {

            return;
        }


        cantidadTotal +=
            Number(item.cantidad);


        subtotalTotal +=
            Number(producto.precio) *
            Number(item.cantidad);
    });



    document.getElementById(
        "resumenCantidad"
    ).innerText =
        cantidadTotal;



    document.getElementById(
        "resumenSubtotal"
    ).innerText =
        "$" +
        subtotalTotal.toLocaleString(
            "es-CO"
        );



    document.getElementById(
        "resumenTotal"
    ).innerText =
        "$" +
        subtotalTotal.toLocaleString(
            "es-CO"
        );
}



// ======================================================
// INICIO
// ======================================================

mostrarCarrito();
actualizarResumen();
