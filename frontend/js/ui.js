/* Presentación compartida: texto seguro, estados y confirmaciones accesibles. */
const UI = (() => {
  const e = (valor) => RP.escapar(valor);
  function estado(texto, tipo = "exito", id = "estadoAplicacion") {
    RP.mensaje(texto, tipo, id);
    if (texto && tipo === "exito") notificar(texto);
  }
  const icono = (nombre) =>
    `<svg class="icono" width="20" height="20" aria-hidden="true" focusable="false"><use href="assets/icons/lucide.svg#${nombre}"></use></svg>`;
  function notificar(texto) {
    let region = document.getElementById("notificaciones");
    if (!region) {
      region = document.createElement("div");
      region.id = "notificaciones";
      region.setAttribute("aria-label", "Notificaciones");
      document.body.append(region);
    }
    const aviso = document.createElement("div");
    aviso.className = "toast";
    // El mensaje inline ya se anuncia; evitar dos anuncios idénticos.
    aviso.innerHTML = `${icono("circle-check")}<span></span><button type="button" aria-label="Descartar notificación">${icono("x")}</button>`;
    aviso.querySelector("span").textContent = texto;
    aviso
      .querySelector("button")
      .addEventListener("click", () => aviso.remove());
    region.replaceChildren(aviso);
  }
  function carga(nodo, activa = true) {
    if (!nodo) return;
    nodo.setAttribute("aria-busy", String(activa));
    if (activa && !nodo.children.length) {
      const indicadores = nodo.id.startsWith("kpis");
      const columnas =
        getComputedStyle(nodo).gridTemplateColumns.split(/\s+/).length;
      const cantidad = indicadores
        ? nodo.id === "kpisAdministrador"
          ? 4
          : 6
        : columnas;
      const cards = Array.from({ length: cantidad }, () =>
        indicadores
          ? '<div class="skeleton-card skeleton-kpi" aria-hidden="true"><span></span><span></span></div>'
          : '<div class="skeleton-card skeleton-producto" aria-hidden="true"><div class="skeleton-media"></div><div class="skeleton-contenido"><span></span><span></span><span></span></div></div>',
      ).join("");
      nodo.innerHTML =
        indicadores && !nodo.classList.contains("kpi-grid")
          ? `<div class="kpi-grid" data-skeleton>${cards}</div>`
          : cards;
    }
    if (!activa) {
      nodo.querySelectorAll(".skeleton-card").forEach((n) => n.remove());
      nodo.querySelectorAll("[data-skeleton]").forEach((n) => n.remove());
    }
  }
  async function tarea(boton, accion, mensajeId = "estadoAplicacion") {
    if (boton?.disabled) return;
    const contenido = boton ? [...boton.childNodes] : [];
    if (boton) {
      boton.disabled = true;
      boton.setAttribute("aria-busy", "true");
      boton.textContent = "Procesando…";
    }
    estado("Procesando…", "carga", mensajeId);
    try {
      return await accion();
    } catch (error) {
      estado(
        error.message || "No se pudo completar la operación.",
        "error",
        mensajeId,
      );
    } finally {
      if (boton) {
        boton.replaceChildren(...contenido);
        boton.disabled = false;
        boton.removeAttribute("aria-busy");
      }
    }
  }
  function confirmar(texto) {
    return new Promise((resolve) => {
      const dialogo = document.createElement("dialog");
      dialogo.className = "confirmacion";
      dialogo.setAttribute("aria-labelledby", "tituloConfirmacion");
      dialogo.innerHTML = `<form method="dialog"><h2 id="tituloConfirmacion">Confirmar acción</h2><p></p><div class="acciones-formulario"><button class="boton boton-secundario" value="cancelar" autofocus>Cancelar</button><button class="boton boton-primario" value="aceptar">Confirmar</button></div></form>`;
      dialogo.querySelector("p").textContent = texto;
      const previo = document.activeElement;
      dialogo.addEventListener(
        "close",
        () => {
          const ok = dialogo.returnValue === "aceptar";
          dialogo.remove();
          previo?.focus();
          resolve(ok);
        },
        { once: true },
      );
      document.body.append(dialogo);
      dialogo.showModal();
    });
  }
  function kpis(nodo, valores) {
    nodo.innerHTML = valores
      .map(
        ([titulo, valor]) =>
          `<article class="kpi"><span>${e(titulo)}</span><strong>${e(valor)}</strong></article>`,
      )
      .join("");
  }
  function tarjetaProducto(producto, negocios) {
    const negocio = negocios.find((n) => RP.mismoId(n.id, producto.negocioId));
    const imagen = RP.imagenSegura(producto.imagen);
    const disponible = RP.stock(producto) > 0;
    return `<article class="producto-market-card">
      <a class="producto-market-imagen" href="detalle-producto.html?id=${Number(producto.id)}" aria-label="Ver ${e(producto.nombre)}">
        ${imagen ? `<img loading="lazy" src="${imagen}" alt="${e(producto.nombre)}" class="producto-imagen-real">` : `<span class="producto-sin-foto"><strong>${e(String(producto.nombre).charAt(0))}</strong><small>Imagen por publicar</small></span>`}
        <span class="producto-sello">Comercio local</span>
      </a>
      <div class="producto-market-contenido">
        <span class="producto-categoria">${e(producto.categoria)}</span>
        <h3>${e(producto.nombre)}</h3>
        <p class="producto-comercio">${icono("store")}<span>${e(negocio?.nombre)}</span></p>
        <div class="producto-oferta"><strong class="producto-precio">${RP.dinero(producto.precio)}</strong><span class="producto-moneda">COP</span></div>
        <p class="producto-stock ${disponible ? "disponible" : "agotado"}">${disponible ? `${RP.stock(producto)} disponibles` : "Agotado"}</p>
        <a class="boton boton-secundario" href="detalle-producto.html?id=${Number(producto.id)}">Ver producto <span aria-hidden="true">↗</span></a>
      </div>
    </article>`;
  }
  function tarjetaNegocio(negocio) {
    return `<article class="comercio-market-card"><span class="negocio-avatar">${e(String(negocio.nombre).charAt(0))}</span><div><span class="modulo-tipo">${e(negocio.categoria)}</span><h3>${e(negocio.nombre)}</h3><p>${e(negocio.direccion)}</p><a href="marketplace.html?negocioId=${Number(negocio.id)}" class="enlace-acento">Explorar comercio →</a></div></article>`;
  }
  function preparar() {
    const main = document.querySelector("main");
    if (main && !main.id) main.id = "contenido";
    if (main && !document.querySelector(".saltar-contenido")) {
      const salto = document.createElement("a");
      salto.className = "saltar-contenido";
      salto.href = "#" + main.id;
      salto.textContent = "Saltar al contenido";
      document.body.prepend(salto);
    }
    main?.setAttribute("tabindex", "-1");
    document.querySelectorAll("svg.carrito-icono").forEach((n) => {
      n.insertAdjacentHTML("afterend", icono("shopping-bag"));
      n.remove();
    });
    for (const input of document.querySelectorAll('input[type="password"]')) {
      const grupo = document.createElement("div");
      grupo.className = "campo-password";
      input.before(grupo);
      grupo.append(input);
      const control = document.createElement("button");
      control.type = "button";
      control.className = "ver-password";
      control.setAttribute("aria-label", "Mostrar contraseña");
      control.setAttribute("aria-pressed", "false");
      control.setAttribute("aria-controls", input.id);
      control.innerHTML = icono("eye");
      control.addEventListener("click", () => {
        const visible = input.type === "password";
        input.type = visible ? "text" : "password";
        control.setAttribute("aria-pressed", String(visible));
        control.setAttribute(
          "aria-label",
          visible ? "Ocultar contraseña" : "Mostrar contraseña",
        );
      });
      grupo.append(control);
    }
    document.addEventListener(
      "invalid",
      (event) => validarCampo(event.target),
      true,
    );
    document.addEventListener("input", (event) => {
      if (event.target.hasAttribute("aria-invalid")) validarCampo(event.target);
    });
    const nav = document.querySelector(
      ".landing-nav nav, .market-menu, .gestion-nav",
    );
    if (nav) {
      nav.id = "navegacionPrincipal";
      nav.setAttribute("aria-label", "Navegación principal");
      const boton = document.createElement("button");
      boton.className = "boton menu-toggle";
      boton.type = "button";
      boton.setAttribute("aria-label", "Menú de navegación");
      boton.setAttribute("aria-controls", nav.id);
      boton.setAttribute("aria-expanded", "false");
      boton.innerHTML = icono("menu") + "Menú";
      const colocar = document.querySelector(
        ".landing-nav, .market-nav, .dashboard-nav",
      );
      colocar?.append(boton);
      function cerrar() {
        boton.setAttribute("aria-expanded", "false");
        nav.classList.remove("abierta");
      }
      boton.addEventListener("click", () => {
        const abrir = boton.getAttribute("aria-expanded") !== "true";
        boton.setAttribute("aria-expanded", String(abrir));
        nav.classList.toggle("abierta", abrir);
      });
      nav.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          cerrar();
          boton.focus();
        }
      });
      boton.addEventListener("keydown", (event) => {
        if (event.key === "Escape") cerrar();
      });
      nav.addEventListener("click", (event) => {
        if (event.target.closest("a")) cerrar();
      });
      // En móvil, cerrar sesión sigue disponible dentro de la navegación.
      const salir = document.querySelector(
        ".market-usuario [data-click=cerrarSesion], .dashboard-usuario [data-click=cerrarSesion]",
      );
      if (salir) {
        const copia = salir.cloneNode(true);
        copia.classList.add("salir-movil");
        nav.querySelector(".market-menu-interior, .contenedor")?.append(copia);
      }
      const movil = matchMedia("(max-width: 768px)");
      movil.addEventListener("change", cerrar);
    }
    decorar();
    const observer = new MutationObserver(decorar);
    observer.observe(document.body, { childList: true, subtree: true });
  }
  function validarCampo(campo) {
    if (!campo.validity || !campo.id) return;
    const id = campo.id + "-error";
    let ayuda = document.getElementById(id);
    if (!ayuda) {
      ayuda = document.createElement("small");
      ayuda.id = id;
      ayuda.className = "error-campo";
      (campo.closest(".campo-password") || campo).after(ayuda);
      campo.setAttribute(
        "aria-describedby",
        [campo.getAttribute("aria-describedby"), id].filter(Boolean).join(" "),
      );
    }
    campo.setAttribute("aria-invalid", String(!campo.validity.valid));
    ayuda.textContent = campo.validity.valid ? "" : campo.validationMessage;
  }
  function decorar() {
    for (const nodo of document.querySelectorAll(
      "button, a.boton, .gestion-nav a",
    )) {
      if (
        nodo.querySelector("svg") ||
        nodo.closest("#carruselCategorias") ||
        nodo.getAttribute("aria-busy") === "true"
      )
        continue;
      const texto = nodo.textContent.trim();
      const nombre =
        nodo.dataset.icono ||
        (/buscar/i.test(texto)
          ? "search"
          : /eliminar|quitar|vaciar/i.test(texto)
            ? "trash-2"
            : /editar/i.test(texto)
              ? "pencil"
              : /salir|cerrar sesión/i.test(texto)
                ? "log-out"
                : /volver/i.test(texto)
                  ? "arrow-left"
                  : /limpiar|filtro/i.test(texto)
                    ? "sliders-horizontal"
                    : /carrito/i.test(texto)
                      ? "shopping-bag"
                      : /sesión|cuenta|usuario/i.test(texto)
                        ? "user-round"
                        : /guardar|registrar|publicar/i.test(texto)
                          ? "check"
                          : /producto/i.test(texto)
                            ? "package"
                            : /comercio|negocio/i.test(texto)
                              ? "store"
                              : /panel/i.test(texto)
                                ? "layout-dashboard"
                                : "");
      if (nombre) nodo.insertAdjacentHTML("afterbegin", icono(nombre));
    }
  }
  return {
    e,
    estado,
    tarea,
    confirmar,
    kpis,
    tarjetaProducto,
    tarjetaNegocio,
    carga,
    preparar,
    icono,
  };
})();
