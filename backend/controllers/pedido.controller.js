const { id, objeto } = require("../utils/validation");
const { responder } = require("./recurso.controller");
function createPedidoController(pedidos) {
  return {
    mios: (req, res) =>
      pedidos.mios(req.usuario).then((data) => responder(res, data)),
    gestion: (req, res) =>
      pedidos
        .gestion(req.usuario, req.query)
        .then((data) => responder(res, data)),
    obtener: (req, res) =>
      pedidos
        .obtener(req.usuario, id(req.params.id))
        .then((data) => responder(res, data)),
    crear: (req, res) =>
      pedidos
        .crear(req.usuario, req.body)
        .then((data) => responder(res, data, 201)),
    cancelar: (req, res) => {
      objeto(req.body ?? {}, []);
      return pedidos
        .cancelar(req.usuario, id(req.params.id))
        .then((data) => responder(res, data));
    },
    estado: (req, res) =>
      pedidos
        .estado(req.usuario, id(req.params.id), req.body)
        .then((data) => responder(res, data)),
  };
}
module.exports = { createPedidoController };
