// ======================================================
// RECUPERAR INFORMACIÓN
// ======================================================

let negocios =
    JSON.parse(
        localStorage.getItem("negocios")
    ) || [];


let productos =
    JSON.parse(
        localStorage.getItem("productos")
    ) || [];

let imagenProductoBase64 = "";

// ======================================================
// PREVISUALIZAR Y CONVERTIR IMAGEN
// ======================================================

function previsualizarImagen(event) {

    const archivo =
        event.target.files[0];


    if (!archivo) {
        return;
    }


    // Validar formato

    const formatosPermitidos = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];


    if (
        !formatosPermitidos.includes(
            archivo.type
        )
    ) {

        mostrarMensajeProducto(
            "La imagen debe ser JPG, PNG o WEBP.",
            "error"
        );


        event.target.value = "";

        return;
    }


    // 500 KB aproximadamente

    const tamañoMaximo =
        500 * 1024;


    if (
        archivo.size >
        tamañoMaximo
    ) {

        mostrarMensajeProducto(
            "La imagen no puede superar los 500 KB.",
            "error"
        );


        event.target.value = "";

        return;
    }


    const lector =
        new FileReader();


    lector.onload =
        function () {

            imagenProductoBase64 =
                lector.result;


            const preview =
                document.getElementById(
                    "previewProducto"
                );


            preview.src =
                imagenProductoBase64;


            document.getElementById(
                "contenedorPreview"
            ).hidden =
                false;
        };


    lector.readAsDataURL(
        archivo
    );
}

// ======================================================
// OBTENER MI COMERCIO
// ======================================================

function obtenerMiComercio() {

    return negocios.find(
        negocio =>
            negocio.usuarioId ===
            usuarioSesion.id
    );
}


const miComercio =
    obtenerMiComercio();



// ======================================================
// IMPEDIR PRODUCTOS SIN COMERCIO
// ======================================================

if (!miComercio) {

    alert(
        "Primero debes registrar tu comercio."
    );


    window.location.href =
        "mi-negocio.html";
}



// ======================================================
// GUARDAR PRODUCTOS
// ======================================================

function guardarProductosLocalStorage() {

    if (
        id === "" &&
        imagenProductoBase64 === ""
    ){
        mostrarMensajeProducto(
            "Debes seleccionar una imagen del producto.",
            "error"
        );

        return;
    }

    localStorage.setItem(
        "productos",
        JSON.stringify(productos)
    );
}



// ======================================================
// OBTENER SOLO MIS PRODUCTOS
// ======================================================

function obtenerMisProductos() {

    return productos.filter(
        producto =>
            producto.negocioId ===
            miComercio.id
    );
}



// ======================================================
// MOSTRAR PRODUCTOS
// ======================================================

