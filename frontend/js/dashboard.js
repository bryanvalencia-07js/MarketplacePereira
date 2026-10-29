function presentarResumen(usuarios, negocios, productos) {
  UI.kpis(document.getElementById("kpisAdministrador"), [
    ["Usuarios", usuarios.length],
    [
      "Administradores",
      usuarios.filter((u) => u.rol === "Administrador").length,
    ],
    ["Comerciantes", usuarios.filter((u) => u.rol === "Comerciante").length],
    ["Compradores", usuarios.filter((u) => u.rol === "Comprador").length],
    [
      "Usuarios inactivos",
      usuarios.filter((u) => u.estado !== "Activo").length,
    ],
    ["Comercios", negocios.length],
    ["Comercios activos", negocios.filter((n) => n.estado === "Activo").length],
    [
      "Comercios inactivos",
      negocios.filter((n) => n.estado !== "Activo").length,
    ],
    ["Productos", productos.length],
    [
      "Productos activos",
      productos.filter((p) => p.estado === "Activo").length,
    ],
    ["Agotados", productos.filter((p) => RP.stock(p) === 0).length],
    [
      "Stock bajo",
      productos.filter((p) => RP.stock(p) > 0 && RP.stock(p) <= 5).length,
    ],
  ]);
  const alertas = [
    [
      "usuarios inactivos",
      usuarios.filter((u) => u.estado !== "Activo").length,
    ],
    [
      "comercios inactivos",
      negocios.filter((n) => n.estado !== "Activo").length,
    ],
    ["productos agotados", productos.filter((p) => RP.stock(p) === 0).length],
    [
      "productos con stock bajo",
      productos.filter((p) => RP.stock(p) > 0 && RP.stock(p) <= 5).length,
    ],
  ];
  document.getElementById("alertasAdministrador").innerHTML = alertas
    .map(
      ([texto, cantidad]) =>
        `<li><strong>${cantidad}</strong> ${UI.e(texto)}</li>`,
    )
    .join("");
  const actividad = [
    ...usuarios.map((u) => ({
      ...u,
      tipo: "Usuario",
      titulo: `${u.nombre} ${u.apellido}`,
    })),
    ...negocios.map((n) => ({ ...n, tipo: "Comercio", titulo: n.nombre })),
    ...productos.map((p) => ({ ...p, tipo: "Producto", titulo: p.nombre })),
  ]
    .sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
    )
    .slice(0, 8);
  document.getElementById("actividadAdministrador").innerHTML =
    actividad
      .map(
        (a) =>
          `<li>${UI.e(a.tipo)} · ${UI.e(a.titulo)} <small>${a.createdAt ? UI.e(new Date(a.createdAt).toLocaleDateString("es-CO")) : "Sin fecha registrada"}</small></li>`,
      )
      .join("") || "<li>Aún no hay actividad registrada.</li>";
}
async function cargarDashboard() {
  try {
    UI.estado("Cargando resumen…", "carga");
    const datos = await Promise.all([
      API.get("/usuarios"),
      API.get("/negocios?gestion=true"),
      API.get("/productos?gestion=true"),
    ]);
    presentarResumen(...datos);
    UI.estado("", "exito");
  } catch (error) {
    UI.estado(error.message, "error");
  }
}
window.moduloListo = cargarDashboard();
