const { createRepositories } = require("../backend/repositories");
const {
  createServicioService,
} = require("../backend/services/servicio.service");
const { createHorarioService } = require("../backend/services/horario.service");
const { createReservaService } = require("../backend/services/reserva.service");
const {
  createFavoritoService,
} = require("../backend/services/favorito.service");
const vendedor = { id: 1, rol: "Comerciante" },
  comprador = { id: 2, rol: "Comprador" },
  ajeno = { id: 3, rol: "Comerciante" },
  admin = { id: 4, rol: "Administrador" };
const fecha = "2099-01-05"; // lunes, independiente de TZ del host
const inicio = `${fecha}T14:00:00.000Z`; // 09:00 Pereira
function fixture(extra = {}) {
  const repos = createRepositories({
    usuarios: [vendedor, comprador, ajeno, admin, { id: 5, rol: "Comprador" }],
    categorias: [
      { id: 9, nombre: "Belleza", estado: "Activo" },
      { id: 10, nombre: "Archivo", estado: "Inactivo" },
    ],
    negocios: [
      { id: 1, usuarioId: 1, categoriaId: 9, estado: "Activo" },
      { id: 2, usuarioId: 3, categoriaId: 9, estado: "Activo" },
    ],
    productos: [
      {
        id: 1,
        negocioId: 1,
        categoriaId: 9,
        nombre: "Producto",
        estado: "Activo",
        stock: 2,
      },
    ],
    ...extra,
  });
  return {
    repos,
    s: createServicioService(repos),
    h: createHorarioService(repos),
    r: createReservaService(repos),
    f: createFavoritoService(repos),
  };
}
async function agenda(ctx, capacidadSimultanea = 1) {
  const s = await ctx.s.crear(vendedor, {
    negocioId: 1,
    categoria: "Belleza",
    nombre: "Corte",
    descripcion: "Servicio local",
    precioReferencia: 0,
    duracionMinutos: 60,
    capacidadSimultanea,
  });
  await ctx.h.crear(vendedor, s.id, {
    diaSemana: 1,
    horaInicio: "09:00",
    horaFin: "12:00",
  });
  return s;
}

module.exports = {
  fixture,
  agenda,
  vendedor,
  comprador,
  ajeno,
  admin,
  fecha,
  inicio,
};
