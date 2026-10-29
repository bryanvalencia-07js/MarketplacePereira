/* Presentación y carrito temporal. Los permisos se comprueban en Express. */
const RP = (() => {
  const invalidas = new Set();
  const mismoId = (a, b) => {
    if (
      ![a, b].every(
        (valor) => typeof valor === "number" || typeof valor === "string",
      )
    )
      return false;
    return (
      Number.isSafeInteger(Number(a)) &&
      Number(a) > 0 &&
      Number(a) === Number(b)
    );
  };
  const dinero = (valor) =>
    Number(valor).toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: Number.isInteger(Number(valor)) ? 0 : 2,
      maximumFractionDigits: 2,
    });
  const escapar = (valor) =>
    String(valor ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const imagenSegura = (valor) =>
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(String(valor))
      ? valor
      : "";

  function mensaje(texto, tipo = "error", id = "estadoAplicacion") {
    let nodo = document.getElementById(id);
    if (!nodo) {
      nodo = document.createElement("p");
      nodo.id = id;
      (
        document.querySelector("main .contenedor") ||
        document.querySelector("main") ||
        document.body
      ).prepend(nodo);
    }
    nodo.setAttribute("role", tipo === "error" ? "alert" : "status");
    nodo.setAttribute("aria-live", "polite");
    nodo.className = `mensaje-formulario ${tipo}`;
    nodo.textContent = texto;
  }

  function leerLista(clave) {
    try {
      const valor = JSON.parse(localStorage.getItem(clave) ?? "[]");
      if (
        !Array.isArray(valor) ||
        valor.some(
          (item) => !item || typeof item !== "object" || Array.isArray(item),
        )
      )
        throw new Error();
      invalidas.delete(clave);
      return valor;
    } catch {
      invalidas.add(clave);
      mensaje(
        `No se pudieron leer los datos de ${clave}. No se sobrescribirán. Recupera una copia válida antes de continuar.`,
      );
      return [];
    }
  }

  function guardarLista(clave, lista) {
    // Releer evita sobrescribir datos corruptos detectados después de cargar la página.
    leerLista(clave);
    if (invalidas.has(clave))
      throw new Error(
        "Los datos locales no son válidos. No se guardaron cambios.",
      );
    try {
      localStorage.setItem(clave, JSON.stringify(lista));
    } catch {
      throw new Error(
        "No se pudieron guardar los cambios. Revisa el espacio y los permisos de almacenamiento.",
      );
    }
  }

  const visible = (producto, negocios) =>
    Boolean(
      producto &&
        producto.estado === "Activo" &&
        negocios.some(
          (n) => mismoId(n.id, producto.negocioId) && n.estado === "Activo",
        ),
    );
  const stock = (producto) =>
    Number.isSafeInteger(Number(producto?.stock)) && Number(producto.stock) >= 0
      ? Number(producto.stock)
      : 0;
  const precioValido = (producto) =>
    Number.isFinite(Number(producto?.precio)) && Number(producto.precio) > 0;

  function normalizarCarrito(carrito, usuarioId, productos, negocios) {
    const ajenos = carrito.filter(
      (item) => !mismoId(item.usuarioId, usuarioId),
    );
    const propios = new Map();
    for (const item of carrito.filter((item) =>
      mismoId(item.usuarioId, usuarioId),
    )) {
      const producto = productos.find((p) => mismoId(p.id, item.productoId));
      if (
        typeof item.cantidad !== "number" &&
        typeof item.cantidad !== "string"
      )
        continue;
      const cantidad = Number(item.cantidad);
      if (
        !visible(producto, negocios) ||
        !precioValido(producto) ||
        stock(producto) === 0 ||
        !Number.isSafeInteger(cantidad) ||
        cantidad <= 0
      )
        continue;
      const anterior = propios.get(Number(producto.id));
      propios.set(Number(producto.id), {
        usuarioId: Number(usuarioId),
        productoId: Number(producto.id),
        cantidad: Math.min(
          stock(producto),
          (anterior?.cantidad || 0) + cantidad,
        ),
      });
    }
    return [...ajenos, ...propios.values()];
  }

  function claveCarrito() {
    if (!API.instancia)
      throw new Error(
        "No se pudo identificar la instancia del servidor. Recarga la página.",
      );
    return `rp_carrito_${API.instancia}`;
  }

  async function contextoCarrito(usuarioId) {
    const sesion = await API.get("/auth/sesion");
    if (
      !sesion.usuario ||
      !mismoId(sesion.usuario.id, usuarioId) ||
      sesion.usuario.rol !== "Comprador"
    ) {
      window.dispatchEvent(new Event("sesion-caducada"));
      throw new Error(
        "Inicia sesión con tu cuenta de comprador para continuar.",
      );
    }
    // Primero consultar servidor: un fallo de red no debe vaciar el carrito.
    const [productos, negocios] = await Promise.all([
      API.get("/productos"),
      API.get("/negocios"),
    ]);
    const clave = claveCarrito();
    const anterior = leerLista(clave);
    if (invalidas.has(clave))
      throw new Error(
        "No se puede validar el carrito hasta recuperar los datos locales.",
      );
    const carrito = normalizarCarrito(anterior, usuarioId, productos, negocios);
    const ajustado = JSON.stringify(carrito) !== JSON.stringify(anterior);
    if (ajustado) guardarLista(clave, carrito);
    return {
      productos,
      negocios,
      carrito,
      ajustado,
      propios: carrito.filter((item) => mismoId(item.usuarioId, usuarioId)),
    };
  }

  async function contador(usuarioId) {
    const nodo = document.getElementById("contadorCarrito");
    if (!nodo) return;
    const { propios } = await contextoCarrito(usuarioId);
    nodo.textContent = propios.reduce(
      (total, item) => total + item.cantidad,
      0,
    );
  }

  return {
    claveCarrito,
    mismoId,
    dinero,
    escapar,
    imagenSegura,
    mensaje,
    leerLista,
    guardarLista,
    visible,
    stock,
    precioValido,
    normalizarCarrito,
    contextoCarrito,
    contador,
  };
})();
