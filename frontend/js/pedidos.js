const gestionPedidos = location.pathname.endsWith("/pedidos.html");
async function cargarPedidos() {
  const estado = document.getElementById("estadoPedido")?.value || "";
  const pedidos = await API.get(
    gestionPedidos
      ? `/pedidos/gestion${estado ? "?estado=" + encodeURIComponent(estado) : ""}`
      : "/pedidos/mios",
  );
  document.getElementById("listaPedidos").innerHTML =
    pedidos.map((p) => PedidosUI.tarjeta(p, true, gestionPedidos)).join("") ||
    '<p class="estado-vacio">No hay pedidos para mostrar.</p>';
}
document
  .getElementById("filtroPedidos")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await UI.tarea(e.target.querySelector("button"), async () => {
      await cargarPedidos();
      UI.estado("Pedidos actualizados.");
    });
  });
document.getElementById("listaPedidos").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-cancelar-pedido], [data-estado-pedido]");
  if (!b) return;
  const cancelar = b.hasAttribute("data-cancelar-pedido");
  if (
    cancelar &&
    !(await UI.confirmar(
      "¿Cancelar este pedido? Sus unidades volverán al stock del comercio.",
    ))
  )
    return;
  await UI.tarea(b, async () => {
    await API.patch(
      `/pedidos/${cancelar ? b.dataset.cancelarPedido : b.dataset.id}/${cancelar ? "cancelar" : "estado"}`,
      cancelar ? {} : { estado: b.dataset.estadoPedido },
    );
    // La escritura ya fue confirmada: si falla el refresco, no sugerir reenviarla.
    UI.estado(
      cancelar ? "Pedido cancelado." : "Estado del pedido actualizado.",
    );
    try {
      await cargarPedidos();
    } catch {
      UI.estado(
        "El cambio quedó registrado. Recarga la página para consultar el estado actual.",
        "error",
      );
    }
  });
});
window.moduloListo = cargarPedidos();
