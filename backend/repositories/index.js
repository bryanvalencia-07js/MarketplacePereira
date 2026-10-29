const { createMemoryRepository } = require("./memory.repository");
const { createInitialData } = require("../data/initial");
function createRepositories(inicial = createInitialData()) {
  let cola = Promise.resolve();
  return {
    usuario: createMemoryRepository(inicial.usuarios),
    negocio: createMemoryRepository(inicial.negocios),
    producto: createMemoryRepository(inicial.productos),
    // Una futura implementación SQL debe sustituir esta exclusión por transacciones.
    transaccion(accion) {
      const actual = cola.then(accion);
      cola = actual.catch(() => {});
      return actual;
    },
  };
}
module.exports = { createRepositories };
