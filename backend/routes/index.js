const { Router } = require("express");
const {
  roles,
  requerirSesion,
  csrf,
  limitar,
} = require("../middleware/security");
const {
  createRecursoController,
} = require("../controllers/recurso.controller");
const {
  createUsuarioController,
} = require("../controllers/usuario.controller");
const { createAuthController } = require("../controllers/auth.controller");
const { usuarioRoutes } = require("./usuario.routes");
const {
  createPublicoController,
} = require("../controllers/publico.controller");
function apiRoutes(servicios, opcionesCookie, instancia) {
  const router = Router();
  const auth = createAuthController(
    servicios.auth,
    servicios.usuarios,
    opcionesCookie,
    instancia,
  );
  const limiteAuth = limitar({ limite: 30, ventana: 15 * 60000 });
  const limiteCorreo = limitar({
    limite: 12,
    ventana: 15 * 60000,
    identificar: (req) =>
      typeof req.body?.correo === "string"
        ? req.body.correo.trim().toLowerCase().slice(0, 254)
        : req.ip,
  });
  router.post("/auth/registro", limiteAuth, auth.registro);
  router.post("/auth/login", limiteAuth, limiteCorreo, auth.login);
  router.get("/auth/me", requerirSesion, auth.me);
  router.get("/auth/sesion", auth.sesion);
  router.post("/auth/logout", requerirSesion, csrf, auth.logout);
  router.use(
    "/usuarios",
    usuarioRoutes(createUsuarioController(servicios.usuarios)),
  );
  for (const [ruta, servicio] of [
    ["negocios", servicios.negocios],
    ["productos", servicios.productos],
  ]) {
    const c = createRecursoController(servicio);
    router.get("/" + ruta, c.listar);
    router.get("/" + ruta + "/:id", c.obtener);
    if (ruta === "productos")
      router.post(
        "/productos/:id/visita",
        limitar({ limite: 40, ventana: 60000 }),
        c.visita,
      );
    router.post(
      "/" + ruta,
      roles("Administrador", "Comerciante"),
      csrf,
      c.crear,
    );
    router.put(
      "/" + ruta + "/:id",
      roles("Administrador", "Comerciante"),
      csrf,
      c.actualizar,
    );
    router.delete(
      "/" + ruta + "/:id",
      roles("Administrador", "Comerciante"),
      csrf,
      c.eliminar,
    );
  }
  router.get("/categorias", createRecursoController(servicios.categorias).listar);
  router.get(
    "/publico/resumen",
    createPublicoController(servicios.publico).resumen,
  );
  return router;
}
module.exports = { apiRoutes };
