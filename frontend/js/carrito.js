/* El catálogo y el carrito se releen antes de cada operación. */
async function mostrarCarrito() {
  if (operacionCarrito || pedidoRegistrado || carritoConError) return;
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
    document.getElementById("contadorCarrito").textContent = cantidad;
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
let pedidoRegistrado = false;
let carritoConError = false;
async function modificarCarrito(operacion) {
  if (operacionCarrito) return;
  operacionCarrito = true;
  try {
    if (!(await validarSesionAccion("Comprador"))) return;
    const contexto = await RP.contextoCarrito(usuarioSesion.id);
    const nuevo = operacion(contexto);
    RP.guardarLista(RP.claveCarrito(), nuevo);
    RP.mensaje("Carrito actualizado.", "exito", "mensajeCarrito");
    carritoConError = false;
    operacionCarrito = false;
    await mostrarCarrito();
  } catch (error) {
    operacionCarrito = false;
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

document
  .getElementById("formPedido")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    if (operacionCarrito || pedidoRegistrado) return;
    operacionCarrito = true;
    await UI.tarea(
      document.getElementById("confirmarPedido"),
      async () => {
        try {
          const usuarioId = usuarioSesion.id;
          const clave = RP.claveCarrito();
          // Capturar intención al pulsar, sin reconciliar ni modificar cantidades.
          const procesados = RP.leerLista(clave).filter((i) =>
            RP.mismoId(i.usuarioId, usuarioId),
          );
          if (!(await validarSesionAccion("Comprador"))) return;
          if (
            !RP.mismoId(usuarioSesion.id, usuarioId) ||
            RP.claveCarrito() !== clave
          )
            throw new Error(
              "La sesión cambió. Recarga el carrito antes de confirmar.",
            );
          const items = procesados.map((i) => ({
            productoId: Number(i.productoId),
            cantidad: i.cantidad,
          }));
          const observaciones = document
            .getElementById("observacionesPedido")
            .value.trim();
          const pedidos = await API.post("/pedidos", {
            items,
            ...(observaciones ? { observaciones } : {}),
          });
          pedidoRegistrado = true;
          const region = document.getElementById("pedidosCreados");
          region.innerHTML = pedidos
            .map((p) => PedidosUI.tarjeta(p, false))
            .join("");
          region.hidden = false;
          document.getElementById("enlaceMisPedidos").hidden = false;
          document.getElementById("contenidoCarrito").hidden = true;
          document.getElementById("carritoVacio").hidden = true;
          let mensaje = `Pedido(s) creado(s): ${pedidos.map((p) => "#" + p.id).join(", ")}. Consulta Mis pedidos.`;
          try {
            const cantidades = new Map();
            for (const i of procesados)
              cantidades.set(
                Number(i.productoId),
                (cantidades.get(Number(i.productoId)) || 0) + i.cantidad,
              );
            const restantes = [];
            // Releer para preservar otros compradores y lo añadido durante el POST.
            for (const i of RP.leerLista(clave)) {
              if (!RP.mismoId(i.usuarioId, usuarioId)) {
                restantes.push(i);
                continue;
              }
              const id = Number(i.productoId),
                pendiente = cantidades.get(id) || 0;
              const quitar = Math.min(i.cantidad, pendiente);
              cantidades.set(id, pendiente - quitar);
              if (i.cantidad > quitar)
                restantes.push({ ...i, cantidad: i.cantidad - quitar });
            }
            RP.guardarLista(clave, restantes);
            const contador = document.getElementById("contadorCarrito");
            if (contador)
              contador.textContent = restantes
                .filter((i) => RP.mismoId(i.usuarioId, usuarioId))
                .reduce((n, i) => n + i.cantidad, 0);
          } catch {
            mensaje +=
              " No se pudo actualizar el carrito local. Revisa Mis pedidos antes de volver a confirmar.";
          }
          UI.estado(mensaje, "exito", "mensajeCarrito");
        } catch (error) {
          carritoConError = true;
          document.getElementById("enlaceMisPedidos").hidden = false;
          if (!error.status)
            error.message +=
              " Consulta Mis pedidos antes de volver a confirmar.";
          throw error;
        }
      },
      "mensajeCarrito",
    );
    operacionCarrito = false;
  });

window.addEventListener("storage", (event) => {
  if (event.key === RP.claveCarrito() || event.key === null) mostrarCarrito();
});
window.moduloListo = mostrarCarrito();

window.addEventListener("focus", () => mostrarCarrito());
