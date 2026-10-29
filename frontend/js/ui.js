/* Presentación compartida: texto seguro, estados y confirmaciones accesibles. */
const UI = (() => {
  const e = (valor) => RP.escapar(valor);
  function estado(texto, tipo = "exito", id = "estadoAplicacion") {
    RP.mensaje(texto, tipo, id);
  }
  async function tarea(boton, accion, mensajeId = "estadoAplicacion") {
    if (boton?.disabled) return;
    if (boton) {
      boton.disabled = true;
      boton.setAttribute("aria-busy", "true");
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
    return `<article class="producto-market-card"><a class="producto-market-imagen" href="detalle-producto.html?id=${Number(producto.id)}" aria-label="Ver ${e(producto.nombre)}">${imagen ? `<img loading="lazy" src="${imagen}" alt="${e(producto.nombre)}" class="producto-imagen-real">` : `<span>${e(String(producto.nombre).charAt(0))}</span>`}</a><div class="producto-market-contenido"><span class="producto-categoria">${e(producto.categoria)}</span><h3>${e(producto.nombre)}</h3><p class="producto-comercio">${e(negocio?.nombre)}</p><strong class="producto-precio">${RP.dinero(producto.precio)}</strong><p class="producto-stock">${RP.stock(producto) ? `${RP.stock(producto)} disponibles` : "Agotado"}</p><a class="boton boton-primario" href="detalle-producto.html?id=${Number(producto.id)}">Ver producto</a></div></article>`;
  }
  function tarjetaNegocio(negocio) {
    return `<article class="comercio-market-card"><span class="negocio-avatar">${e(String(negocio.nombre).charAt(0))}</span><div><span class="modulo-tipo">${e(negocio.categoria)}</span><h3>${e(negocio.nombre)}</h3><p>${e(negocio.direccion)}</p><a href="marketplace.html?negocioId=${Number(negocio.id)}" class="enlace-acento">Explorar comercio →</a></div></article>`;
  }
  return { e, estado, tarea, confirmar, kpis, tarjetaProducto, tarjetaNegocio };
})();
