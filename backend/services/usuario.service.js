const V = require("../utils/validation");
const { exigir } = require("../utils/errors");
const { hashPassword } = require("../utils/password");
function publico(usuario) {
  if (!usuario) return null;
  const { passwordHash, ...resto } = usuario;
  return resto;
}
function createUsuarioService(repos, revocar = () => {}) {
  async function obtener(id) {
    const u = await repos.usuario.find(id);
    exigir(u, 404, "Usuario no encontrado.");
    return publico(u);
  }
  async function guardar(actor, id, body, registro = false) {
    V.objeto(body, [
      "nombre",
      "apellido",
      "correo",
      "telefono",
      "password",
      "rol",
      ...(registro ? [] : ["estado"]),
    ]);
    return repos.transaccion(async () => {
      const previo = id ? await repos.usuario.find(id) : null;
      exigir(!id || previo, 404, "Usuario no encontrado.");
      const cambios = {};
      for (const campo of ["nombre", "apellido"])
        if (!id || Object.hasOwn(body, campo))
          cambios[campo] = V.texto(body[campo], campo, 80);
      if (!id || Object.hasOwn(body, "correo"))
        cambios.correo = V.correo(body.correo);
      if (Object.hasOwn(body, "telefono"))
        cambios.telefono = V.texto(body.telefono, "Teléfono", 30, false);
      if (!id || Object.hasOwn(body, "rol"))
        cambios.rol = V.opcion(
          body.rol,
          registro ? ["Comerciante", "Comprador"] : V.ROLES,
          "Rol",
        );
      if (!id || Object.hasOwn(body, "estado"))
        cambios.estado = registro
          ? "Activo"
          : V.opcion(body.estado ?? "Activo", V.ESTADOS, "Estado");
      const lista = await repos.usuario.list();
      exigir(
        !cambios.correo ||
          !lista.some((u) => u.id !== id && u.correo === cambios.correo),
        400,
        "El correo ya está registrado.",
      );
      if (previo) {
        const tieneNegocio = (await repos.negocio.list()).some(
          (n) => n.usuarioId === id,
        );
        exigir(
          !tieneNegocio || !cambios.rol || cambios.rol === "Comerciante",
          400,
          "Reasigna o elimina el comercio antes de cambiar el rol.",
        );
        if (
          previo.rol === "Administrador" &&
          previo.estado === "Activo" &&
          ((cambios.rol && cambios.rol !== "Administrador") ||
            cambios.estado === "Inactivo")
        ) {
          exigir(
            lista.some(
              (u) =>
                u.id !== id &&
                u.rol === "Administrador" &&
                u.estado === "Activo",
            ),
            400,
            "Debe permanecer al menos un administrador activo.",
          );
        }
      }
      if (!id || Object.hasOwn(body, "password"))
        cambios.passwordHash = await hashPassword(V.password(body.password));
      const resultado = id
        ? await repos.usuario.update(id, cambios)
        : await repos.usuario.create(cambios);
      if (
        id &&
        ["passwordHash", "rol", "estado"].some(
          (k) => Object.hasOwn(cambios, k) && cambios[k] !== previo[k],
        )
      )
        revocar(id);
      return publico(resultado);
    });
  }
  return {
    async listar() {
      return (await repos.usuario.list()).map(publico);
    },
    obtener,
    crear: (actor, body) => guardar(actor, null, body),
    registrar: (body) => guardar(null, null, body, true),
    actualizar: (actor, id, body) => guardar(actor, id, body),
    eliminar: (actor, id) =>
      repos.transaccion(async () => {
        await obtener(id);
        exigir(
          !(await repos.pedido.list()).some((p) => p.usuarioId === id),
          409,
          "El usuario tiene pedidos históricos. Desactívalo para conservar el historial.",
        );
        exigir(actor.id !== id, 400, "No puedes eliminar tu propia cuenta.");
        exigir(
          !(await repos.negocio.list()).some((n) => n.usuarioId === id),
          400,
          "El usuario tiene un comercio; resuélvelo antes de eliminarlo.",
        );
        const lista = await repos.usuario.list();
        const usuario = lista.find((u) => u.id === id);
        exigir(
          usuario.rol !== "Administrador" ||
            usuario.estado !== "Activo" ||
            lista.some(
              (u) =>
                u.id !== id &&
                u.rol === "Administrador" &&
                u.estado === "Activo",
            ),
          400,
          "Debe permanecer al menos un administrador activo.",
        );
        exigir(
          !(await repos.reserva.list()).some((r) => r.usuarioId === id),
          409,
          "El usuario tiene reservas. Conserva su historial.",
        );
        await repos.usuario.delete(id);
        revocar(id);
        return { id };
      }),
  };
}
module.exports = { createUsuarioService, publico };
