const { responder } = require("./recurso.controller");
function createAuthController(auth, usuarios, opcionesCookie, instancia) {
  return {
    registro: async (req, res) =>
      responder(res, await usuarios.registrar(req.body), 201),
    login: async (req, res) => {
      const { token, usuario, csrf } = await auth.login(req.body);
      auth.logout(req.tokenSesion);
      res.cookie("rp_session", token, opcionesCookie);
      responder(res, { usuario, csrfToken: csrf });
    },
    sesion: async (req, res) =>
      responder(res, {
        usuario: req.usuario,
        csrfToken: req.sesion?.csrf || "",
        instancia,
      }),
    me: async (req, res) =>
      responder(res, { usuario: req.usuario, csrfToken: req.sesion.csrf }),
    logout: async (req, res) => {
      auth.logout(req.tokenSesion);
      res.clearCookie("rp_session", { ...opcionesCookie, maxAge: undefined });
      responder(res, { cerrada: true });
    },
  };
}
module.exports = { createAuthController };
