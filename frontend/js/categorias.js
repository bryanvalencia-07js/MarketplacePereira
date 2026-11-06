/* =========================================================
   REACTIVA PEREIRA · CATEGORÍAS COMPARTIDAS
========================================================= */

const CATEGORIAS_RP = Object.freeze([
  { nombre: "Alimentos", icono: "alimentos" },
  { nombre: "Bebidas", icono: "bebidas" },
  { nombre: "Restaurantes", icono: "restaurantes" },
  { nombre: "Café y panadería", icono: "cafe" },
  { nombre: "Ropa", icono: "ropa" },
  { nombre: "Calzado", icono: "calzado" },
  { nombre: "Accesorios", icono: "accesorios" },
  { nombre: "Tecnología", icono: "tecnologia" },
  { nombre: "Hogar", icono: "hogar" },
  { nombre: "Belleza", icono: "belleza" },
  { nombre: "Salud y bienestar", icono: "salud" },
  { nombre: "Deportes", icono: "deportes" },
  { nombre: "Mascotas", icono: "mascotas" },
  { nombre: "Papelería", icono: "papeleria" },
  { nombre: "Artesanías", icono: "artesanias" },
  { nombre: "Ferretería", icono: "ferreteria" },
  { nombre: "Automotriz", icono: "automotriz" },
  { nombre: "Educación", icono: "educacion" },
  { nombre: "Servicios", icono: "servicios" },
  { nombre: "Turismo", icono: "turismo" },
  { nombre: "Entretenimiento", icono: "entretenimiento" },
  { nombre: "Agro", icono: "agro" },
  { nombre: "Regalos", icono: "regalos" },
  { nombre: "Otro", icono: "otro" },
]);

/* =========================================================
   MARKETPLACE
========================================================= */

function renderizarCategoriasMarketplace() {

  const carrusel =
    document.getElementById("carruselCategorias");

  if (!carrusel) return;

  const categorias = [
    {
      nombre: "Todas",
      valor: "",
      icono: "todas",
    },
  
    ...CATEGORIAS_RP.map((categoria) => ({
      ...categoria,
      valor: categoria.nombre,
    })),
  ];


  const fragmento =
    document.createDocumentFragment();


  categorias.forEach((categoria, indice) => {

    const boton =
      document.createElement("button");

    boton.type = "button";

    boton.className =
      "categoria-3d";

    boton.dataset.click =
      "filtrarCategoria";

    boton.dataset.valor =
      categoria.valor;

    boton.setAttribute(
      "aria-pressed",
      indice === 0
        ? "true"
        : "false"
    );


    if (indice === 0) {

      boton.classList.add(
        "activa"
      );

    }


    const contenido =
      document.createElement("span");

    contenido.className =
      "categoria-3d-contenido";


      const icono =
      document.createElement("span");
    
    icono.className =
      "categoria-3d-icono";
    
    icono.setAttribute(
      "aria-hidden",
      "true"
    );
    
    
    /* SVG */
    
    const svg =
      document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );
    
    
    svg.setAttribute(
      "viewBox",
      "0 0 24 24"
    );
    
    
    svg.setAttribute(
      "focusable",
      "false"
    );
    
    
    /* USE */
    
    const use =
      document.createElementNS(
        "http://www.w3.org/2000/svg",
        "use"
      );
    
    
    use.setAttribute(
      "href",
      `assets/icons/categorias.svg#${categoria.icono}`
    );
    
    
    svg.appendChild(
      use
    );
    
    
    icono.appendChild(
      svg
    );

    const nombre =
      document.createElement("span");

    nombre.className =
      "categoria-3d-nombre";

    nombre.textContent =
      categoria.nombre;


    contenido.append(
      icono,
      nombre
    );


    boton.appendChild(
      contenido
    );


    fragmento.appendChild(
      boton
    );

  });


  carrusel.replaceChildren(
    fragmento
  );


  requestAnimationFrame(() => {

    actualizarPerspectivaCategorias();

    centrarCategoria(
      carrusel.querySelector(
        ".categoria-3d.activa"
      ),
      false
    );

  });

}


/* =========================================================
   EFECTO COVERFLOW 3D
========================================================= */

let frameCategorias = null;


function actualizarPerspectivaCategorias() {

  const carrusel =
    document.getElementById(
      "carruselCategorias"
    );

  if (!carrusel) return;


  const centroCarrusel =
    carrusel.scrollLeft +
    carrusel.clientWidth / 2;


  const tarjetas =
    carrusel.querySelectorAll(
      ".categoria-3d"
    );


  tarjetas.forEach((tarjeta) => {

    const centroTarjeta =
      tarjeta.offsetLeft +
      tarjeta.offsetWidth / 2;


    const distanciaPx =
      centroTarjeta -
      centroCarrusel;


    const distancia =
      distanciaPx /
      tarjeta.offsetWidth;


    const limitada =
      Math.max(
        -3,
        Math.min(3, distancia)
      );


    const absoluta =
      Math.abs(limitada);


    const rotacion =
      limitada * -18;


    const escala =
      Math.max(
        .76,
        1 - absoluta * .10
      );


    const profundidad =
      Math.max(
        -110,
        35 - absoluta * 55
      );


    // La profundidad usa perspectiva y escala; el texto conserva su contraste.
    tarjeta.style.transform =
      `
        perspective(1000px)
        rotateY(${rotacion}deg)
        translateZ(${profundidad}px)
        scale(${escala})
      `;

  });

}


