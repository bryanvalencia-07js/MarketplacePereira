const { exigir } = require("../utils/errors");
const { claveNombre } = require("../data/catalogos");

async function resolverReferencia(repo, texto, id, etiqueta) {
  const fila =
    id !== undefined
      ? await repo.find(id)
      : (await repo.list()).find(
          (f) => claveNombre(f.nombre) === claveNombre(texto),
        );
  exigir(fila, 400, `${etiqueta} inexistente.`);
  if (texto !== undefined && id !== undefined)
    exigir(
      claveNombre(fila.nombre) === claveNombre(texto),
      400,
      `${etiqueta} no coincide.`,
    );
  return fila;
}

// Frontera común para ambos adaptadores. Solo almacena las FK y visitas.
async function normalizarEscritura(nombre, datos, previo, repos) {
  const cambios = { ...datos };
  if (
    nombre === "usuario" &&
    (Object.hasOwn(datos, "rol") || Object.hasOwn(datos, "rolId"))
  ) {
    const rol = await resolverReferencia(
      repos.rol,
      datos.rol,
      datos.rolId,
      "Rol",
    );
    if (previo && rol.nombre !== "Comerciante")
      exigir(
        !(await repos.negocio.list()).some((n) => n.usuarioId === previo.id),
        400,
        "Resuelve el comercio antes de cambiar el rol.",
      );
    cambios.rolId = rol.id;
  }
  if (
    ["negocio", "producto", "servicio"].includes(nombre) &&
    (Object.hasOwn(datos, "categoria") || Object.hasOwn(datos, "categoriaId"))
  ) {
    const categoria = await resolverReferencia(
      repos.categoria,
      datos.categoria,
      datos.categoriaId,
      "Categoría",
    );
    exigir(
      categoria.estado === "Activo",
      400,
      "Selecciona una categoría activa.",
    );
    cambios.categoriaId = categoria.id;
  }
  if (nombre === "negocio" && (!previo || Object.hasOwn(datos, "usuarioId"))) {
    const propietario = await repos.usuario.find(datos.usuarioId);
    exigir(
      propietario?.rol === "Comerciante",
      400,
      "El propietario debe ser un comerciante existente.",
    );
    exigir(
      !(await repos.negocio.list()).some(
        (n) => n.usuarioId === datos.usuarioId && n.id !== previo?.id,
      ),
      400,
      "Este comerciante ya tiene un comercio.",
    );
  }
  if (
    ["producto", "servicio"].includes(nombre) &&
    Object.hasOwn(datos, "negocioId")
  )
    exigir(
      await repos.negocio.find(datos.negocioId),
      400,
      "Selecciona un comercio existente.",
    );
  if (nombre === "producto") {
    if (
      Object.hasOwn(datos, "visitas") ||
      Object.hasOwn(datos, "popularidad")
    ) {
      cambios.visitas = datos.visitas ?? datos.popularidad;
      exigir(
        Number.isSafeInteger(cambios.visitas) &&
          cambios.visitas >= 0 &&
          cambios.visitas <= 4294967295,
        400,
        "Visitas inválidas.",
      );
    } else if (!previo) cambios.visitas = 0;
    if (Object.hasOwn(datos, "negocioId"))
      exigir(
        await repos.negocio.find(datos.negocioId),
        400,
        "Selecciona un comercio existente.",
      );
  }
  for (const campo of [
    "rol",
    "categoria",
    "popularidad",
    "usuarioRol",
    "propietario",
  ])
    delete cambios[campo];
  return cambios;
}
module.exports = { normalizarEscritura };
