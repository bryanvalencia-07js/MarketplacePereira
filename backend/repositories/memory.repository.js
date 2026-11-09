/* Contrato async: list/find/create/update/delete. Devuelve copias, nunca referencias. */
function createMemoryRepository(inicial = [], contexto) {
  let base = {
    filas: new Map(inicial.map((row) => [row.id, structuredClone(row)])),
    siguiente: Math.max(0, ...inicial.map((row) => row.id)) + 1,
  };
  const clave = Symbol();
  function estado() {
    const transaccion = contexto?.getStore();
    if (!transaccion) return base;
    if (!transaccion.activa) throw new Error("La transacción ya terminó.");
    if (!transaccion.cambios.has(clave)) {
      const copia = structuredClone(base);
      transaccion.cambios.set(clave, {
        estado: copia,
        commit: () => {
          base = copia;
        },
      });
    }
    return transaccion.cambios.get(clave).estado;
  }
  return {
    async list() {
      return structuredClone([...estado().filas.values()]);
    },
    async find(id) {
      return structuredClone(estado().filas.get(Number(id)) || null);
    },
    async create(datos) {
      const ahora = new Date().toISOString();
      const fila = {
        ...structuredClone(datos),
        id: estado().siguiente++,
        createdAt: ahora,
        updatedAt: ahora,
      };
      estado().filas.set(fila.id, fila);
      return structuredClone(fila);
    },
    async update(id, datos) {
      const previo = estado().filas.get(Number(id));
      if (!previo) return null;
      const fila = {
        ...previo,
        ...structuredClone(datos),
        id: previo.id,
        createdAt: previo.createdAt,
        updatedAt: new Date().toISOString(),
      };
      estado().filas.set(fila.id, fila);
      return structuredClone(fila);
    },
    async delete(id) {
      return estado().filas.delete(Number(id));
    },
  };
}
module.exports = { createMemoryRepository };
