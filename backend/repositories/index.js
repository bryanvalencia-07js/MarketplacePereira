const { AsyncLocalStorage } = require("node:async_hooks");
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
  const contexto = new AsyncLocalStorage();
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
    ...(inicial.servicios ?? []),
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
    rol: lectura(createMemoryRepository(roles, contexto)),
    categoria: lectura(createMemoryRepository(categorias, contexto)),
    // Exclusión por proceso y copias privadas hasta commit: ningún lector ve escrituras parciales.
    transaccion(accion) {
      if (contexto.getStore())
        return Promise.reject(
          new Error("No se permiten transacciones anidadas."),
        );
      const actual = cola.then(async () => {
        const estado = { activa: true, cambios: new Map() };
        try {
          const resultado = await contexto.run(estado, accion);
          for (const cambio of estado.cambios.values()) cambio.commit();
          return resultado;
        } finally {
          estado.activa = false;
        }
      });
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
    ["servicio", inicial.servicios],
    ["horario", inicial.horarios],
    ["reserva", inicial.reservas],
    ["favorito", inicial.favoritos],
    ["pedido", inicial.pedidos],
    ["detallePedido", inicial.detallesPedido],
  ]) {
    const normalizadas = (filas ?? []).map((f) => {
      const n = { ...f };
      if (nombre === "usuario")
        n.rolId ??= roles.find((r) => r.nombre === f.rol)?.id;
      else if (["negocio", "producto", "servicio"].includes(nombre))
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
    const raw = createMemoryRepository(normalizadas, contexto);
    async function proyectar(f) {
      if (!f) return null;
      if (nombre === "usuario") f.rol = (await repos.rol.find(f.rolId))?.nombre;
      else if (["negocio", "producto", "servicio"].includes(nombre))
        f.categoria = (await repos.categoria.find(f.categoriaId))?.nombre;
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
      async delete(id) {
        id = Number(id);
        const { exigir } = require("../utils/errors");
        if (["usuario", "negocio", "producto", "pedido"].includes(nombre)) {
          const referencias =
            nombre === "producto"
              ? await repos.detallePedido.list()
              : nombre === "pedido"
                ? await repos.detallePedido.list()
                : await repos.pedido.list();
          const fk = {
            usuario: "usuarioId",
            negocio: "negocioId",
            producto: "productoId",
            pedido: "pedidoId",
          }[nombre];
          exigir(
            !referencias.some((r) => r[fk] === id),
            409,
            "El recurso tiene pedidos históricos. Desactívalo y conserva su historial.",
          );
        }
        if (nombre === "servicio") {
          exigir(
            !(await repos.reserva.list()).some((r) => r.servicioId === id),
            409,
            "El servicio tiene reservas. Desactívalo para conservar el historial.",
          );
          for (const h of await repos.horario.list())
            if (h.servicioId === id) await repos.horario.delete(h.id);
        }
        if (nombre === "usuario")
          exigir(
            !(await repos.reserva.list()).some((r) => r.usuarioId === id),
            409,
            "El usuario tiene reservas. Conserva su historial.",
          );
        if (nombre === "negocio")
          exigir(
            !(await repos.servicio.list()).some((s) => s.negocioId === id),
            409,
            "Resuelve primero los servicios del comercio.",
          );
        if (["usuario", "producto"].includes(nombre)) {
          for (const f of await repos.favorito.list())
            if ((nombre === "usuario" ? f.usuarioId : f.productoId) === id)
              await repos.favorito.delete(f.id);
        }
        return raw.delete(id);
      },
    };
    // Igual que MySQL: un escritor directo participa en la cola o en el contexto actual.
    for (const metodo of ["create", "update", "delete"]) {
      const accion = repos[nombre][metodo];
      repos[nombre][metodo] = (...args) =>
        contexto.getStore()
          ? accion(...args)
          : repos.transaccion(() => accion(...args));
    }
  }
  repos.bloquearProductos = async () => {
    if (!contexto.getStore())
      throw new Error("El bloqueo requiere una transacción.");
  };
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
