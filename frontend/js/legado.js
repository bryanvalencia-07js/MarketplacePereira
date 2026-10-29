/* Respaldo local del prototipo: nunca importa identidades ni permisos al servidor. */
function prepararRespaldoLegado() {
  const claves = [
    "usuarios",
    "usuarioSesion",
    "negocios",
    "productos",
    "carrito",
  ];
  const respaldo = {};
  let existe = false;
  try {
    for (const clave of claves) {
      const raw = localStorage.getItem(clave);
      if (raw === null) continue;
      existe = true;
      try {
        const valor = JSON.parse(raw);
        if (clave === "usuarios" && Array.isArray(valor))
          respaldo.usuarios = valor.map((u) => ({
            id: u.id,
            nombre: u.nombre,
            apellido: u.apellido,
            correo: u.correo,
            rol: u.rol,
            estado: u.estado,
          }));
        else if (clave !== "usuarios" && clave !== "usuarioSesion")
          respaldo[clave] = valor;
      } catch {
        respaldo[clave] =
          clave === "usuarios" || clave === "usuarioSesion"
            ? "No recuperable: formato inválido, credenciales descartadas."
            : raw;
      }
    }
    // Retirar inmediatamente las copias de contraseñas y la antigua sesión.
    localStorage.removeItem("usuarioSesion");
    if (respaldo.usuarios)
      localStorage.setItem("usuarios", JSON.stringify(respaldo.usuarios));
    else localStorage.removeItem("usuarios");
    if (existe) {
      localStorage.setItem("rp_respaldo_legado", JSON.stringify(respaldo));
      for (const clave of claves) localStorage.removeItem(clave);
    }
    const guardado = existe
      ? respaldo
      : JSON.parse(localStorage.getItem("rp_respaldo_legado") || "null");
    if (!guardado) return;
    const aviso = document.createElement("aside");
    aviso.className = "estado-vacio contenedor";
    const texto = document.createElement("p");
    texto.textContent =
      "Hay datos del prototipo anterior guardados como respaldo, sin contraseñas. Crea tu cuenta en el servidor y vuelve a publicar tu comercio; no se importan identidades ni permisos automáticamente.";
    const boton = document.createElement("button");
    boton.className = "boton boton-secundario";
    boton.textContent = "Descargar respaldo anterior";
    boton.addEventListener("click", () => {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(guardado, null, 2)], {
          type: "application/json",
        }),
      );
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = "reactiva-pereira-respaldo-sin-contrasenas.json";
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    aviso.append(texto, boton);
    document.querySelector("main")?.append(aviso);
  } catch {
    UI.estado(
      "No se pudo preparar el respaldo local. Revisa los permisos y exporta tus datos antes de limpiar el navegador.",
      "error",
    );
  }
}
prepararRespaldoLegado();
