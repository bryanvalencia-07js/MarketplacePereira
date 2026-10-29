/* Contrato async: list/find/create/update/delete. Devuelve copias, nunca referencias. */
function createMemoryRepository(inicial = []) {
  const filas = new Map(inicial.map((row) => [row.id, structuredClone(row)]));
  let siguiente = Math.max(0, ...filas.keys()) + 1;
  return {
    async list() {
      return structuredClone([...filas.values()]);
    },
    async find(id) {
      return structuredClone(filas.get(Number(id)) || null);
    },
    async create(datos) {
      const ahora = new Date().toISOString();
      const fila = {
        ...structuredClone(datos),
        id: siguiente++,
        createdAt: ahora,
        updatedAt: ahora,
      };
      filas.set(fila.id, fila);
      return structuredClone(fila);
    },
    async update(id, datos) {
      const previo = filas.get(Number(id));
      if (!previo) return null;
      const fila = {
        ...previo,
        ...structuredClone(datos),
        id: previo.id,
        createdAt: previo.createdAt,
        updatedAt: new Date().toISOString(),
      };
      filas.set(fila.id, fila);
      return structuredClone(fila);
    },
    async delete(id) {
      return filas.delete(Number(id));
    },
  };
}
module.exports = { createMemoryRepository };
