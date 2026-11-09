const V = require("../utils/validation");
const { exigir } = require("../utils/errors");
const { propietario, esAdmin, gestionar } = require("./negocio.service");
const { minutos, pico } = require("../utils/agenda");
function createServicioService(repos) {
  async function visible(s) {
    const n = s && (await repos.negocio.find(s.negocioId)),
      c = s && (await repos.categoria.find(s.categoriaId));
    return Boolean(
      s?.estado === "Activo" &&
      n?.estado === "Activo" &&
      c?.estado === "Activo",
    );
  }
  async function obtener(actor, id) {
    const s = await repos.servicio.find(id);
    exigir(s, 404, "Servicio no encontrado.");
    const n = await repos.negocio.find(s.negocioId);
    exigir(
      (await visible(s)) ||
        esAdmin(actor) ||
        (actor?.rol === "Comerciante" && n?.usuarioId === actor.id),
      404,
      "Servicio no disponible.",
    );
    return s;
  }
  async function autorizar(actor, id) {
    const s = await repos.servicio.find(id);
    exigir(s, 404, "Servicio no encontrado.");
    propietario(actor, await repos.negocio.find(s.negocioId));
    return s;
  }
  async function listar(actor, q = {}) {
    const gestion = q.gestion === "true";
    if (gestion) gestionar(actor);
    if (q.estado) {
      exigir(gestion, 403, "El filtro de estado requiere gestión autorizada.");
      V.opcion(q.estado, V.ESTADOS, "Estado");
    }
    const negocioId = q.negocioId ? V.id(q.negocioId) : null,
      result = [];
    for (const s of await repos.servicio.list()) {
      const n = await repos.negocio.find(s.negocioId);
      if (
        (gestion
          ? esAdmin(actor) || n?.usuarioId === actor.id
          : await visible(s)) &&
        (!negocioId || s.negocioId === negocioId) &&
        (!q.estado || q.estado === s.estado) &&
        (!q.categoria || q.categoria === s.categoria) &&
        (!q.buscar ||
          `${s.nombre} ${s.descripcion} ${s.categoria} ${n?.nombre}`
            .toLowerCase()
            .includes(String(q.buscar).toLowerCase()))
      )
        result.push(s);
    }
    return result;
  }
  async function guardar(actor, id, body) {
    gestionar(actor);
    V.objeto(body, [
      "negocioId",
      "categoria",
      "nombre",
      "descripcion",
      "precioReferencia",
      "estado",
      "duracionMinutos",
      "capacidadSimultanea",
    ]);
    return repos.transaccion(async () => {
      const previo = id ? await autorizar(actor, id) : null;
      const negocioId =
        body.negocioId === undefined
          ? previo?.negocioId
          : V.entero(body.negocioId, "Comercio");
      const n = await repos.negocio.find(negocioId);
      exigir(n, 400, "Selecciona un comercio existente.");
      propietario(actor, n);
      // Mantener la relación de las reservas recibidas con el negocio original.
      if (previo && previo.negocioId !== negocioId)
        exigir(
          !(await repos.reserva.list()).some((r) => r.servicioId === id),
          409,
          "No puedes trasladar un servicio con reservas.",
        );
      const cambios = { negocioId };
      for (const [campo, max] of [
        ["nombre", 120],
        ["descripcion", 2000],
        ["categoria", 60],
      ])
        if (!id || Object.hasOwn(body, campo))
          cambios[campo] = V.texto(body[campo], campo, max);
      if (!id || Object.hasOwn(body, "precioReferencia")) {
        const p = body.precioReferencia;
        exigir(
          typeof p === "number" &&
            Number.isFinite(p) &&
            p >= 0 &&
            p <= 1e9 &&
            Math.abs(p * 100 - Math.round(p * 100)) < 0.0001,
          400,
          "Precio de referencia inválido. Usa hasta dos decimales.",
        );
        cambios.precioReferencia = p;
      }
      if (!id || Object.hasOwn(body, "estado"))
        cambios.estado = V.opcion(body.estado ?? "Activo", V.ESTADOS, "Estado");
      if (!id || Object.hasOwn(body, "duracionMinutos"))
        cambios.duracionMinutos = V.entero(
          body.duracionMinutos,
          "Duración",
          1,
          1440,
        );
      if (!id || Object.hasOwn(body, "capacidadSimultanea"))
        cambios.capacidadSimultanea = V.entero(
          body.capacidadSimultanea,
          "Capacidad",
          1,
          100,
        );
      if (previo) {
        const reservas = (await repos.reserva.list()).filter(
          (r) =>
            r.servicioId === id &&
            r.estado === "Confirmada" &&
            Date.parse(r.fechaHoraInicio) + previo.duracionMinutos * 60000 >
              Date.now(),
        );
        if (
          cambios.duracionMinutos !== undefined &&
          cambios.duracionMinutos !== previo.duracionMinutos
        ) {
          exigir(
            reservas.length === 0,
            409,
            "La duración cambiaría el final de reservas confirmadas. Cancélalas antes de modificarla.",
          );
          for (const h of await repos.horario.list())
            if (h.servicioId === id)
              exigir(
                minutos(h.horaFin) - minutos(h.horaInicio) >=
                  cambios.duracionMinutos,
                409,
                "Un horario no contiene la nueva duración.",
              );
        }
        if (cambios.capacidadSimultanea !== undefined)
          exigir(
            pico(reservas, previo.duracionMinutos) <=
              cambios.capacidadSimultanea,
            409,
            "La capacidad es menor que las reservas confirmadas.",
          );
      }
      return id
        ? repos.servicio.update(id, cambios)
        : repos.servicio.create(cambios);
    });
  }
  return {
    visible,
    obtener,
    autorizar,
    listar,
    crear: (a, b) => guardar(a, null, b),
    actualizar: (a, id, b) => guardar(a, id, b),
    eliminar: (a, id) =>
      repos.transaccion(async () => {
        await autorizar(a, id);
        exigir(
          !(await repos.reserva.list()).some((r) => r.servicioId === id),
          409,
          "El servicio tiene reservas. Desactívalo para conservar el historial.",
        );
        await repos.servicio.delete(id);
        return { id };
      }),
  };
}
module.exports = { createServicioService };
