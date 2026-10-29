const { id } = require("../utils/validation");
const { responder } = require("./recurso.controller");
function createUsuarioController(servicio) {
  return {
    listar: async (req, res) => responder(res, await servicio.listar()),
    obtener: async (req, res) =>
      responder(res, await servicio.obtener(id(req.params.id))),
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
}
module.exports = { createUsuarioController };
