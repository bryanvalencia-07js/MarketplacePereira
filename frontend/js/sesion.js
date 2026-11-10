const rutasPorRol = {
  Administrador: "dashboard.html",
  Comerciante: "mi-negocio.html",
  Comprador: "marketplace.html",
};
let usuarioSesion = null;
async function actualizarSesion() {
  const data = await API.get("/auth/sesion");
  usuarioSesion = data.usuario;
  for (const [id, valor] of Object.entries({
    nombreUsuario: usuarioSesion
      ? `${usuarioSesion.nombre} ${usuarioSesion.apellido}`
      : "Invitado",
    rolUsuario: usuarioSesion?.rol || "Explorador local",
    bienvenida: usuarioSesion
      ? `Bienvenido, ${usuarioSesion.nombre}`
      : "Bienvenido",
  })) {
    const nodo = document.getElementById(id);
    if (nodo) nodo.textContent = valor;
  }
  for (const nodo of document.querySelectorAll('[data-click="cerrarSesion"]'))
    nodo.hidden = !usuarioSesion;
  for (const nodo of document.querySelectorAll(".carrito-navbar"))
    nodo.hidden = Boolean(usuarioSesion && usuarioSesion.rol !== "Comprador");
  const zona = document.querySelector(".market-usuario");
  if (
    zona &&
    !document.getElementById("enlacePerfil") &&
    (!usuarioSesion || usuarioSesion.rol !== "Comprador")
  ) {
    const enlace = document.createElement("a");
    enlace.id = "enlacePerfil";
    enlace.className = "boton boton-secundario";
    enlace.href = usuarioSesion ? rutasPorRol[usuarioSesion.rol] : "login.html";
    enlace.textContent = usuarioSesion ? "Mi panel" : "Ingresar";
    zona.append(enlace);
  }
  const navPublica = document.querySelector(".market-menu-interior");
  const navGestion = document.querySelector(".gestion-nav .contenedor");
  
  if (navPublica) {
    navPublica.querySelectorAll("[data-nav-pr6]").forEach((n) => n.remove());
  
    if (!navPublica.querySelector('a[href="servicios.html"]')) {
      const a = document.createElement("a");
      a.href = "servicios.html";
      a.textContent = "Servicios";
      a.dataset.navPr6 = "true";
      navPublica.append(a);
    }
  }
  
  if (navGestion && usuarioSesion) {
    navGestion.querySelectorAll("[data-nav-pr6]").forEach((n) => n.remove());
  
    let enlaces = [];
  
    if (usuarioSesion.rol === "Comerciante") {
      enlaces = [
        ["mis-servicios.html", "Servicios del comercio"],
        ["reservas.html", "Reservas recibidas"],
        ["pedidos.html", "Pedidos recibidos"],
        ["mi-negocio.html", "Mi negocio"],
        ["mis-productos.html", "Mis productos"],
      ];
    }
  
    if (usuarioSesion.rol === "Administrador") {
      enlaces = [
        ["mis-servicios.html", "Servicios"],
        ["reservas.html", "Reservas"],
        ["pedidos.html", "Pedidos"],
        ["dashboard.html", "Mi panel"],
        ["usuarios.html", "Usuarios"],
        ["negocios.html", "Negocios"],
        ["productos.html", "Productos"],
      ];
    }
  
    for (const [href, texto] of enlaces) {
      if (navGestion.querySelector(`a[href="${href}"]`)) continue;
  
      const a = document.createElement("a");
      a.href = href;
      a.textContent = texto;
      a.dataset.navPr6 = "true";
      navGestion.append(a);
    }
  }
  return usuarioSesion;
}
const sesionLista = actualizarSesion();
// Evitar rechazos sin manejar mientras el bootstrap espera el resultado.
sesionLista.catch(() => {});
function protegerPorRol(roles) {
  if (!usuarioSesion) {
    location.replace("login.html");
    return false;
  }
  if (!roles.includes(usuarioSesion.rol)) {
    location.replace(rutasPorRol[usuarioSesion.rol] || "login.html");
    return false;
  }
  return true;
}
async function validarSesionAccion(rol) {
  await actualizarSesion();
  return protegerPorRol([rol]);
}
async function cerrarSesion(event) {
  await UI.tarea(
    event?.target?.closest("button") ||
      document.querySelector('[data-click="cerrarSesion"]'),
    async () => {
      await API.post("/auth/logout");
      usuarioSesion = null;
      // Notificar otras pestañas sin almacenar identidad ni token.
      try {
        localStorage.setItem("rp_cambio_sesion", String(Date.now()));
      } catch {
        /* El servidor ya cerró la sesión. */
      }
      location.replace("login.html");
    },
  );
}
window.addEventListener("sesion-caducada", () =>
  location.replace("login.html"),
);
window.addEventListener("storage", async (event) => {
  if (event.key !== "rp_cambio_sesion") return;
  const previo = usuarioSesion?.id;
  try {
    await actualizarSesion();
    if (previo !== usuarioSesion?.id) location.reload();
  } catch (error) {
    UI.estado(error.message, "error");
  }
});
