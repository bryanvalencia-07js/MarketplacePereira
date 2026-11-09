const { createMemoryRepository } = require("./memory.repository");
const { createInitialData } = require("../data/initial");
const {
  ROLES,
  CATEGORIAS,
  limpiarNombre,
  claveNombre,
} = require("../data/catalogos");
const { normalizarEscritura } = require("./relations");
function createRepositories(inicial = createInitialData()) {
  let cola = Promise.resolve();
  const roles =
    inicial.roles ??
    ROLES.map((nombre, i) => ({ id: i + 1, nombre, descripcion: null }));
  const categorias = structuredClone(
    inicial.categorias ??
      CATEGORIAS.map((nombre, i) => ({
        id: i + 1,
        nombre,
        descripcion: null,
        estado: "Activo",
      })),
  );
  // Compatibilidad de fixtures anteriores: las categorías históricas se importan una vez.
  for (const fila of [
    ...(inicial.negocios ?? []),
    ...(inicial.productos ?? []),
  ]) {
    if (
      fila.categoria &&
      !categorias.some(
        (c) => claveNombre(c.nombre) === claveNombre(fila.categoria),
      )
    ) {
      if (claveNombre(fila.categoria) === "todas")
        throw new TypeError("Todas es solo un filtro.");
      categorias.push({
        id: Math.max(0, ...categorias.map((c) => c.id)) + 1,
        nombre: limpiarNombre(fila.categoria),
        descripcion: null,
        estado: "Activo",
      });
    }
  }
  const repos = {
    rol: lectura(createMemoryRepository(roles)),
    categoria: lectura(createMemoryRepository(categorias)),
    // Exclusión por proceso; memory no ofrece rollback de callbacks arbitrarios.
    transaccion(accion) {
      const actual = cola.then(accion);
      cola = actual.catch(() => {});
      return actual;
    },
  };
  function lectura(repo) {
    return { list: repo.list, find: repo.find };
  }
  for (const [nombre, filas] of [
    ["usuario", inicial.usuarios],
    ["negocio", inicial.negocios],
    ["producto", inicial.productos],
  ]) {
    const normalizadas = (filas ?? []).map((f) => {
      const n = { ...f };
      if (nombre === "usuario")
        n.rolId ??= roles.find((r) => r.nombre === f.rol)?.id;
      else
        n.categoriaId ??= categorias.find(
          (c) => claveNombre(c.nombre) === claveNombre(f.categoria),
        )?.id;
      if (nombre === "producto") n.visitas = f.visitas ?? f.popularidad ?? 0;
      if (nombre === "negocio") {
        n.descripcion ??= null;
        n.municipio ??= null;
      }
      for (const k of [
        "rol",
        "categoria",
        "popularidad",
        "usuarioRol",
        "propietario",
      ])
        delete n[k];
      return n;
    });
    const raw = createMemoryRepository(normalizadas);
    async function proyectar(f) {
      if (!f) return null;
      if (nombre === "usuario") f.rol = (await repos.rol.find(f.rolId))?.nombre;
      else f.categoria = (await repos.categoria.find(f.categoriaId))?.nombre;
      if (nombre === "producto") f.popularidad = f.visitas; // alias de API transitorio
      if (nombre === "negocio") {
        const u = await repos.usuario.find(f.usuarioId);
        f.propietario = u ? `${u.nombre} ${u.apellido}` : undefined;
      }
      return f;
    }
    repos[nombre] = {
      list: async () => Promise.all((await raw.list()).map(proyectar)),
      find: async (id) => proyectar(await raw.find(id)),
      create: async (datos) => {
        const n = await normalizarEscritura(nombre, datos, null, repos);
        if (nombre === "negocio") {
          n.descripcion ??= null;
          n.municipio ??= null;
        }
        return proyectar(await raw.create(n));
      },
      update: async (id, datos) => {
        const previo = await raw.find(id);
        if (!previo) return null;
        return proyectar(
          await raw.update(
            id,
            await normalizarEscritura(nombre, datos, previo, repos),
          ),
        );
      },
      delete: raw.delete,
    };
  }
  return repos;
}
function repositoriesFromConfig({ dataSource = "memory", db } = {}) {
  if (dataSource === "memory") return createRepositories();
  if (dataSource !== "mysql") throw new Error("DATA_SOURCE inválido.");
  const { createPool } = require("../db/pool");
  const { createMysqlRepositories } = require("./mysql");
  return createMysqlRepositories(createPool(db));
}
module.exports = { createRepositories, repositoriesFromConfig };