function mostrarMisProductos(lista) {

    const contenedor =
        document.getElementById(
            "listaMisProductos"
        );


    const contador =
        document.getElementById(
            "contadorMisProductos"
        );


    const vacio =
        document.getElementById(
            "sinMisProductos"
        );


    contenedor.innerHTML =
        "";


    contador.innerText =
        `${lista.length} producto(s)`;


    if (lista.length === 0) {

        vacio.hidden =
            false;

        return;
    }


    vacio.hidden =
        true;


    lista.forEach(producto => {

        const tarjeta =
            document.createElement(
                "article"
            );


        tarjeta.className =
            "producto-market-card";


        tarjeta.innerHTML = `

            <div class="producto-market-imagen">

                ${
                    producto.imagen

                        ? `
                            <img
                                src="${producto.imagen}"
                                alt="${producto.nombre}"
                                class="producto-imagen-real"
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


            <div class="producto-market-contenido">

                <div class="producto-cabecera">

                    <span class="producto-categoria">

                        ${producto.categoria}

                    </span>


                    <span class="
                        badge
                        ${
                            producto.estado === "Activo"
                                ? "badge-activo"
                                : "badge-inactivo"
                        }
                    ">

                        ${producto.estado}

                    </span>

                </div>


                <h3>

                    ${producto.nombre}

                </h3>


                <p class="producto-descripcion">

                    ${producto.descripcion}

                </p>


                <strong class="producto-precio">

                    $${Number(
                        producto.precio
                    ).toLocaleString("es-CO")}

                </strong>


                <p class="producto-stock">

                    Disponibles:
                    ${producto.stock}

                </p>


                <div class="acciones-tabla">

                    <button
                        class="boton-accion editar"
                        onclick="editarProducto(${producto.id})"
                    >
                        Editar
                    </button>


                    <button
                        class="boton-accion estado"
                        onclick="cambiarEstadoProducto(${producto.id})"
                    >
                        Cambiar estado
                    </button>


                    <button
                        class="boton-accion eliminar"
                        onclick="eliminarProducto(${producto.id})"
                    >
                        Eliminar
                    </button>

                </div>

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

function guardarProducto(event) {

    event.preventDefault();


    const id =
        document
            .getElementById("productoId")
            .value;


    const nombre =
        document
            .getElementById("nombreProducto")
            .value
            .trim();


    const categoria =
        document
            .getElementById("categoriaProducto")
            .value;


    const precio =
        Number(
            document
                .getElementById("precioProducto")
                .value
        );


    const stock =
        Number(
            document
                .getElementById("stockProducto")
                .value
        );


    const descripcion =
        document
            .getElementById("descripcionProducto")
            .value
            .trim();



    // ==================================================
    // VALIDACIONES GENERALES
    // ==================================================

    if (
        nombre === "" ||
        categoria === "" ||
        descripcion === ""
    ) {

        mostrarMensajeProducto(
            "Todos los campos son obligatorios.",
            "error"
        );

        return;
    }


    if (precio <= 0) {

        mostrarMensajeProducto(
            "El precio debe ser mayor que cero.",
            "error"
        );

        return;
    }


    if (stock < 0) {

        mostrarMensajeProducto(
            "La cantidad disponible no puede ser negativa.",
            "error"
        );

        return;
    }



    // ==================================================
    // UPDATE
    // ==================================================

    if (id !== "") {

        const producto =
            productos.find(
                producto =>
                    Number(producto.id) === Number(id) &&
                    Number(producto.negocioId) === Number(miComercio.id)
            );


        if (!producto) {

            mostrarMensajeProducto(
                "Producto no encontrado.",
                "error"
            );

            return;
        }


        producto.nombre =
            nombre;

        producto.categoria =
            categoria;

        producto.precio =
            precio;

        producto.stock =
            stock;

        producto.descripcion =
            descripcion;


        // Solo cambiar imagen
        // si seleccionó una nueva.

        if (
            imagenProductoBase64 !== ""
        ) {

            producto.imagen =
                imagenProductoBase64;
        }


        guardarProductosLocalStorage();


        mostrarMensajeProducto(
            "Producto actualizado correctamente.",
            "exito"
        );


        limpiarFormularioProducto();


        filtrarMisProductos();


        return;
    }



    // ==================================================
    // CREATE
    // ==================================================

    // AQUÍ sí exigimos imagen.

    if (
        imagenProductoBase64 === ""
    ) {

        mostrarMensajeProducto(
            "Debes seleccionar una imagen del producto.",
            "error"
        );

        return;
    }


    const nuevoProducto = {

        id:
            productos.length > 0

                ? Math.max(
                    ...productos.map(
                        producto => producto.id
                    )
                ) + 1

                : 1,

        negocioId:
            miComercio.id,

        nombre:
            nombre,

        descripcion:
            descripcion,

        categoria:
            categoria,

        precio:
            precio,

        stock:
            stock,

        imagen:
            imagenProductoBase64,

        estado:
            "Activo",

        popularidad:
            0
    };


    productos.push(
        nuevoProducto
    );


    guardarProductosLocalStorage();


    mostrarMensajeProducto(
        "Producto registrado correctamente.",
        "exito"
    );


    limpiarFormularioProducto();


    filtrarMisProductos();
}



// ======================================================
// EDITAR
// ======================================================
function editarProducto(id) {

    console.log("ID recibido:", id);
    console.log("Mi comercio:", miComercio);
    console.log("Productos:", productos);


    const producto =
        productos.find(
            producto =>
                Number(producto.id) === Number(id) &&
                Number(producto.negocioId) === Number(miComercio.id)
        );


    console.log(
        "Producto encontrado:",
        producto
    );


    if (!producto) {

        mostrarMensajeProducto(
            "No se encontró el producto o no pertenece a tu comercio.",
            "error"
        );

        return;
    }


    // ==================================================
    // GUARDAR ID DEL PRODUCTO QUE ESTAMOS EDITANDO
    // ==================================================

    document.getElementById(
        "productoId"
    ).value =
        producto.id;



    // ==================================================
    // CARGAR INFORMACIÓN
    // ==================================================

    document.getElementById(
        "nombreProducto"
    ).value =
        producto.nombre;


    document.getElementById(
        "categoriaProducto"
    ).value =
        producto.categoria;


    document.getElementById(
        "precioProducto"
    ).value =
        producto.precio;


    document.getElementById(
        "stockProducto"
    ).value =
        producto.stock;


    document.getElementById(
        "descripcionProducto"
    ).value =
        producto.descripcion;



    // ==================================================
    // CARGAR IMAGEN
    // ==================================================

    imagenProductoBase64 =
        producto.imagen || "";


    const preview =
        document.getElementById(
            "previewProducto"
        );


    const contenedorPreview =
        document.getElementById(
            "contenedorPreview"
        );


    if (producto.imagen) {

        preview.src =
            producto.imagen;

        contenedorPreview.hidden =
            false;

    } else {

        preview.src =
            "";

        contenedorPreview.hidden =
            true;
    }



    // ==================================================
    // MODO EDICIÓN
    // ==================================================

    document.getElementById(
        "tituloFormularioProducto"
    ).innerText =
        "Editar producto";


    document.getElementById(
        "btnCancelarProducto"
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

function cancelarEdicionProducto() {

    limpiarFormularioProducto();

    document.getElementById(
        "mensajeProducto"
    ).innerText =
        "";
}



// ======================================================
// CAMBIAR ESTADO
// ======================================================

function cambiarEstadoProducto(id) {

    const producto =
        productos.find(
            producto =>
                producto.id === id &&
                producto.negocioId === miComercio.id
        );


    if (!producto) {

        return;
    }


    producto.estado =
        producto.estado === "Activo"
            ? "Inactivo"
            : "Activo";


    guardarProductosLocalStorage();


    filtrarMisProductos();
}



// ======================================================
// DELETE
// ======================================================

function eliminarProducto(id) {

    const producto =
        productos.find(
            producto =>
                producto.id === id &&
                producto.negocioId === miComercio.id
        );


    if (!producto) {

        return;
    }


    const confirmar =
        confirm(
            `¿Seguro que deseas eliminar ${producto.nombre}?`
        );


    if (!confirmar) {

        return;
    }


    productos =
        productos.filter(
            producto =>
                !(
                    producto.id === id &&
                    producto.negocioId === miComercio.id
                )
        );


    guardarProductosLocalStorage();


    filtrarMisProductos();
}



// ======================================================
// BÚSQUEDA Y FILTRO
// ======================================================

function filtrarMisProductos() {

    const texto =
        document
            .getElementById("buscarProducto")
            .value
            .trim()
            .toLowerCase();


    const categoria =
        document
            .getElementById("filtroCategoriaProducto")
            .value;


    const misProductos =
        obtenerMisProductos();


    const filtrados =
        misProductos.filter(producto => {

            const coincideTexto =

                producto.nombre
                    .toLowerCase()
                    .includes(texto)

                ||

                producto.descripcion
                    .toLowerCase()
                    .includes(texto);


            const coincideCategoria =

                categoria === ""

                ||

                producto.categoria === categoria;


            return (
                coincideTexto &&
                coincideCategoria
            );
        });


    mostrarMisProductos(
        filtrados
    );
}



// ======================================================
// LIMPIAR FORMULARIO
// ======================================================

function limpiarFormularioProducto() {

    imagenProductoBase64 =
        "";

    document.getElementById(
        "previewProducto"
    ).src =
        "";

    document.getElementById(
        "contenedorPreview"
    ).hidden =
        true;

    document
        .getElementById("formProducto")
        .reset();


    document.getElementById(
        "productoId"
    ).value =
        "";


    document.getElementById(
        "tituloFormularioProducto"
    ).innerText =
        "Registrar producto";


    document.getElementById(
        "btnCancelarProducto"
    ).hidden =
        true;
}



// ======================================================
// MENSAJE
// ======================================================

function mostrarMensajeProducto(
    texto,
    tipo
) {

    const mensaje =
        document.getElementById(
            "mensajeProducto"
        );


    mensaje.innerText =
        texto;


    mensaje.className =
        `mensaje-formulario ${tipo}`;
}



// ======================================================
// INFORMACIÓN DEL COMERCIO
// ======================================================

if (miComercio) {

    document.getElementById(
        "nombreComercioProductos"
    ).innerText =
        `Administra los productos de ${miComercio.nombre}.`;
}



// ======================================================
// INICIO
// ======================================================

if (miComercio) {

    mostrarMisProductos(
        obtenerMisProductos()
    );
}
