/* Cada adaptador es async y devuelve copias/DTOs; no expone su almacén interno.
   list() -> Array, find(id) -> Object|null, create(dto) -> Object,
   update(id,dto) -> Object|null, delete(id) -> boolean.
   transaccion(callback) serializa escrituras; MySQL confirma o revierte el callback.
   memory solo serializa por proceso, sin rollback de callbacks arbitrarios. */
function validarRepositories(repositories) {
  for (const nombre of [
    "usuario",
    "negocio",
    "producto",
    "servicio",
    "horario",
    "reserva",
    "favorito",
  ]) {
    for (const metodo of ["list", "find", "create", "update", "delete"]) {
      if (typeof repositories?.[nombre]?.[metodo] !== "function")
        throw new TypeError(`Repositorio ${nombre}: falta ${metodo}.`);
    }
  }
  for (const nombre of ["rol", "categoria"])
    for (const metodo of ["list", "find"])
      if (typeof repositories?.[nombre]?.[metodo] !== "function")
        throw new TypeError(`Repositorio ${nombre}: falta ${metodo}.`);
  if (typeof repositories.transaccion !== "function")
    throw new TypeError("Los repositorios requieren transaccion(callback).");
}
module.exports = { validarRepositories };
