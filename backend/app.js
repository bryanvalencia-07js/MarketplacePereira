const express = require("express");
const { randomUUID } = require("node:crypto");
const path = require("node:path");
const { createRepositories } = require("./repositories");
const { validarRepositories } = require("./repositories/contract");
const { createAuthService } = require("./services/auth.service");
const { createUsuarioService } = require("./services/usuario.service");
const { createNegocioService } = require("./services/negocio.service");
const { createProductoService } = require("./services/producto.service");
const { apiRoutes } = require("./routes");
const { createPublicoService } = require("./services/publico.service");
const {
  tokenCookie,
  mismoOrigen,
  limitar,
  cabeceras,
} = require("./middleware/security");
const { errorHandler } = require("./middleware/errors");
const { AppError } = require("./utils/errors");

async function createApplication({
  repositories = createRepositories(),
  origin,
  secure = false,
  admin,
  sessionOptions,
} = {}) {
  validarRepositories(repositories);
  const instancia = randomUUID();
  const app = express();
  app.disable("x-powered-by");
  app.set("query parser", "simple");
  const auth = createAuthService(repositories, sessionOptions);
  const usuarios = createUsuarioService(repositories, auth.revocar);
  const servicios = {
    auth,
    usuarios,
    negocios: createNegocioService(repositories),
    productos: createProductoService(repositories),
  };
  servicios.publico = createPublicoService(servicios);
  if (
    admin &&
    !(await repositories.usuario.list()).some((u) => u.rol === "Administrador")
  ) {
    await usuarios.crear(null, {
      nombre: "Administración",
      apellido: "Reactiva Pereira",
      correo: admin.correo,
      password: admin.password,
      rol: "Administrador",
    });
  }

  /* =========================================================
    USUARIOS DEMO · SOLO MIENTRAS NO HAYA BASE DE DATOS
  ========================================================= */

  const usuariosDemo = [
    {
      nombre: "Angel",
      apellido: "Gutierrez",
      correo: "comprador@reactivapereira.local",
      password: "CompradorDemo2026!",
      rol: "Comprador",
    },

    {
      nombre: "Juan",
      apellido: "Betancur",
      correo: "comerciante1@reactivapereira.local",
      password: "ComercianteDemo2026!",
      rol: "Comerciante",
    },

    {
      nombre: "Andrea",
      apellido: "Torres",
      correo: "comerciante2@reactivapereira.local",
      password: "ComercianteDemo2026!",
      rol: "Comerciante",
    },
  ];


  const usuariosExistentes =
    await repositories.usuario.list();


  for (const demo of usuariosDemo) {

    const existe =
      usuariosExistentes.some(
        (usuario) =>
          usuario.correo === demo.correo
      );


    if (!existe) {

      await usuarios.crear(
        null,
        demo
      );

    }

  } 

  app.use(cabeceras);
  app.use(
    "/api",
    (req, res, next) => {
      res.set("Cache-Control", "no-store");
      next();
    },
    mismoOrigen(origin),
    limitar({ limite: 300, ventana: 60000 }),
    (req, res, next) => {
      const encoding = req.get("Content-Encoding");
      if (encoding && encoding.trim().toLowerCase() !== "identity")
        return next(
          new AppError(
            415,
            "No se aceptan cuerpos comprimidos. Envía JSON sin compresión.",
          ),
        );
      next();
    },
    express.json({ limit: "2mb", inflate: false }),
  );
  app.use("/api", async (req, res, next) => {
    req.tokenSesion = tokenCookie(req);
    req.sesion = await auth.resolver(req.tokenSesion);
    req.usuario = req.sesion?.usuario || null;
    next();
  });
  app.get("/api/salud", (req, res) =>
    res.json({ ok: true, data: { estado: "disponible" } }),
  );
  app.use(
    "/api",
    apiRoutes(
      servicios,
      {
        httpOnly: true,
        sameSite: "strict",
        secure,
        path: "/",
        maxAge: 8 * 60 * 60 * 1000,
      },
      instancia,
    ),
  );
  app.use("/api", (req, res, next) =>
    next(new AppError(404, "Ruta API no encontrada.")),
  );
  app.get("/favicon.ico", (req, res) => res.status(204).end());
  app.use(
    express.static(path.join(__dirname, "../frontend"), { dotfiles: "deny" }),
  );
  app.use((req, res) =>
    res
      .status(404)
      .type("html")
      .send(
        '<!doctype html><html lang="es"><meta charset="utf-8"><title>Página no encontrada</title><h1>Página no encontrada</h1><a href="/index.html">Volver a Reactiva Pereira</a></html>',
      ),
  );
  app.use(errorHandler);
  return { app, repositories, servicios };
}
if (require.main === module) {
  const { configuracion } = require("./config");
  (async () => {
    const config = configuracion();
    const { app } = await createApplication(config);
    const server = app.listen(config.port, () =>
      console.log(
        `Reactiva Pereira disponible en puerto ${config.port}. Persistencia temporal en memoria.`,
      ),
    );
    server.requestTimeout = 30000;
    server.headersTimeout = 15000;
    server.on("error", (error) => {
      console.error("No se pudo iniciar el servidor:", error.code);
      process.exitCode = 1;
    });
  })().catch((error) => {
    console.error("No se pudo preparar el servidor:", error.message);
    process.exitCode = 1;
  });
}
module.exports = { createApplication };
