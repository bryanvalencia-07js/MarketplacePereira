function createCategoriaService(repos) {
  return {
    listar: async () =>
      (await repos.categoria.list()).filter((c) => c.estado === "Activo"),
  };
}
module.exports = { createCategoriaService };
