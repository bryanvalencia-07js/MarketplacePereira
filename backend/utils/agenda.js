const { exigir } = require("./errors");
const ZONA = "America/Bogota";
const formato = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function fechaLocal(instante) {
  return formato.format(new Date(instante));
}
function fecha(valor) {
  exigir(
    typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor),
    400,
    "Usa una fecha YYYY-MM-DD válida.",
  );
  const d = new Date(`${valor}T12:00:00Z`);
  exigir(
    Number.isFinite(+d) &&
      Number(valor.slice(0, 4)) >= 2000 &&
      d.toISOString().slice(0, 10) === valor,
    400,
    "Fecha inválida.",
  );
  return valor;
}
function minutos(valor) {
  exigir(
    typeof valor === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(valor),
    400,
    "Usa una hora HH:mm válida.",
  );
  return Number(valor.slice(0, 2)) * 60 + Number(valor.slice(3));
}
function instante(valor) {
  exigir(
    typeof valor === "string" &&
      /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(
        valor,
      ),
    400,
    "Envía una fecha ISO 8601 con zona horaria.",
  );
  fecha(valor.slice(0, 10));
  const ms = Date.parse(valor);
  exigir(Number.isFinite(ms), 400, "Fecha/hora inválida.");
  return ms;
}
function utcLocal(dia, minuto) {
  // El offset se obtiene de IANA para la fecha elegida, nunca de TZ del host.
  const mediodia = new Date(`${dia}T12:00:00Z`);
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA,
    timeZoneName: "longOffset",
  }).formatToParts(mediodia);
  const offset =
    partes.find((p) => p.type === "timeZoneName").value.replace("GMT", "") ||
    "+00:00";
  const hh = String(Math.floor(minuto / 60)).padStart(2, "0"),
    mm = String(minuto % 60).padStart(2, "0");
  return new Date(`${dia}T${hh}:${mm}:00${offset}`).toISOString();
}
function inicios(servicio, horarios, dia) {
  fecha(dia);
  const isoDia = new Date(`${dia}T12:00:00Z`).getUTCDay() || 7;
  return horarios
    .filter((h) => h.servicioId === servicio.id && h.diaSemana === isoDia)
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
    .flatMap((h) => {
      const slots = [];
      for (
        let m = minutos(h.horaInicio);
        m + servicio.duracionMinutos <= minutos(h.horaFin);
        m += servicio.duracionMinutos
      )
        slots.push(utcLocal(dia, m));
      return slots;
    });
}
function pico(reservas, duracion, inicio = -Infinity, fin = Infinity) {
  const eventos = [];
  for (const r of reservas) {
    if (r.estado !== "Confirmada") continue;
    const a = Math.max(Date.parse(r.fechaHoraInicio), inicio),
      b = Math.min(Date.parse(r.fechaHoraInicio) + duracion * 60000, fin);
    if (a < b) eventos.push([a, 1], [b, -1]);
  }
  eventos.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let actual = 0,
    max = 0;
  for (const [, cambio] of eventos) {
    actual += cambio;
    max = Math.max(max, actual);
  }
  return max;
}
function slots(servicio, horarios, reservas, dia, ahora = Date.now()) {
  return inicios(servicio, horarios, dia).map((fechaHoraInicio) => {
    const inicio = Date.parse(fechaHoraInicio),
      cuposOcupados = pico(
        reservas.filter((r) => r.servicioId === servicio.id),
        servicio.duracionMinutos,
        inicio,
        inicio + servicio.duracionMinutos * 60000,
      );
    const cuposDisponibles = Math.max(
      0,
      servicio.capacidadSimultanea - cuposOcupados,
    );
    return {
      fechaHoraInicio,
      capacidadTotal: servicio.capacidadSimultanea,
      cuposOcupados,
      cuposDisponibles,
      disponible: inicio > ahora && cuposDisponibles > 0,
    };
  });
}
module.exports = {
  ZONA,
  fechaLocal,
  fecha,
  minutos,
  instante,
  inicios,
  pico,
  slots,
};
