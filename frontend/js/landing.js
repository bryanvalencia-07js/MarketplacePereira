history.scrollRestoration = "manual";

window.addEventListener("load", () => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "auto"
  });
});

window.addEventListener("pageshow", () => {

  const navegacion =
    performance.getEntriesByType("navigation")[0];


  if (navegacion?.type !== "reload") {
    return;
  }


  history.replaceState(
    null,
    "",
    window.location.pathname +
    window.location.search
  );


  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "auto"
  });

});


function iniciarIntroPereira() {

  const intro = document.getElementById("introPereira");

  if (!intro) return;


  document.body.classList.add("intro-activa");


  setTimeout(() => {

    document.body.classList.remove("intro-activa");

    intro.remove();

  }, 5100);

}

function activarNarrativa() {
  if (
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !("IntersectionObserver" in window)
  )
    return;
  document.documentElement.classList.add("reveal-listo");
  const observer = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas)
        if (entrada.isIntersecting) {
          entrada.target.classList.add("visible");
          observer.unobserve(entrada.target);
        }
    },
    { threshold: 0.12 },
  );
  document
    .querySelectorAll(".reveal")
    .forEach((nodo) => observer.observe(nodo));
}

function activarEscenaImpacto() {

  const escena = document.querySelector(".story-impacto");
  const imagen = document.getElementById("imagenImpactoPereira");

  if (!escena || !imagen) return;


  let ejecutando = false;


  function actualizar() {

    const rect = escena.getBoundingClientRect();

    const recorrido =
      escena.offsetHeight - window.innerHeight;


    const progreso = Math.min(
      1,
      Math.max(
        0,
        -rect.top / recorrido
      )
    );


    const escala =
      1.02 + progreso * 0.12;


    const desplazamiento =
      progreso * 22;


    const saturacion =
      0.72 - progreso * 0.18;


    imagen.style.transform =
      `scale(${escala}) translateY(${desplazamiento}px)`;


    imagen.style.filter =
      `saturate(${saturacion}) contrast(1.04)`;


    ejecutando = false;

  }


  function solicitarActualizacion() {

    if (ejecutando) return;

    ejecutando = true;

    requestAnimationFrame(actualizar);

  }


  window.addEventListener(
    "scroll",
    solicitarActualizacion,
    { passive: true }
  );


  window.addEventListener(
    "resize",
    solicitarActualizacion
  );


  actualizar();

}

function cargarProductoStory(productos, negocios) {

  const producto =
    productos.find(
      (p) => RP.visible(p, negocios)
    );


  if (!producto) return;


  const negocio =
    negocios.find(
      (n) =>
        RP.mismoId(
          n.id,
          producto.negocioId
        )
    );


  const imagenContenedor =
    document.getElementById(
      "storyProductoImagen"
    );


  const imagen =
    RP.imagenSegura(
      producto.imagen
    );


  if (imagenContenedor) {

    if (imagen) {

      imagenContenedor.innerHTML =
        `<img
          src="${imagen}"
          alt="${UI.e(producto.nombre)}"
        >`;

    } else {

      imagenContenedor.textContent =
        String(
          producto.nombre || "R"
        )
        .charAt(0)
        .toUpperCase();

    }

  }


  const datos = {

    storyProductoCategoria:
      producto.categoria,

    storyProductoNombre:
      producto.nombre,

    storyProductoNegocio:
      negocio?.nombre ||
      "Comercio local",

    storyProductoPrecio:
      RP.dinero(producto.precio),

    storyProductoStock:
      RP.stock(producto) > 0
        ? `${RP.stock(producto)} disponibles`
        : "Agotado"

  };


  for (
    const [id, valor]
    of Object.entries(datos)
  ) {

    const nodo =
      document.getElementById(id);

    if (nodo) {
      nodo.textContent = valor;
    }

  }

}

async function cargarLanding() {
  try {
    const [negocios, productos, resumen] = await Promise.all([
      API.get("/negocios"),
      API.get("/productos"),
      API.get("/publico/resumen"),
    ]);
    document.getElementById("landingComercios").innerHTML =
      negocios.slice(0, 3).map(UI.tarjetaNegocio).join("") ||
      '<p class="estado-vacio">La comunidad está comenzando. Registra tu comercio y forma parte.</p>';
    document.getElementById("landingProductos").innerHTML =
      productos
        .slice(0, 4)
        .map((p) => UI.tarjetaProducto(p, negocios))
        .join("") ||
      '<p class="estado-vacio">Pronto descubrirás aquí los primeros productos publicados.</p>';
    cargarProductoStory(
      productos,
      negocios
    );
    UI.kpis(document.getElementById("landingImpacto"), [
      ["Comercios activos", negocios.length],
      ["Productos publicados", productos.length],
      ["Personas registradas", resumen.usuarios],
      ["Categorías", resumen.categorias],
    ]);
    animarIndicadores();
  } catch (error) {
    UI.estado(error.message, "error");
    for (const id of ["landingProductos", "landingComercios"])
      document.getElementById(id).innerHTML =
        '<p class="estado-vacio">No pudimos cargar esta sección. Recarga para intentar nuevamente.</p>';
  }
}
iniciarIntroPereira();
activarNarrativa();
activarEscenaImpacto();

