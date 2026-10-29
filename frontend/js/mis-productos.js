let productos = [];
let negocios = [];
let miComercio = null;
let productoEditado = null;
const administrando = usuarioSesion.rol === "Administrador";
function obtenerMisProductos() {
  return productos;
}
async function cargarDatosProductos() {
  [productos, negocios] = await Promise.all([
    API.get("/productos?gestion=true"),
    API.get("/negocios?gestion=true"),
  ]);
  miComercio =
    negocios.find((n) => RP.mismoId(n.usuarioId, usuarioSesion.id)) || null;
  if (administrando) {
    const select = document.getElementById("productoNegocioId");
    const previo = select.value;
    select.innerHTML =
      '<option value="">Selecciona un comercio</option>' +
      negocios
        .map((n) => `<option value="${n.id}">${UI.e(n.nombre)}</option>`)
        .join("");
    select.value = previo;
  }
  document.getElementById("nombreComercioProductos").textContent = administrando
    ? "Supervisa los productos de todos los comercios."
    : miComercio
      ? `Administra los productos de ${miComercio.nombre}.`
      : "Primero registra tu comercio para publicar productos.";
  document.querySelector('#formProducto button[type="submit"]').disabled =
    !administrando && !miComercio;
  filtrarMisProductos();
}
function mostrarMisProductos(lista) {
  const contenedor = document.getElementById("listaMisProductos");
  contenedor.replaceChildren();
  document.getElementById("contadorMisProductos").textContent =
    `${lista.length} producto(s)`;
  document.getElementById("sinMisProductos").hidden = lista.length > 0;
  for (const p of lista) {
    const tarjeta = document.createElement("article");
    tarjeta.className = "producto-market-card";
    const img = RP.imagenSegura(p.imagen);
    const negocio = negocios.find((n) => RP.mismoId(n.id, p.negocioId));
    tarjeta.innerHTML = `<div class="producto-market-imagen">${img ? `<img class="producto-imagen-real" src="${img}" alt="${UI.e(p.nombre)}">` : `<span>${UI.e(String(p.nombre).charAt(0))}</span>`}</div><div class="producto-market-contenido"><span class="producto-categoria">${UI.e(p.categoria)}</span><span class="badge ${p.estado === "Activo" ? "badge-activo" : "badge-inactivo"}">${UI.e(p.estado)}</span><h3>${UI.e(p.nombre)}</h3><p>${UI.e(p.descripcion)}</p>${administrando ? `<p>${UI.e(negocio?.nombre)}</p>` : ""}<strong class="producto-precio">${RP.dinero(p.precio)}</strong><p class="producto-stock">Disponibles: ${p.stock} ${p.stock === 0 ? "· Agotado" : p.stock <= 5 ? "· Stock bajo" : ""}</p><div class="acciones-tabla"><button class="boton-accion editar">Editar</button><button class="boton-accion estado">Cambiar estado</button><button class="boton-accion eliminar">Eliminar</button></div></div>`;
    tarjeta
      .querySelector(".editar")
      .addEventListener("click", () => editarProducto(p.id));
    tarjeta
      .querySelector(".estado")
      .addEventListener("click", () => cambiarEstadoProducto(p.id));
    tarjeta
      .querySelector(".eliminar")
      .addEventListener("click", () => eliminarProducto(p.id));
    contenedor.append(tarjeta);
  }
}
function filtrarMisProductos() {
  const texto = document
    .getElementById("buscarProducto")
    .value.trim()
    .toLowerCase();
  const categoria = document.getElementById("filtroCategoriaProducto").value;
  mostrarMisProductos(
    productos.filter(
      (p) =>
        (!categoria || p.categoria === categoria) &&
        `${p.nombre} ${p.descripcion}`.toLowerCase().includes(texto),
    ),
  );
}
async function guardarProducto(event) {
  event.preventDefault();
  if (ImagenProducto.procesando) {
    UI.estado(
      "La imagen todavía se está procesando.",
      "error",
      "mensajeProducto",
    );
    return;
  }
  await UI.tarea(
    document.querySelector('#formProducto button[type="submit"]'),
    async () => {
      const negocioId = administrando
        ? Number(document.getElementById("productoNegocioId").value)
        : miComercio?.id;
      if (!negocioId)
        throw new Error("Selecciona o registra un comercio antes de publicar.");
      const body = {
        negocioId,
        nombre: document.getElementById("nombreProducto").value,
        descripcion: document.getElementById("descripcionProducto").value,
        categoria: document.getElementById("categoriaProducto").value,
        precio: Number(document.getElementById("precioProducto").value),
        stock: Number(document.getElementById("stockProducto").value),
      };
      if (!ImagenProducto.valor)
        throw new Error("Debes seleccionar una imagen del producto.");
      body.imagen = ImagenProducto.valor;
      if (productoEditado) await API.put(`/productos/${productoEditado}`, body);
      else await API.post("/productos", body);
      limpiarFormularioProducto();
      await cargarDatosProductos();
      UI.estado("Producto guardado correctamente.", "exito", "mensajeProducto");
    },
    "mensajeProducto",
  );
}
async function editarProducto(id) {
  try {
    const p = await API.get(`/productos/${id}`);
    if (!administrando && !RP.mismoId(p.negocioId, miComercio?.id))
      throw new Error("El producto no pertenece a tu comercio.");
    productoEditado = p.id;
    document.getElementById("productoId").value = p.id;
    for (const [campo, key] of Object.entries({
      nombreProducto: "nombre",
      descripcionProducto: "descripcion",
      categoriaProducto: "categoria",
      precioProducto: "precio",
      stockProducto: "stock",
    }))
      document.getElementById(campo).value = p[key];
    if (administrando)
      document.getElementById("productoNegocioId").value = p.negocioId;
    ImagenProducto.cargar(p.imagen);
    document.getElementById("tituloFormularioProducto").textContent =
      "Editar producto";
    document.getElementById("btnCancelarProducto").hidden = false;
    document.getElementById("nombreProducto").focus();
  } catch (error) {
    UI.estado(error.message, "error", "mensajeProducto");
  }
}
function limpiarFormularioProducto() {
  productoEditado = null;
  document.getElementById("formProducto").reset();
  ImagenProducto.cargar("");
  document.getElementById("productoId").value = "";
  document.getElementById("tituloFormularioProducto").textContent =
    "Registrar producto";
  document.getElementById("btnCancelarProducto").hidden = true;
}
function cancelarEdicionProducto() {
  limpiarFormularioProducto();
  UI.estado("Edición cancelada.", "exito", "mensajeProducto");
}
function previsualizarImagen(event) {
  ImagenProducto.seleccionar(event);
}
async function cambiarEstadoProducto(id) {
  try {
    const p = await API.get(`/productos/${id}`);
    await API.put(`/productos/${id}`, {
      estado: p.estado === "Activo" ? "Inactivo" : "Activo",
    });
    await cargarDatosProductos();
    UI.estado("Estado actualizado.", "exito", "mensajeProducto");
  } catch (error) {
    UI.estado(error.message, "error", "mensajeProducto");
  }
}
async function eliminarProducto(id) {
  if (
    !(await UI.confirmar(
      "¿Eliminar este producto? Se retirará del catálogo y del carrito cuando se valide nuevamente.",
    ))
  )
    return;
  try {
    await API.delete(`/productos/${id}`);
    if (productoEditado === id) limpiarFormularioProducto();
    await cargarDatosProductos();
    UI.estado("Producto eliminado.", "exito", "mensajeProducto");
  } catch (error) {
    UI.estado(error.message, "error", "mensajeProducto");
  }
}
window.moduloListo = cargarDatosProductos().catch((error) =>
  UI.estado(error.message, "error", "mensajeProducto"),
);
