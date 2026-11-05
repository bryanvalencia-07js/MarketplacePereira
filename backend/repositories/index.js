const { createMemoryRepository } = require("./memory.repository");
const { createInitialData } = require("../data/initial");
function createRepositories(inicial = createInitialData()) {
  let cola = Promise.resolve();
  return {
    usuario: createMemoryRepository(inicial.usuarios),
    negocio: createMemoryRepository(inicial.negocios),
    producto: createMemoryRepository(inicial.productos),
    // Exclusión por proceso; memory no ofrece rollback de callbacks arbitrarios.
    transaccion(accion) {
      const actual = cola.then(accion);
      cola = actual.catch(() => {});
      return actual;
    },
  };
}
function repositoriesFromConfig({ dataSource = "memory", db } = {}) {
  if (dataSource === "memory") return createRepositories();
  if (dataSource !== "mysql") throw new Error("DATA_SOURCE inválido.");
  const { createPool } = require("../db/pool");
  const { createMysqlRepositories } = require("./mysql");
  return createMysqlRepositories(createPool(db));
}
module.exports = { createRepositories, repositoriesFromConfig };
