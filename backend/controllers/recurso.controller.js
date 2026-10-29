const { id } = require("../utils/validation");
const responder = (res, data, status = 200) =>
  res.status(status).json({ ok: true, data });
function createRecursoController(servicio) {
  const controller = {
    listar: async (req, res) =>
      responder(res, await servicio.listar(req.usuario, req.query)),
    obtener: async (req, res) =>
      responder(res, await servicio.obtener(req.usuario, id(req.params.id))),
    crear: async (req, res) =>
      responder(res, await servicio.crear(req.usuario, req.body), 201),
    actualizar: async (req, res) =>
      responder(
        res,
        await servicio.actualizar(req.usuario, id(req.params.id), req.body),
      ),
    eliminar: async (req, res) =>
      responder(res, await servicio.eliminar(req.usuario, id(req.params.id))),
  };
  if (servicio.visita)
    controller.visita = async (req, res) =>
      responder(res, await servicio.visita(id(req.params.id)));
  return controller;
}
module.exports = { createRecursoController, responder };
