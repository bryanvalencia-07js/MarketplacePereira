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
  const nav = document.querySelector(
    ".gestion-nav .contenedor, .market-menu-interior, .landing-nav nav",
  );
  if (nav) {
    nav.querySelectorAll("[data-nav-pr6]").forEach((n) => n.remove());
    const enlaces = [["servicios.html", "Servicios"]];
    if (usuarioSesion?.rol === "Comprador")
      enlaces.push(
        ["mis-reservas.html", "Mis reservas"],
        ["favoritos.html", "Favoritos"],
      );
    if (["Comerciante", "Administrador"].includes(usuarioSesion?.rol))
      enlaces.push(
        ["mis-servicios.html", "Servicios del comercio"],
        ["reservas.html", "Reservas recibidas"],
      );
    for (const [href, texto] of enlaces) {
      if (nav.querySelector(`a[href="${href}"]`)) continue;
      const a = document.createElement("a");
      a.href = href;
      a.textContent = texto;
      a.dataset.navPr6 = "true";
      nav.append(a);
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
