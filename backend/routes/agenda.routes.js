const { Router } = require("express");
const { roles, requerirSesion, csrf } = require("../middleware/security");
const { createAgendaController } = require("../controllers/agenda.controller");
function agendaRoutes(servicios) {
  const r = Router(),
    c = createAgendaController(servicios),
    gestion = roles("Administrador", "Comerciante"),
    comprador = roles("Comprador");
  r.get("/servicios/:id/horarios", c.horarios);
  r.post("/servicios/:id/horarios", gestion, csrf, c.crearHorario);
  r.put("/horarios-servicio/:id", gestion, csrf, c.actualizarHorario);
  r.delete("/horarios-servicio/:id", gestion, csrf, c.eliminarHorario);
  r.get("/servicios/:id/disponibilidad", c.disponibilidad);
  r.get("/reservas/mias", comprador, c.mias);
  r.get("/reservas/gestion", gestion, c.gestion);
  r.get("/reservas/:id", requerirSesion, c.reserva);
  r.post("/reservas", comprador, csrf, c.crearReserva);
  r.patch("/reservas/:id/cancelar", requerirSesion, csrf, c.cancelar);
  r.get("/favoritos", comprador, c.favoritos);
  r.post("/favoritos", comprador, csrf, c.crearFavorito);
  r.delete("/favoritos/:id", comprador, csrf, c.eliminarFavorito);
  return r;
}
module.exports = { agendaRoutes };
