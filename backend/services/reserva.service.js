const V = require("../utils/validation");
const { exigir } = require("../utils/errors");
const A = require("../utils/agenda");
const { esAdmin, gestionar } = require("./negocio.service");
const { createServicioService } = require("./servicio.service");
function comprador(actor) {
  exigir(actor, 401, "Inicia sesión para continuar.");
  exigir(
    actor.rol === "Comprador",
    403,
    "Esta función requiere una cuenta Comprador.",
  );
}
function createReservaService(repos) {
  const servicios = createServicioService(repos);
  async function disponibilidad(actor, id, fecha) {
    const s = await servicios.obtener(actor, id);
    exigir(await servicios.visible(s), 404, "Servicio no disponible.");
    return {
      servicioId: id,
      fecha: A.fecha(fecha),
      zonaHoraria: A.ZONA,
      slots: A.slots(
        s,
        await repos.horario.list(),
        await repos.reserva.list(),
        fecha,
      ),
    };
  }
  async function autorizar(actor, id) {
    exigir(actor, 401, "Inicia sesión para continuar.");
    const r = await repos.reserva.find(id);
    exigir(r, 404, "Reserva no encontrada.");
    const s = await repos.servicio.find(r.servicioId),
      n = s && (await repos.negocio.find(s.negocioId));
    exigir(
      esAdmin(actor) ||
        (actor.rol === "Comprador" && r.usuarioId === actor.id) ||
        (actor.rol === "Comerciante" && n?.usuarioId === actor.id),
      403,
      "No tienes acceso a esta reserva.",
    );
    return r;
  }
  async function proyectar(r) {
    const s = await repos.servicio.find(r.servicioId);
    return {
      ...r,
      servicio: s,
      negocio: await repos.negocio.find(s.negocioId),
    };
  }
  return {
    disponibilidad,
    mias: async (a) => {
      comprador(a);
      return Promise.all(
        (await repos.reserva.list())
          .filter((r) => r.usuarioId === a.id)
          .map(proyectar),
      );
    },
    gestion: async (a, q = {}) => {
      gestionar(a);
      const negocioId = q.negocioId ? V.id(q.negocioId) : null,
        servicioId = q.servicioId ? V.id(q.servicioId) : null;
      const ids = new Set(
        (
          await servicios.listar(a, {
            gestion: "true",
            ...(negocioId ? { negocioId: String(negocioId) } : {}),
          })
        ).map((s) => s.id),
      );
      return Promise.all(
        (await repos.reserva.list())
          .filter(
            (r) =>
              ids.has(r.servicioId) &&
              (!servicioId || servicioId === r.servicioId),
          )
          .map(proyectar),
      );
    },
    obtener: async (a, id) => proyectar(await autorizar(a, id)),
    crear: async (a, body) => {
      comprador(a);
      V.objeto(body, ["servicioId", "fechaHoraInicio"]);
      const id = V.entero(body.servicioId, "Servicio"),
        ms = A.instante(body.fechaHoraInicio);
      return repos.transaccion(async () => {
        const s = await repos.servicio.find(id);
        exigir(await servicios.visible(s), 404, "Servicio no disponible.");
        exigir(ms > Date.now(), 400, "La reserva debe estar en el futuro.");
        const d = await disponibilidad(a, id, A.fechaLocal(ms)),
          slot = d.slots.find((x) => Date.parse(x.fechaHoraInicio) === ms);
        exigir(slot, 400, "Selecciona un slot válido del horario.");
        exigir(
          slot.cuposDisponibles > 0,
          409,
          "No quedan cupos para este horario.",
        );
        return repos.reserva.create({
          usuarioId: a.id,
          servicioId: id,
          fechaHoraInicio: new Date(ms).toISOString(),
          estado: "Confirmada",
        });
      });
    },
    cancelar: (a, id) =>
      repos.transaccion(async () => {
        const r = await autorizar(a, id);
        return r.estado === "Cancelada"
          ? r
          : repos.reserva.update(id, { estado: "Cancelada" });
      }),
  };
}
module.exports = { createReservaService, comprador };
