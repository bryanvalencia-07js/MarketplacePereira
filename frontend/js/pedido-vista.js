/* Presentación compartida: dinero histórico calculado por API y texto escapado. */
const PedidosUI = (() => {
  const fecha = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "long",
    timeStyle: "short",
  });
  function tarjeta(p, acciones = true, gestion = false) {
    const e = RP.escapar;
    return `<article class="panel-admin pedido-card" data-pedido="${p.id}" id="pedido-${p.id}">
      <span class="modulo-tipo">Pedido #${p.id}</span><h2>${e(p.negocio?.nombre || "Comercio")}</h2>
      <p><time datetime="${e(p.createdAt)}">${e(fecha.format(new Date(p.createdAt)))}</time> · Pereira</p>
      <p class="badge ${["Confirmado", "Completado"].includes(p.estado) ? "badge-activo" : "badge-inactivo"}">${e(p.estado)}</p>
      ${gestion ? `<p>Comprador #${p.usuarioId}</p>` : ""}
      <ul class="pedido-detalles">${p.detalles.map((d) => `<li><h3>${e(d.nombre || `Producto #${d.productoId}`)}</h3><p>${d.cantidad} unidad(es) × ${RP.dinero(d.precioUnitario)}</p><p>Subtotal: <strong>${RP.dinero(d.subtotal)}</strong></p></li>`).join("")}</ul>
      <p class="pedido-total">Total: <strong>${RP.dinero(p.total)}</strong></p>
      ${p.observaciones ? `<p class="pedido-nota">Observaciones: ${e(p.observaciones)}</p>` : ""}
      ${acciones ? `<div class="acciones-formulario">${gestion && p.estado === "Pendiente" ? `<button type="button" class="boton boton-primario" data-estado-pedido="Confirmado" data-id="${p.id}">Confirmar pedido</button>` : ""}${gestion && p.estado === "Confirmado" ? `<button type="button" class="boton boton-primario" data-estado-pedido="Completado" data-id="${p.id}">Completar pedido</button>` : ""}${p.estado === "Pendiente" || (gestion && p.estado === "Confirmado") ? `<button type="button" class="boton boton-secundario" data-cancelar-pedido="${p.id}">Cancelar pedido</button>` : ""}</div>` : ""}
    </article>`;
  }
  return { tarjeta };
})();
