function configuracion(env = process.env) {
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT inválido.");
  if (Boolean(env.ADMIN_EMAIL) !== Boolean(env.ADMIN_PASSWORD))
    throw new Error("Configura ADMIN_EMAIL y ADMIN_PASSWORD juntos.");
  if (env.APP_ORIGIN && !/^https?:\/\/[^/]+$/.test(env.APP_ORIGIN))
    throw new Error("APP_ORIGIN debe ser un origen HTTP/HTTPS sin ruta.");
  const dataSource = env.DATA_SOURCE || "memory";
  if (!["memory", "mysql"].includes(dataSource))
    throw new Error("DATA_SOURCE debe ser memory o mysql.");
  let db;
  if (dataSource === "mysql") {
    for (const key of ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"])
      if (!env[key]) throw new Error(`Configura ${key} para MySQL.`);
    const dbPort = Number(env.DB_PORT || 3306);
    if (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535)
      throw new Error("DB_PORT inválido.");
    db = {
      host: env.DB_HOST,
      port: dbPort,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
    };
  }
  return {
    port,
    dataSource,
    db,
    origin: env.APP_ORIGIN,
    secure: env.NODE_ENV === "production",
    admin: env.ADMIN_EMAIL
      ? {
          correo: env.ADMIN_EMAIL,
          password: env.ADMIN_PASSWORD,
        }
      : null,
  };
}
module.exports = { configuracion };
