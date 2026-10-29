const productoId = Number(new URLSearchParams(location.search).get("id"));
let detalleActual = null;
async function obtenerDetalle() {
  if (!Number.isSafeInteger(productoId) || productoId < 1) return null;
  const producto = await API.get(`/productos/${productoId}`);
  const negocio = await API.get(`/negocios/${producto.negocioId}`);
  return RP.visible(producto, [negocio]) ? { producto, negocio } : null;
}
async function mostrarDetalle(contarVisita = false) {
  try {
    detalleActual = await obtenerDetalle();
    document.getElementById("detalleProducto").hidden = !detalleActual;
    document.getElementById("productoNoEncontrado").hidden =
      Boolean(detalleActual);
    if (detalleActual) {
      const { producto: p, negocio: n } = detalleActual;
      for (const [id, valor] of Object.entries({
        detalleCategoria: p.categoria,
        detalleNombre: p.nombre,
        detallePrecio: RP.dinero(p.precio),
        detalleDescripcion: p.descripcion,
        detalleStock: p.stock ? `${p.stock} unidad(es) disponibles` : "Agotado",
        detalleEstado: p.estado,
        detalleComercio: n.nombre,
        detalleDireccion: n.direccion,
        detalleTelefono: n.telefono,
      }))
        document.getElementById(id).textContent = valor;
      const imagen = document.getElementById("detalleImagen");
      const inicial = document.getElementById("detalleInicial");
      const fuente = RP.imagenSegura(p.imagen);
      imagen.hidden = !fuente;
      if (fuente) {
        imagen.src = fuente;
        imagen.alt = p.nombre;
      } else imagen.removeAttribute("src");
      inicial.hidden = Boolean(fuente);
      inicial.textContent = p.nombre.charAt(0);
      const agotado = p.stock === 0;
      const input = document.getElementById("cantidadProducto");
      input.value = agotado
        ? 0
        : Math.min(p.stock, Math.max(1, Number(input.value) || 1));
      document.getElementById("cantidadVisual").textContent = input.value;
      for (const b of document.querySelectorAll(".selector-cantidad button"))
        b.disabled = agotado;
      const boton = document.getElementById("btnAgregarCarrito");
      boton.disabled =
        agotado || Boolean(usuarioSesion && usuarioSesion.rol !== "Comprador");
      boton.textContent = agotado
        ? "Agotado"
        : usuarioSesion?.rol === "Comprador"
          ? "Agregar al carrito"
          : usuarioSesion
            ? "Disponible para cuentas Comprador"
            : "Iniciar sesión para comprar";
      if (contarVisita && !agotado) await API.post(`/productos/${p.id}/visita`);
    }
    if (usuarioSesion?.rol === "Comprador") await RP.contador(usuarioSesion.id);
  } catch (error) {
    if (error.status === 404) {
      detalleActual = null;
      document.getElementById("detalleProducto").hidden = true;
      document.getElementById("productoNoEncontrado").hidden = false;
    } else UI.estado(error.message, "error", "mensajeCarrito");
  }
}
async function agregarAlCarrito() {
  if (!usuarioSesion) {
    location.assign("login.html");
    return;
  }
  if (usuarioSesion.rol !== "Comprador") return;
  const boton = document.getElementById("btnAgregarCarrito");
  await UI.tarea(
    boton,
    async () => {
      const { carrito, productos, negocios } = await RP.contextoCarrito(
        usuarioSesion.id,
      );
      const p = productos.find((p) => RP.mismoId(p.id, productoId));
      if (!RP.visible(p, negocios))
        throw new Error("Este producto o su comercio ya no están disponibles.");
      const cantidad = Number(
        document.getElementById("cantidadProducto").value,
      );
      if (!Number.isSafeInteger(cantidad) || cantidad <= 0)
        throw new Error("Ingresa una cantidad entera mayor que cero.");
      const item = carrito.find(
        (i) =>
          RP.mismoId(i.usuarioId, usuarioSesion.id) &&
          RP.mismoId(i.productoId, p.id),
      );
      const nueva = (item?.cantidad || 0) + cantidad;
      if (nueva > p.stock)
        throw new Error(
          `Solo hay ${p.stock} unidad(es) disponibles, incluyendo las de tu carrito.`,
        );
      if (item) item.cantidad = nueva;
      else
        carrito.push({
          usuarioId: usuarioSesion.id,
          productoId: p.id,
          cantidad,
        });
      RP.guardarLista(RP.claveCarrito(), carrito);
      await RP.contador(usuarioSesion.id);
      UI.estado("Producto agregado al carrito.", "exito", "mensajeCarrito");
    },
    "mensajeCarrito",
  );
  await mostrarDetalle();
}
function cambiarCantidadDetalle(cambio) {
  if (!detalleActual || detalleActual.producto.stock === 0) return;
  const input = document.getElementById("cantidadProducto");
  const nueva = Number(input.value) + cambio;
  if (nueva < 1) return;
  if (nueva > detalleActual.producto.stock) {
    UI.estado(
      `Solo hay ${detalleActual.producto.stock} unidad(es) disponibles.`,
      "error",
      "mensajeCarrito",
    );
    return;
  }
  input.value = nueva;
  document.getElementById("cantidadVisual").textContent = nueva;
  UI.estado("", "exito", "mensajeCarrito");
}
window.addEventListener("focus", () => mostrarDetalle());
window.addEventListener("storage", (event) => {
  if (event.key === RP.claveCarrito()) mostrarDetalle();
});
window.moduloListo = mostrarDetalle(true);
