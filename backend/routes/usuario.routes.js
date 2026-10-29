const { Router } = require("express");
const { roles, csrf } = require("../middleware/security");
function usuarioRoutes(controller) {
  const router = Router();
  router.use(roles("Administrador"));
  router.get("/", controller.listar);
  router.get("/:id", controller.obtener);
  router.post("/", csrf, controller.crear);
  router.put("/:id", csrf, controller.actualizar);
  router.delete("/:id", csrf, controller.eliminar);
  return router;
}
module.exports = { usuarioRoutes };
