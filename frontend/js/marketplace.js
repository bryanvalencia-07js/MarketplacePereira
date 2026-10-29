// ======================================================
// DATOS
// ======================================================

let negocios =
    JSON.parse(
        localStorage.getItem("negocios")
    ) || [];


let productos =
    JSON.parse(
        localStorage.getItem("productos")
    ) || [];

// ======================================================
// MOSTRAR PRODUCTOS
// ======================================================

function mostrarProductosMarketplace(
    lista
) {

    const contenedor =
        document.getElementById(
            "listaProductos"
        );

    const contador =
        document.getElementById(
            "contadorProductos"
        );


    const sinProductos =
        document.getElementById(
            "sinProductos"
        );


    contenedor.innerHTML =
        "";


    contador.innerText =
        `${lista.length} producto(s)`;


    if (lista.length === 0) {

        sinProductos.hidden =
            false;

        return;
    }


    sinProductos.hidden =
        true;


    lista.forEach(producto => {

        const negocio =
            negocios.find(
                negocio =>
                    negocio.id ===
                    producto.negocioId
            );


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

                <span class="producto-categoria">

                    ${producto.categoria}

                </span>


                <h3>

                    ${producto.nombre}

                </h3>


                <p class="producto-comercio">

                    ${
                        negocio
                            ? negocio.nombre
                            : "Comercio local"
                    }

                </p>


                <strong class="producto-precio">

                    $${Number(
                        producto.precio
                    ).toLocaleString("es-CO")}

                </strong>


                <a
                    href="detalle-producto.html?id=${producto.id}"
                    class="boton boton-primario"
                >
                    Ver producto
                </a>

            </div>

        `;


        contenedor.appendChild(
            tarjeta
        );
    });
}



// ======================================================
// PRODUCTOS POPULARES
// ======================================================

function mostrarPopulares() {

    const contenedor =
        document.getElementById(
            "productosPopulares"
        );


    const populares =
        [...productos]

            .filter(
                producto =>
                    producto.estado ===
                    "Activo"
            )

            .sort(
                (a, b) =>
                    b.popularidad -
                    a.popularidad
            )

            .slice(
                0,
                4
            );


    contenedor.innerHTML =
        "";


    populares.forEach(producto => {

        const negocio =
            negocios.find(
                negocio =>
                    negocio.id ===
                    producto.negocioId
            );


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

                <span class="producto-categoria">

                    Popular ·
                    ${producto.categoria}

                </span>


                <h3>
                    ${producto.nombre}
                </h3>


                <p class="producto-comercio">

                    ${
                        negocio
                            ? negocio.nombre
                            : "Comercio local"
                    }

                </p>


                <strong class="producto-precio">

                    $${Number(
                        producto.precio
                    ).toLocaleString("es-CO")}

                </strong>

                <a
                    href="detalle-producto.html?id=${producto.id}"
                    class="boton boton-primario"
                >
                    Ver producto
                </a>

            </div>

        `;


        contenedor.appendChild(
            tarjeta
        );
    });
}



// ======================================================
// MOSTRAR COMERCIOS
// ======================================================

function mostrarComercios() {

    const contenedor =
        document.getElementById(
            "listaComercios"
        );


    contenedor.innerHTML =
        "";


    const activos =
        negocios.filter(
            negocio =>
                negocio.estado ===
                "Activo"
        );


    activos.forEach(negocio => {

        const tarjeta =
            document.createElement(
                "article"
            );


        tarjeta.className =
            "comercio-market-card";


        tarjeta.innerHTML = `

            <div class="negocio-avatar">

                ${negocio.nombre
                    .charAt(0)
                    .toUpperCase()}

            </div>


            <div>

                <span class="modulo-tipo">

                    ${negocio.categoria}

                </span>


                <h3>

                    ${negocio.nombre}

                </h3>


                <p>

                    ${negocio.direccion}

                </p>


                <p>

                    ${negocio.telefono}

                </p>

            </div>

        `;


        contenedor.appendChild(
            tarjeta
        );
    });
}



// ======================================================
// BUSCAR
// ======================================================

function buscarMarketplace() {

    const texto =
        document
            .getElementById(
                "buscarMarketplace"
            )
            .value
            .trim()
            .toLowerCase();


    const filtrados =
        productos.filter(producto => {

            const negocio =
                negocios.find(
                    negocio =>
                        negocio.id ===
                        producto.negocioId
                );


            const nombreNegocio =
                negocio
                    ? negocio.nombre.toLowerCase()
                    : "";


            return (

                producto.nombre
                    .toLowerCase()
                    .includes(texto)

                ||

                producto.categoria
                    .toLowerCase()
                    .includes(texto)

                ||

                nombreNegocio
                    .includes(texto)
            );
        });


    mostrarProductosMarketplace(
        filtrados
    );
}



// ======================================================
// FILTRAR CATEGORÍA
// ======================================================

function filtrarCategoria(
    categoria
) {

    if (categoria === "") {

        mostrarProductosMarketplace(
            productos
        );

        return;
    }


    const filtrados =
        productos.filter(
            producto =>
                producto.categoria ===
                categoria
        );


    mostrarProductosMarketplace(
        filtrados
    );


    document
        .getElementById("productos")
        .scrollIntoView({
            behavior: "smooth"
        });
}



// ======================================================
// INICIO
// ======================================================

const productosActivos =
    productos.filter(
        producto =>
            producto.estado ===
            "Activo"
    );


mostrarProductosMarketplace(
    productosActivos
);


mostrarPopulares();


mostrarComercios();