window.moduloListo = cargarLanding();

function animarIndicadores() {
  if (
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !("IntersectionObserver" in window)
  )
    return;
  const observador = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const nodo = entry.target;
        const final = Number(nodo.textContent);
        const inicio = performance.now();
        function paso(t) {
          const avance = Math.min(1, (t - inicio) / 700);
          nodo.textContent = Math.round(final * avance);
          if (avance < 1) requestAnimationFrame(paso);
        }
        requestAnimationFrame(paso);
        observador.unobserve(nodo);
      }
    },
    { threshold: 0.4 },
  );
  document
    .querySelectorAll("#landingImpacto strong")
    .forEach((n) => observador.observe(n));
}

/* =========================================================
   UTILIDADES DEL STORYTELLING
========================================================= */

function limitar(valor, minimo = 0, maximo = 1) {

  return Math.min(
    maximo,
    Math.max(minimo, valor)
  );

}


function obtenerProgresoEscena(escena) {

  const rect =
    escena.getBoundingClientRect();

  const recorrido =
    escena.offsetHeight -
    window.innerHeight;


  if (recorrido <= 0) return 0;


  return limitar(
    -rect.top / recorrido
  );

}


/* =========================================================
   ESCENA 02 · PERSONAS
========================================================= */

function activarEscenaHumana() {

  const escena =
    document.getElementById("storyHumana");

  const imagen =
    document.getElementById("imagenStoryHumana");


  if (!escena || !imagen) return;


  const fragmentos =
    [
      ...escena.querySelectorAll(
        ".story-fragmento"
      )
    ];


  let pendiente = false;


  function actualizar() {

    const progreso =
      obtenerProgresoEscena(escena);


    const escala =
      1.08 -
      progreso * .05;


    const desplazamiento =
      (progreso - .5) * 28;


    imagen.style.transform =
      `
      scale(${escala})
      translateX(${desplazamiento}px)
      `;


    imagen.style.filter =
      `
      saturate(${.82 + progreso * .18})
      contrast(1.03)
      `;


    fragmentos.forEach(
      (fragmento) => {

        const inicio =
          Number(
            fragmento.dataset.inicio || 0
          );


        fragmento.classList.toggle(
          "visible",
          progreso >= inicio
        );

      }
    );


    pendiente = false;

  }


  function solicitar() {

    if (pendiente) return;

    pendiente = true;

    requestAnimationFrame(
      actualizar
    );

  }


  window.addEventListener(
    "scroll",
    solicitar,
    { passive: true }
  );


  window.addEventListener(
    "resize",
    solicitar
  );


  actualizar();

}

function activarEscenaVisibilidad() {

  const escena =
    document.getElementById("storyVisibilidad");

  const imagen =
    document.getElementById("imagenStoryVisibilidad");

  const problemas =
    [...escena?.querySelectorAll(".story-problema") || []];

  const indicador =
    document.getElementById("progresoVisibilidad");

  const cierre =
    document.getElementById("storyNaceReactiva");


  if (
    !escena ||
    !imagen ||
    !problemas.length
  ) return;


  let pendiente = false;


  function actualizar() {

    const progreso =
      obtenerProgresoEscena(escena);


    const paso =
      Math.min(
        problemas.length - 1,
        Math.floor(
          progreso * problemas.length
        )
      );


    problemas.forEach(
      (problema, indice) => {

        problema.classList.toggle(
          "activo",
          indice === paso
        );

      }
    );


    if (indicador) {

      indicador.style.transform =
        `scaleY(${progreso})`;

    }


    imagen.style.transform =
      `scale(${1.08 + progreso * .08})`;


    imagen.style.filter =
      `saturate(${.72 + progreso * .12})
       brightness(${.62 - progreso * .06})`;


    cierre?.classList.toggle(
      "visible",
      progreso > .82
    );


    pendiente = false;

  }


  function solicitar() {

    if (pendiente) return;

    pendiente = true;

    requestAnimationFrame(actualizar);

  }


  window.addEventListener(
    "scroll",
    solicitar,
    { passive: true }
  );


  window.addEventListener(
    "resize",
    solicitar
  );


  actualizar();

}



/* =========================================================
   ESCENA 04 · TRANSFORMACIÓN DIGITAL
========================================================= */

