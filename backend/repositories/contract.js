/* Cada adaptador es async y devuelve copias/DTOs; no expone su almacén interno.
   list() -> Array, find(id) -> Object|null, create(dto) -> Object,
   update(id,dto) -> Object|null, delete(id) -> boolean.
   transaccion(callback) serializa reglas de unicidad; SQL deberá usar transacciones. */
function validarRepositories(repositories) {
  for (const nombre of ["usuario", "negocio", "producto"]) {
    for (const metodo of ["list", "find", "create", "update", "delete"]) {
      if (typeof repositories?.[nombre]?.[metodo] !== "function")
        throw new TypeError(`Repositorio ${nombre}: falta ${metodo}.`);
    }
  }
  if (typeof repositories.transaccion !== "function")
    throw new TypeError("Los repositorios requieren transaccion(callback).");
}
module.exports = { validarRepositories };
