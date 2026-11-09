const V = require("../utils/validation");
const { exigir } = require("../utils/errors");
const esAdmin = (actor) => actor?.rol === "Administrador";
function gestionar(actor) {
  exigir(actor, 401, "Inicia sesión para continuar.");
  exigir(
    actor && ["Administrador", "Comerciante"].includes(actor.rol),
    403,
    "No tienes permisos para gestionar comercios.",
  );
}
function propietario(actor, negocio) {
  gestionar(actor);
  exigir(
    esAdmin(actor) || negocio.usuarioId === actor.id,
    403,
    "Este comercio no te pertenece.",
  );
}
function createNegocioService(repos) {
  async function proyectar(n) {
    const u = await repos.usuario.find(n.usuarioId);
    return {
      ...n,
      propietario: u ? `${u.nombre} ${u.apellido}` : n.propietario,
    };
  }
  async function obtener(actor, id) {
    const negocio = await repos.negocio.find(id);
    exigir(negocio, 404, "Comercio no encontrado.");
    exigir(
      negocio.estado === "Activo" ||
        esAdmin(actor) ||
        (actor?.rol === "Comerciante" && negocio.usuarioId === actor.id),
      404,
      "Comercio no disponible.",
    );
    return proyectar(negocio);
  }
  async function listar(actor, query = {}) {
    const gestion = query.gestion === "true";
    if (gestion) gestionar(actor);
    const usuarioId = query.usuarioId ? V.id(query.usuarioId) : null;
    if (query.estado) V.opcion(query.estado, V.ESTADOS, "Estado");
    return Promise.all(
      (await repos.negocio.list())
        .filter(
          (n) =>
            (!gestion
              ? n.estado === "Activo"
              : esAdmin(actor) || n.usuarioId === actor.id) &&
            (!usuarioId || n.usuarioId === usuarioId) &&
            (!query.estado || n.estado === query.estado) &&
            (!query.categoria || n.categoria === query.categoria) &&
            (!query.buscar ||
              `${n.nombre} ${n.categoria}`
                .toLowerCase()
                .includes(String(query.buscar).toLowerCase())),
        )
        .map(proyectar),
    );
  }
  async function guardar(actor, id, body) {
    gestionar(actor);
    V.objeto(body, [
      "usuarioId",
      "nombre",
      "categoria",
      "telefono",
      "direccion",
      "descripcion",
      "municipio",
      "estado",
    ]);
    return repos.transaccion(async () => {
      const previo = id ? await repos.negocio.find(id) : null;
      exigir(!id || previo, 404, "Comercio no encontrado.");
      if (previo) propietario(actor, previo);
      const usuarioId =
        body.usuarioId === undefined
          ? (previo?.usuarioId ?? actor.id)
          : V.entero(body.usuarioId, "Propietario");
      exigir(
        esAdmin(actor) || usuarioId === actor.id,
        403,
        "No puedes asignar un comercio a otro usuario.",
      );
      const usuario = await repos.usuario.find(usuarioId);
      exigir(
        usuario && usuario.rol === "Comerciante",
        400,
        "El propietario debe ser un comerciante existente.",
      );
      exigir(
        !(await repos.negocio.list()).some(
          (n) => n.usuarioId === usuarioId && n.id !== id,
        ),
        400,
        "Este comerciante ya tiene un comercio.",
      );
      const cambios = {
        usuarioId,
        propietario: `${usuario.nombre} ${usuario.apellido}`,
      };
      for (const [campo, max] of [
        ["nombre", 120],
        ["categoria", 60],
        ["telefono", 30],
        ["direccion", 200],
      ])
        if (!id || Object.hasOwn(body, campo))
          cambios[campo] = V.texto(body[campo], campo, max);
      for (const [campo, max] of [
        ["descripcion", 2000],
        ["municipio", 80],
      ])
        if (Object.hasOwn(body, campo))
          cambios[campo] =
            body[campo] === null || body[campo] === ""
              ? null
              : V.texto(body[campo], campo, max);
      if (!id || Object.hasOwn(body, "estado"))
        cambios.estado = V.opcion(body.estado ?? "Activo", V.ESTADOS, "Estado");
      return id
        ? repos.negocio.update(id, cambios)
        : repos.negocio.create(cambios);
    });
  }
  return {
    obtener,
    listar,
    crear: (actor, body) => guardar(actor, null, body),
    actualizar: (actor, id, body) => guardar(actor, id, body),
    eliminar: (actor, id) =>
      repos.transaccion(async () => {
        const negocio = await repos.negocio.find(id);
        exigir(negocio, 404, "Comercio no encontrado.");
        propietario(actor, negocio);
        exigir(
          !(await repos.producto.list()).some((p) => p.negocioId === id),
          400,
          "Elimina primero los productos del comercio.",
        );
        exigir(
          !(await repos.servicio.list()).some((s) => s.negocioId === id),
          409,
          "Resuelve primero los servicios del comercio.",
        );
        await repos.negocio.delete(id);
        return { id };
      }),
  };
}
module.exports = { createNegocioService, propietario, esAdmin, gestionar };