function activarEscenaDigital() {

  const escena =
    document.getElementById("storyDigital");


  if (!escena) return;


  const fisico =
    document.getElementById(
      "storyNegocioFisico"
    );


  const interfaz =
    document.getElementById(
      "storyMarketplaceUI"
    );


  const luz =
    document.getElementById(
      "storyTransformacionLuz"
    );


  const progresoNodo =
    document.getElementById(
      "progresoDigital"
    );


  const sello =
    document.getElementById(
      "storyDigitalSello"
    );


  const mensajes =
    [
      ...escena.querySelectorAll(
        ".story-digital-mensaje"
      )
    ];


  let pendiente = false;


  function actualizar() {

    const progreso =
      obtenerProgresoEscena(escena);


    /*
     * 0.00 → comercio físico
     * 0.25 → comienza transformación
     * 0.48 → destello máximo
     * 0.70 → marketplace domina
     * 1.00 → transformación completa
     */


    const entradaDigital =
      limitar(
        (progreso - .22) / .48
      );


    const salidaFisica =
      limitar(
        progreso / .62
      );


    /*
     * La luz empieza aproximadamente
     * en 0.25, alcanza su máximo cerca
     * de 0.48 y desaparece hacia 0.70.
     */
    const momentoLuz =
      limitar(
        1 -
        Math.abs(progreso - .48) / .23
      );


    /* =========================
       NEGOCIO FÍSICO
    ========================= */

    if (fisico) {

      fisico.style.opacity =
        String(
          1 - salidaFisica * .94
        );


      fisico.style.transform =
        `
        scale(${1 + progreso * .1})
        translateX(${-progreso * 35}px)
        `;


      fisico.style.filter =
        `
        saturate(${1 - progreso * .45})
        brightness(${1 - progreso * .22})
        `;

    }


    /* =========================
       INTERFAZ DIGITAL
    ========================= */

    if (interfaz) {

      const escala =
        .76 +
        entradaDigital * .24;


      const desplazamiento =
        70 *
        (1 - entradaDigital);


      const rotacion =
        -9 *
        (1 - entradaDigital);


      interfaz.style.opacity =
        String(entradaDigital);


      interfaz.style.transform =
        `
        translateY(${desplazamiento}px)
        scale(${escala})
        rotateY(${rotacion}deg)
        `;

    }


    /* =========================
       DESTELLO
    ========================= */

    if (luz) {

      luz.style.opacity =
        String(
          momentoLuz * .95
        );


      const escalaLuz =
        .3 +
        momentoLuz * 3.2;


      luz.style.transform =
        `
        translate(-50%, -50%)
        scale(${escalaLuz})
        `;

    }


    /* =========================
       BARRA DE PROGRESO
    ========================= */

    if (progresoNodo) {

      progresoNodo.style.transform =
        `scaleX(${progreso})`;

    }


    /* =========================
       CAMBIO DE MENSAJES
    ========================= */

    const paso =
      progreso < .32
        ? 0
        : progreso < .68
          ? 1
          : 2;


    mensajes.forEach(
      (mensaje, indice) => {

        mensaje.classList.toggle(
          "activo",
          indice === paso
        );

      }
    );


    /* =========================
       SELLO FINAL
    ========================= */

    sello?.classList.toggle(
      "visible",
      progreso > .78
    );


    pendiente = false;

  }


  function solicitar() {

    if (pendiente) return;


    pendiente = true;


    requestAnimationFrame(
      actualizar
    );

  }


  window.addEventListener(
    "scroll",
    solicitar,
    { passive: true }
  );


  window.addEventListener(
    "resize",
    solicitar
  );


  actualizar();

}

/* =========================================================
   CÓMO FUNCIONA
========================================================= */

function activarComoFunciona() {

  const seccion =
    document.getElementById(
      "como-funciona"
    );


  if (!seccion) return;


  const pasos =
    [
      ...seccion.querySelectorAll(
        ".como-paso"
      )
    ];


  const progreso =
    document.getElementById(
      "comoFuncionaProgreso"
    );


  if (!pasos.length) return;


  const observador =
    new IntersectionObserver(

      (entradas) => {

        entradas.forEach(
          (entrada) => {

            if (
              !entrada.isIntersecting
            ) return;


            const paso =
              entrada.target;


            paso.classList.add(
              "activo"
            );


            const indice =
              Number(
                paso.dataset.comoPaso
              );


            const porcentaje =
              (indice + 1) /
              pasos.length;


            if (progreso) {

              const esMovil =
                window.innerWidth <= 800;


              progreso.style.transform =
                esMovil
                  ? `scaleY(${porcentaje})`
                  : `scaleX(${porcentaje})`;

            }

          }
        );

      },

      {
        threshold: .45
      }

    );


  pasos.forEach(
    (paso) =>
      observador.observe(paso)
  );

}

/* =========================================================
   ACTIVAR STORYTELLING
========================================================= */

activarEscenaHumana();
activarEscenaVisibilidad();
activarEscenaDigital();
activarComoFunciona();