const { id } = require("../utils/validation");
const { responder } = require("./recurso.controller");
function createAgendaController({ horarios, reservas, favoritos }) {
  return {
    horarios: (req, res) =>
      horarios
        .listar(req.usuario, id(req.params.id))
        .then((data) => responder(res, data)),
    crearHorario: (req, res) =>
      horarios
        .crear(req.usuario, id(req.params.id), req.body)
        .then((data) => responder(res, data, 201)),
    actualizarHorario: (req, res) =>
      horarios
        .actualizar(req.usuario, id(req.params.id), req.body)
        .then((data) => responder(res, data)),
    eliminarHorario: (req, res) =>
      horarios
        .eliminar(req.usuario, id(req.params.id))
        .then((data) => responder(res, data)),
    disponibilidad: (req, res) =>
      reservas
        .disponibilidad(req.usuario, id(req.params.id), req.query.fecha)
        .then((data) => responder(res, data)),
    mias: (req, res) =>
      reservas.mias(req.usuario).then((data) => responder(res, data)),
    gestion: (req, res) =>
      reservas
        .gestion(req.usuario, req.query)
        .then((data) => responder(res, data)),
    reserva: (req, res) =>
      reservas
        .obtener(req.usuario, id(req.params.id))
        .then((data) => responder(res, data)),
    crearReserva: (req, res) =>
      reservas
        .crear(req.usuario, req.body)
        .then((data) => responder(res, data, 201)),
    cancelar: (req, res) =>
      reservas
        .cancelar(req.usuario, id(req.params.id))
        .then((data) => responder(res, data)),
    favoritos: (req, res) =>
      favoritos.listar(req.usuario).then((data) => responder(res, data)),
    crearFavorito: (req, res) =>
      favoritos
        .crear(req.usuario, req.body)
        .then((data) => responder(res, data, 201)),
    eliminarFavorito: (req, res) =>
      favoritos
        .eliminar(req.usuario, id(req.params.id))
        .then((data) => responder(res, data)),
  };
}
module.exports = { createAgendaController };
