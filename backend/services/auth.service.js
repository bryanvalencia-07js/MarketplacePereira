const { randomBytes, createHash } = require("node:crypto");
const { exigir } = require("../utils/errors");
const V = require("../utils/validation");
const { verifyPassword, hashPassword } = require("../utils/password");
const { publico } = require("./usuario.service");
function createAuthService(
  repos,
  { ttl = 8 * 60 * 60 * 1000, ahora = Date.now } = {},
) {
  const sesiones = new Map();
  const clave = (token) => createHash("sha256").update(token).digest("hex");
  let hashFicticio;
  function limpiar() {
    for (const [k, s] of sesiones) if (s.expira <= ahora()) sesiones.delete(k);
  }
  function revocar(usuarioId) {
    for (const [k, s] of sesiones)
      if (s.usuarioId === usuarioId) sesiones.delete(k);
  }
  async function login(body) {
    V.objeto(body, ["correo", "password"]);
    const correo = V.correo(body.correo);
    exigir(
      typeof body.password === "string" && body.password.length <= 128,
      401,
      "Correo o contraseña incorrectos.",
    );
    const usuario = (await repos.usuario.list()).find(
      (u) => u.correo === correo,
    );
    hashFicticio ??= await hashPassword(randomBytes(32).toString("hex"));
    const valido = await verifyPassword(
      body.password,
      usuario?.passwordHash || hashFicticio,
    );
    exigir(
      valido && usuario?.estado === "Activo",
      401,
      "Correo o contraseña incorrectos.",
    );
    limpiar();
    exigir(
      sesiones.size < 10000,
      503,
      "No se pudo iniciar sesión. Intenta más tarde.",
    );
    const token = randomBytes(32).toString("hex");
    const csrf = randomBytes(32).toString("hex");
    sesiones.set(clave(token), {
      usuarioId: usuario.id,
      csrf,
      expira: ahora() + ttl,
    });
    return { token, csrf, usuario: publico(usuario) };
  }
  async function resolver(token) {
    if (!/^[0-9a-f]{64}$/.test(token || "")) return null;
    const k = clave(token);
    const sesion = sesiones.get(k);
    if (!sesion || sesion.expira <= ahora()) {
      sesiones.delete(k);
      return null;
    }
    const usuario = await repos.usuario.find(sesion.usuarioId);
    if (!usuario || usuario.estado !== "Activo") {
      sesiones.delete(k);
      return null;
    }
    return { usuario: publico(usuario), csrf: sesion.csrf };
  }
  return {
    login,
    resolver,
    revocar,
    logout(token) {
      if (token) sesiones.delete(clave(token));
    },
  };
}
module.exports = { createAuthService };
