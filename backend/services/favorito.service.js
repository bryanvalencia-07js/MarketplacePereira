const V = require("../utils/validation");
const { exigir } = require("../utils/errors");
const { comprador } = require("./reserva.service");
function createFavoritoService(repos) {
  async function publico(p) {
    const n = p && (await repos.negocio.find(p.negocioId)),
      c = p && (await repos.categoria.find(p.categoriaId));
    return Boolean(
      p?.estado === "Activo" &&
      n?.estado === "Activo" &&
      c?.estado === "Activo",
    );
  }
  return {
    listar: async (a) => {
      comprador(a);
      return Promise.all(
        (await repos.favorito.list())
          .filter((f) => f.usuarioId === a.id)
          .map(async (f) => {
            const p = await repos.producto.find(f.productoId);
            return {
              ...f,
              producto: (await publico(p)) ? p : null,
              disponible: await publico(p),
            };
          }),
      );
    },
    crear: async (a, b) => {
      comprador(a);
      V.objeto(b, ["productoId"]);
      const productoId = V.entero(b.productoId, "Producto");
      return repos.transaccion(async () => {
        const p = await repos.producto.find(productoId);
        exigir(await publico(p), 404, "Producto no disponible.");
        exigir(
          !(await repos.favorito.list()).some(
            (f) => f.usuarioId === a.id && f.productoId === productoId,
          ),
          409,
          "Este producto ya está en tus favoritos.",
        );
        return repos.favorito.create({ usuarioId: a.id, productoId });
      });
    },
    eliminar: async (a, id) => {
      comprador(a);
      return repos.transaccion(async () => {
        const f = await repos.favorito.find(id);
        exigir(f, 404, "Favorito no encontrado.");
        exigir(f.usuarioId === a.id, 403, "Este favorito no te pertenece.");
        await repos.favorito.delete(id);
        return { id };
      });
    },
  };
}
module.exports = { createFavoritoService };
