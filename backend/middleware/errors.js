const { AppError } = require("../utils/errors");
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status =
    error instanceof AppError
      ? error.status
      : error.type === "entity.too.large"
        ? 413
        : error instanceof SyntaxError && error.status === 400
          ? 400
          : 500;
  const mensaje =
    error instanceof AppError
      ? error.message
      : status === 413
        ? "La imagen o solicitud es demasiado grande."
        : status === 400
          ? "El cuerpo JSON no es válido."
          : "No se pudo completar la operación. Intenta nuevamente.";
  if (status === 500)
    console.error("Error de operación en la API:", error.name);
  res.status(status).json({ ok: false, mensaje });
}
module.exports = { errorHandler };
