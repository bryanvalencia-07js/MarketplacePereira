const { timingSafeEqual } = require("node:crypto");
const { exigir } = require("../utils/errors");
function tokenCookie(req) {
  const entrada = String(req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("rp_session="));
  return entrada?.slice("rp_session=".length) || "";
}
const requerirSesion = (req, res, next) => {
  try {
    exigir(req.usuario, 401, "Inicia sesión para continuar.");
    next();
  } catch (error) {
    next(error);
  }
};
const roles =
  (...permitidos) =>
  (req, res, next) => {
    try {
      exigir(req.usuario, 401, "Inicia sesión para continuar.");
      exigir(
        permitidos.includes(req.usuario.rol),
        403,
        "No tienes permisos para esta operación.",
      );
      next();
    } catch (error) {
      next(error);
    }
  };
function csrf(req, res, next) {
  try {
    const recibido = req.get("X-CSRF-Token") || "";
    const esperado = req.sesion?.csrf || "";
    exigir(
      esperado &&
        recibido.length === esperado.length &&
        timingSafeEqual(Buffer.from(recibido), Buffer.from(esperado)),
      403,
      "La sesión de seguridad no es válida. Recarga la página.",
    );
    next();
  } catch (error) {
    next(error);
  }
}
function mismoOrigen(originConfigurado) {
  return (req, res, next) => {
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        const origin = req.get("Origin");
        const esperado =
          originConfigurado || `${req.protocol}://${req.get("host")}`;
        exigir(
          !origin || origin === esperado,
          403,
          "Origen de solicitud no permitido.",
        );
        exigir(
          req.get("Sec-Fetch-Site") !== "cross-site",
          403,
          "Origen de solicitud no permitido.",
        );
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
function limitar({
  limite = 60,
  ventana = 60000,
  identificar = (req) => req.ip,
} = {}) {
  const intentos = new Map();
  return (req, res, next) => {
    const ahora = Date.now();
    // Limpieza acotada: no retener IP/correo indefinidamente.
    for (const [k, v] of intentos) if (v.fin <= ahora) intentos.delete(k);
    const k = identificar(req);
    const previo = intentos.get(k);
    if (!previo && intentos.size >= 10000)
      return res.status(429).json({
        ok: false,
        mensaje: "Demasiadas solicitudes. Intenta más tarde.",
      });
    const dato = previo || { cantidad: 0, fin: ahora + ventana };
    dato.cantidad++;
    intentos.set(k, dato);
    if (dato.cantidad > limite) {
      res.set("Retry-After", String(Math.ceil((dato.fin - ahora) / 1000)));
      return res.status(429).json({
        ok: false,
        mensaje: "Demasiados intentos. Intenta más tarde.",
      });
    }
    next();
  };
}
function cabeceras(req, res, next) {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  });
  if (process.env.NODE_ENV === "production")
    res.set("Strict-Transport-Security", "max-age=31536000");
  next();
}
module.exports = {
  tokenCookie,
  requerirSesion,
  roles,
  csrf,
  mismoOrigen,
  limitar,
  cabeceras,
};