/* =========================================================
   SCROLL OPTIMIZADO
========================================================= */

function programarPerspectivaCategorias() {

  if (frameCategorias) return;


  frameCategorias =
    requestAnimationFrame(() => {

      actualizarPerspectivaCategorias();

      frameCategorias = null;

    });

}


/* =========================================================
   CENTRAR UNA CATEGORÍA
========================================================= */

function centrarCategoria(
  tarjeta,
  animar = true
) {

  if (!tarjeta) return;


  const carrusel = tarjeta.closest(".categorias-3d-viewport");
  if (!carrusel) return;
  // Solo desplazar el eje horizontal: scrollIntoView también movía el hero.
  carrusel.scrollTo({
    left: tarjeta.offsetLeft + tarjeta.offsetWidth / 2 - carrusel.clientWidth / 2,
    behavior: animar && !matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "smooth"
      : "instant",
  });

}


/* =========================================================
   FLECHAS
========================================================= */

function moverCarruselCategorias(direccion) {

  const carrusel =
    document.getElementById(
      "carruselCategorias"
    );

  if (!carrusel) return;


  const tarjetas =
    [...carrusel.querySelectorAll(
      ".categoria-3d"
    )];


  if (!tarjetas.length) return;


  const centro =
    carrusel.scrollLeft +
    carrusel.clientWidth / 2;


  let indiceActual = 0;

  let distanciaMenor =
    Infinity;


  tarjetas.forEach((tarjeta, indice) => {

    const tarjetaCentro =
      tarjeta.offsetLeft +
      tarjeta.offsetWidth / 2;


    const distancia =
      Math.abs(
        tarjetaCentro - centro
      );


    if (distancia < distanciaMenor) {

      distanciaMenor =
        distancia;

      indiceActual =
        indice;

    }

  });


  const siguiente =
    Math.max(
      0,
      Math.min(
        tarjetas.length - 1,
        indiceActual + direccion
      )
    );


  centrarCategoria(
    tarjetas[siguiente]
  );

}


/* =========================================================
   SELECTS COMPARTIDOS
========================================================= */

function llenarSelectCategorias(
  id,
  textoInicial
) {

  const select =
    document.getElementById(id);

  if (!select) return;


  const valorAnterior =
    select.value;


  select.replaceChildren();


  const inicial =
    document.createElement("option");

  inicial.value = "";

  inicial.textContent =
    textoInicial;


  select.appendChild(
    inicial
  );


  CATEGORIAS_RP.forEach(
    ({ nombre }) => {

      const opcion =
        document.createElement(
          "option"
        );

      opcion.value =
        nombre;

      opcion.textContent =
        nombre;

      select.appendChild(
        opcion
      );

    }
  );


  if (
    valorAnterior &&
    CATEGORIAS_RP.some(
      ({ nombre }) =>
        nombre === valorAnterior
    )
  ) {

    select.value =
      valorAnterior;

  }

}


/* =========================================================
   INICIALIZACIÓN
========================================================= */

function iniciarCategoriasRP() {

  renderizarCategoriasMarketplace();


  llenarSelectCategorias(
    "categoria",
    "Seleccione"
  );


  llenarSelectCategorias(
    "categoriaProducto",
    "Seleccione"
  );


  llenarSelectCategorias(
    "filtroCategoriaProducto",
    "Todas las categorías"
  );


  const carrusel =
    document.getElementById(
      "carruselCategorias"
    );


  if (carrusel) {

    carrusel.addEventListener("keydown", (event) => {
      const tarjetas = [...carrusel.querySelectorAll(".categoria-3d")];
      const actual = tarjetas.indexOf(event.target.closest(".categoria-3d"));
      if (actual < 0) return;
      const indices = { ArrowRight: actual + 1, ArrowLeft: actual - 1, Home: 0, End: tarjetas.length - 1 };
      if (!(event.key in indices)) return;
      event.preventDefault();
      const siguiente = tarjetas[Math.max(0, Math.min(tarjetas.length - 1, indices[event.key]))];
      siguiente.focus({ preventScroll: true });
      centrarCategoria(siguiente);
    });

    carrusel.addEventListener(
      "scroll",
      programarPerspectivaCategorias,
      {
        passive: true,
      }
    );


    window.addEventListener(
      "resize",
      programarPerspectivaCategorias
    );

  }

}


if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    iniciarCategoriasRP
  );

} else {

  iniciarCategoriasRP();

}
