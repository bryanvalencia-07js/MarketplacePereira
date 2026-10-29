const { responder } = require("./recurso.controller");
function createPublicoController(servicio) {
  return {
    resumen: async (req, res) => responder(res, await servicio.resumen()),
  };
}
module.exports = { createPublicoController };
