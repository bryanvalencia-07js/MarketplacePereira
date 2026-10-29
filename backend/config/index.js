function configuracion() {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT inválido.");
  if (Boolean(process.env.ADMIN_EMAIL) !== Boolean(process.env.ADMIN_PASSWORD))
    throw new Error("Configura ADMIN_EMAIL y ADMIN_PASSWORD juntos.");
  if (
    process.env.APP_ORIGIN &&
    !/^https?:\/\/[^/]+$/.test(process.env.APP_ORIGIN)
  )
    throw new Error("APP_ORIGIN debe ser un origen HTTP/HTTPS sin ruta.");
  return {
    port,
    origin: process.env.APP_ORIGIN,
    secure: process.env.NODE_ENV === "production",
    admin: process.env.ADMIN_EMAIL
      ? {
          correo: process.env.ADMIN_EMAIL,
          password: process.env.ADMIN_PASSWORD,
        }
      : null,
  };
}
module.exports = { configuracion };
