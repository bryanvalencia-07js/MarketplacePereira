/* El catálogo y el carrito se releen antes de cada operación. */
async function mostrarCarrito() {
  try {
    const contexto = await RP.contextoCarrito(usuarioSesion.id);
    const { propios, productos, negocios } = contexto;
    const lista = document.getElementById("listaCarrito");
    lista.replaceChildren();
    document.getElementById("carritoVacio").hidden = propios.length !== 0;
    document.getElementById("contenidoCarrito").hidden = propios.length === 0;
    let totalCentavos = 0;
    let cantidad = 0;
    for (const item of propios) {
      const producto = productos.find((p) => RP.mismoId(p.id, item.productoId));
      const negocio = negocios.find((n) =>
        RP.mismoId(n.id, producto.negocioId),
      );
      const subtotalCentavos =
        Math.round(Number(producto.precio) * 100) * item.cantidad;
      totalCentavos += subtotalCentavos;
      if (!Number.isSafeInteger(totalCentavos))
        throw new Error(
          "El total supera el límite de cálculo seguro. Reduce las cantidades del carrito.",
        );
      const subtotal = subtotalCentavos / 100;
      cantidad += item.cantidad;
      const tarjeta = document.createElement("article");
      tarjeta.className = "carrito-producto";
      tarjeta.innerHTML = `
                <div class="carrito-producto-imagen">${
                  RP.imagenSegura(producto.imagen)
                    ? `<img src="${RP.imagenSegura(producto.imagen)}" alt="${RP.escapar(producto.nombre)}">`
                    : `<span>${RP.escapar(String(producto.nombre).charAt(0))}</span>`
                }</div>
                <div class="carrito-producto-info">
                    <span class="producto-categoria">${RP.escapar(producto.categoria)}</span>
                    <h3>${RP.escapar(producto.nombre)}</h3>
                    <p>${RP.escapar(negocio.nombre)}</p>
                    <strong class="carrito-precio">${RP.dinero(producto.precio)}</strong>
                    <button class="carrito-eliminar" data-accion="eliminar">Eliminar</button>
                </div>
                <div class="carrito-producto-cantidad">
                    <span>Cantidad</span><div class="cantidad-controles">
                        <button data-accion="menos" aria-label="Disminuir cantidad">−</button>
                        <strong>${item.cantidad}</strong>
                        <button data-accion="mas" aria-label="Aumentar cantidad" ${item.cantidad >= RP.stock(producto) ? "disabled" : ""}>+</button>
                    </div><small>Stock: ${RP.stock(producto)}</small>
                </div>
                <div class="carrito-producto-subtotal"><span>Subtotal</span><strong>${RP.dinero(subtotal)}</strong></div>`;
      tarjeta.querySelector('[data-accion="eliminar"]').onclick = () =>
        eliminarDelCarrito(producto.id);
      tarjeta.querySelector('[data-accion="menos"]').onclick = () =>
        cambiarCantidad(producto.id, -1);
      tarjeta.querySelector('[data-accion="mas"]').onclick = () =>
        cambiarCantidad(producto.id, 1);
      lista.appendChild(tarjeta);
    }
    document.getElementById("resumenCantidad").textContent = cantidad;
    document.getElementById("resumenSubtotal").textContent = RP.dinero(
      totalCentavos / 100,
    );
    document.getElementById("resumenTotal").textContent = RP.dinero(
      totalCentavos / 100,
    );
    if (contexto.ajustado)
      RP.mensaje(
        "Actualizamos tu carrito según la disponibilidad y el stock actuales.",
        "exito",
        "mensajeCarrito",
      );
  } catch (error) {
    document.getElementById("contenidoCarrito").hidden = true;
    document.getElementById("carritoVacio").hidden = true;
    RP.mensaje(error.message, "error", "mensajeCarrito");
  }
}

let operacionCarrito = false;
async function modificarCarrito(operacion) {
  if (operacionCarrito) return;
  operacionCarrito = true;
  try {
    if (!(await validarSesionAccion("Comprador"))) return;
    const contexto = await RP.contextoCarrito(usuarioSesion.id);
    const nuevo = operacion(contexto);
    RP.guardarLista(RP.claveCarrito(), nuevo);
    RP.mensaje("Carrito actualizado.", "exito", "mensajeCarrito");
    await mostrarCarrito();
  } catch (error) {
    await mostrarCarrito();
    RP.mensaje(error.message, "error", "mensajeCarrito");
  } finally {
    operacionCarrito = false;
  }
}

async function cambiarCantidad(productoId, cambio) {
  if (![1, -1].includes(cambio)) return;
  await modificarCarrito(({ carrito, productos }) => {
    const item = carrito.find(
      (i) =>
        RP.mismoId(i.usuarioId, usuarioSesion.id) &&
        RP.mismoId(i.productoId, productoId),
    );
    if (!item)
      throw new Error("El producto ya no está disponible en tu carrito.");
    const producto = productos.find((p) => RP.mismoId(p.id, productoId));
    const cantidad = item.cantidad + cambio;
    if (cantidad > RP.stock(producto))
      throw new Error(`Solo hay ${RP.stock(producto)} unidad(es) disponibles.`);
    if (cantidad <= 0) return carrito.filter((i) => i !== item);
    item.cantidad = cantidad;
    return carrito;
  });
}

async function eliminarDelCarrito(productoId) {
  await modificarCarrito(({ carrito }) =>
    carrito.filter(
      (i) =>
        !(
          RP.mismoId(i.usuarioId, usuarioSesion.id) &&
          RP.mismoId(i.productoId, productoId)
        ),
    ),
  );
}

async function vaciarCarrito() {
  if (!(await UI.confirmar("¿Seguro que deseas vaciar tu carrito?"))) return;
  await modificarCarrito(({ carrito }) =>
    carrito.filter((i) => !RP.mismoId(i.usuarioId, usuarioSesion.id)),
  );
}

window.addEventListener("storage", (event) => {
  if (event.key === RP.claveCarrito() || event.key === null) mostrarCarrito();
});
window.moduloListo = mostrarCarrito();

window.addEventListener("focus", () => mostrarCarrito());
