const { Router } = require("express");
const { roles, requerirSesion, csrf } = require("../middleware/security");
const { createPedidoController } = require("../controllers/pedido.controller");
function pedidoRoutes(pedidos) {
  const r = Router(),
    c = createPedidoController(pedidos),
    gestion = roles("Comerciante", "Administrador");
  r.get("/pedidos/mios", roles("Comprador"), c.mios);
  r.get("/pedidos/gestion", gestion, c.gestion);
  r.post("/pedidos", roles("Comprador"), csrf, c.crear);
  r.get("/pedidos/:id", requerirSesion, c.obtener);
  r.patch("/pedidos/:id/cancelar", requerirSesion, csrf, c.cancelar);
  r.patch("/pedidos/:id/estado", gestion, csrf, c.estado);
  return r;
}
module.exports = { pedidoRoutes };
