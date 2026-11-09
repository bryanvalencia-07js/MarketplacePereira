const V = require("../utils/validation");
const { exigir } = require("../utils/errors");
const { minutos } = require("../utils/agenda");
const { createServicioService } = require("./servicio.service");
function createHorarioService(repos) {
  const servicios = createServicioService(repos);
  async function guardar(actor, id, servicioId, body) {
    V.objeto(body, ["diaSemana", "horaInicio", "horaFin"]);
    return repos.transaccion(async () => {
      const previo = id ? await repos.horario.find(id) : null;
      exigir(!id || previo, 404, "Horario no encontrado.");
      const s = await servicios.autorizar(
        actor,
        previo?.servicioId ?? servicioId,
      );
      const h = {
        servicioId: s.id,
        diaSemana:
          body.diaSemana === undefined && previo
            ? previo.diaSemana
            : V.entero(body.diaSemana, "Día ISO", 1, 7),
        horaInicio: body.horaInicio ?? previo?.horaInicio,
        horaFin: body.horaFin ?? previo?.horaFin,
      };
      const a = minutos(h.horaInicio),
        b = minutos(h.horaFin);
      exigir(
        a < b && b - a >= s.duracionMinutos,
        400,
        "El horario debe contener al menos una duración completa.",
      );
      exigir(
        !(await repos.horario.list()).some(
          (o) =>
            o.id !== id &&
            o.servicioId === s.id &&
            o.diaSemana === h.diaSemana &&
            minutos(o.horaInicio) < b &&
            minutos(o.horaFin) > a,
        ),
        409,
        "Este horario se superpone con otro del servicio.",
      );
      return id ? repos.horario.update(id, h) : repos.horario.create(h);
    });
  }
  return {
    listar: async (actor, id) => {
      await servicios.obtener(actor, id);
      return (await repos.horario.list()).filter((h) => h.servicioId === id);
    },
    crear: (a, id, b) => guardar(a, null, id, b),
    actualizar: (a, id, b) => guardar(a, id, null, b),
    eliminar: (a, id) =>
      repos.transaccion(async () => {
        const h = await repos.horario.find(id);
        exigir(h, 404, "Horario no encontrado.");
        await servicios.autorizar(a, h.servicioId);
        await repos.horario.delete(id);
        return { id };
      }),
  };
}
module.exports = { createHorarioService };
