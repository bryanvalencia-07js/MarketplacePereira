let miNegocio = null;
async function cargarMiNegocio() {
  const [negocios, productos] = await Promise.all([
    API.get("/negocios?gestion=true"),
    API.get("/productos?gestion=true"),
  ]);
  miNegocio =
    negocios.find((n) => RP.mismoId(n.usuarioId, usuarioSesion.id)) || null;
  UI.kpis(document.getElementById("kpisComerciante"), [
    ["Productos", productos.length],
    ["Activos", productos.filter((p) => p.estado === "Activo").length],
    ["Inactivos", productos.filter((p) => p.estado !== "Activo").length],
    ["Agotados", productos.filter((p) => p.stock === 0).length],
    ["Stock bajo", productos.filter((p) => p.stock > 0 && p.stock <= 5).length],
    ["Visitas", productos.reduce((a, p) => a + p.popularidad, 0)],
  ]);
  document.getElementById("estadoSinComercio").hidden = Boolean(miNegocio);
  document.getElementById("seccionMiComercio").hidden = !miNegocio;
  document.getElementById("btnProductos").hidden = !miNegocio;
  document.getElementById("completitudComercio").textContent = miNegocio
    ? `Perfil completo: ${Math.round((["nombre", "categoria", "telefono", "direccion"].filter((k) => miNegocio[k]).length / 4) * 100)}%`
    : "Completa tu comercio para comenzar.";
  document.getElementById("previewComercio").href = miNegocio
    ? `marketplace.html?negocioId=${miNegocio.id}`
    : "marketplace.html";
  if (!miNegocio) return;
  document.getElementById("tituloFormularioComercio").textContent =
    "Editar mi comercio";
  for (const [campo, key] of Object.entries({
    nombreNegocio: "nombre",
    categoria: "categoria",
    telefono: "telefono",
    direccion: "direccion",
  }))
    document.getElementById(campo).value = miNegocio[key];
  for (const [campo, valor] of Object.entries({
    inicialComercio: miNegocio.nombre.charAt(0).toUpperCase(),
    vistaNombreNegocio: miNegocio.nombre,
    vistaCategoria: miNegocio.categoria,
    vistaPropietario: miNegocio.propietario,
    vistaTelefono: miNegocio.telefono,
    vistaDireccion: miNegocio.direccion,
    estadoMiComercio: miNegocio.estado,
  }))
    document.getElementById(campo).textContent = valor;
  document.getElementById("estadoMiComercio").className =
    `badge ${miNegocio.estado === "Activo" ? "badge-activo" : "badge-inactivo"}`;
}
async function guardarMiNegocio(event) {
  event.preventDefault();
  await UI.tarea(
    document.querySelector('#formMiNegocio button[type="submit"]'),
    async () => {
      const body = {
        nombre: document.getElementById("nombreNegocio").value,
        categoria: document.getElementById("categoria").value,
        telefono: document.getElementById("telefono").value,
        direccion: document.getElementById("direccion").value,
      };
      if (miNegocio) await API.put(`/negocios/${miNegocio.id}`, body);
      else await API.post("/negocios", body);
      await cargarMiNegocio();
      UI.estado(
        "Información guardada correctamente.",
        "exito",
        "mensajeMiNegocio",
      );
    },
    "mensajeMiNegocio",
  );
}
async function cambiarEstadoMiNegocio() {
  try {
    await API.put(`/negocios/${miNegocio.id}`, {
      estado: miNegocio.estado === "Activo" ? "Inactivo" : "Activo",
    });
    await cargarMiNegocio();
    UI.estado("Estado actualizado.", "exito", "mensajeMiNegocio");
  } catch (error) {
    UI.estado(error.message, "error", "mensajeMiNegocio");
  }
}
window.moduloListo = cargarMiNegocio().catch((error) =>
  UI.estado(error.message, "error", "mensajeMiNegocio"),
);
