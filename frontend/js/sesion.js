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
  const paginaActual = location.pathname.split("/").pop() || "index.html";

  const navPublica = document.querySelector(".market-menu-interior");
  const navGestion = document.querySelector(".gestion-nav .contenedor");
  const navLanding = document.querySelector(".landing-nav nav");
  
  function agregarEnlacesNavegacion(nav, enlaces) {
    if (!nav) return;
  
    nav.querySelectorAll("[data-nav-pr6]").forEach((n) => n.remove());
  
    for (const [href, texto] of enlaces) {
      if (nav.querySelector(`a[href="${href}"]`)) continue;
  
      const enlace = document.createElement("a");
      enlace.href = href;
      enlace.textContent = texto;
      enlace.dataset.navPr6 = "true";
      nav.append(enlace);
    }
  }
  
  /* Navegación pública de la landing */
  if (navLanding) {
    agregarEnlacesNavegacion(navLanding, [
      ["servicios.html", "Servicios"],
    ]);
  }
  
  /* Navegación tipo marketplace */
  if (navPublica) {
    const enlaces = [
      ["servicios.html", "Servicios"],
    ];
  
    if (usuarioSesion?.rol === "Comprador") {
      enlaces.push(
        ["mis-reservas.html", "Mis reservas"],
        ["favoritos.html", "Favoritos"],
        ["mis-pedidos.html", "Mis pedidos"],
        ["marketplace.html", "Marketplace"],
        ["carrito.html", "Carrito"],
      );
    }
  
    /*
     * En marketplace.html el Comerciante y Administrador
     * conservan solamente la navegación pública para evitar
     * saturar horizontalmente el navbar.
     *
     * En las páginas operativas que también usan market-menu,
     * sí mostramos sus herramientas de gestión.
     */
    if (
      paginaActual !== "marketplace.html" &&
      usuarioSesion?.rol === "Comerciante"
    ) {
      enlaces.push(
        ["mis-servicios.html", "Servicios del comercio"],
        ["reservas.html", "Reservas recibidas"],
        ["pedidos.html", "Pedidos recibidos"],
        ["mi-negocio.html", "Mi negocio"],
        ["mis-productos.html", "Mis productos"],
      );
    }
  
    if (
      paginaActual !== "marketplace.html" &&
      usuarioSesion?.rol === "Administrador"
    ) {
      enlaces.push(
        ["mis-servicios.html", "Servicios"],
        ["reservas.html", "Reservas"],
        ["pedidos.html", "Pedidos"],
        ["dashboard.html", "Mi panel"],
        ["usuarios.html", "Usuarios"],
        ["negocios.html", "Negocios"],
        ["productos.html", "Productos"],
      );
    }
  
    agregarEnlacesNavegacion(navPublica, enlaces);
  }
  
  /* Paneles que utilizan gestion-nav */
  if (navGestion && usuarioSesion) {
    const enlaces = [];
  
    if (usuarioSesion.rol === "Comerciante") {
      enlaces.push(
        ["mis-servicios.html", "Servicios del comercio"],
        ["reservas.html", "Reservas recibidas"],
        ["pedidos.html", "Pedidos recibidos"],
        ["mi-negocio.html", "Mi negocio"],
        ["mis-productos.html", "Mis productos"],
      );
    }
  
    if (usuarioSesion.rol === "Administrador") {
      enlaces.push(
        ["mis-servicios.html", "Servicios"],
        ["reservas.html", "Reservas"],
        ["pedidos.html", "Pedidos"],
        ["dashboard.html", "Mi panel"],
        ["usuarios.html", "Usuarios"],
        ["negocios.html", "Negocios"],
        ["productos.html", "Productos"],
      );
    }
  
    agregarEnlacesNavegacion(navGestion, enlaces);
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
