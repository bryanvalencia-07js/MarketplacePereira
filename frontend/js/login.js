async function iniciarSesion(event) {
  event.preventDefault();
  const boton = document.querySelector('button[type="submit"]');
  await UI.tarea(
    boton,
    async () => {
      const correo = document
        .getElementById("correo")
        .value.trim()
        .toLowerCase();
      const password = document.getElementById("password").value;
      const { usuario } = await API.post("/auth/login", { correo, password });
      document.getElementById("password").value = "";
      try {
        localStorage.setItem("rp_cambio_sesion", String(Date.now()));
      } catch {
        /* Cookie válida sin almacenamiento local. */
      }
      UI.estado("Inicio de sesión correcto.", "exito", "mensaje");
      location.assign(rutasPorRol[usuario.rol]);
    },
    "mensaje",
  );
}
