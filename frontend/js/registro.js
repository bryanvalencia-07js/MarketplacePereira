const rolSugerido = new URLSearchParams(location.search).get("rol");
if (["Comerciante", "Comprador"].includes(rolSugerido))
  document.getElementById("rol").value = rolSugerido;
async function registrarUsuario(event) {
  event.preventDefault();
  await UI.tarea(
    document.querySelector('button[type="submit"]'),
    async () => {
      const body = {};
      for (const k of ["nombre", "apellido", "correo", "password", "rol"])
        body[k] = document.getElementById(k).value;
      await API.post("/auth/registro", body);
      document.getElementById("password").value = "";
      UI.estado("Cuenta creada. Ya puedes iniciar sesión.", "exito", "mensaje");
      location.assign("login.html");
    },
    "mensaje",
  );
}
