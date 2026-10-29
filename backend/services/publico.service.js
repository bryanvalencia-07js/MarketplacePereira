function createPublicoService({ negocios, productos, usuarios }) {
  return {
    async resumen() {
      const [comercios, catalogo, cuentas] = await Promise.all([
        negocios.listar(null),
        productos.listar(null),
        usuarios.listar(),
      ]);
      return {
        comercios: comercios.length,
        productos: catalogo.length,
        usuarios: cuentas.length,
        categorias: new Set(catalogo.map((p) => p.categoria)).size,
      };
    },
  };
}
module.exports = { createPublicoService };
