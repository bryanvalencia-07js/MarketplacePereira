# Reactiva Pereira

Marketplace universitario para visibilizar comercios de Pereira, descubrir productos locales y apoyar la reactivación de la ciudad.

Aplicación fullstack con experiencias de Administrador, Comerciante y Comprador. Implementadas las fases 2–13 del [roadmap de ejecución](docs/ROADMAP.md), sobre la Fase 1 previamente validada. No incluye pagos reales ni MySQL.

## Stack y arquitectura

HTML, CSS y JavaScript nativo; Node.js 24 y Express 5. Sin framework frontend, framework CSS ni ORM.

```text
Navegador → api.js / fetch → Express
                             → Routes
                             → Controllers
                             → Services
                             → Repositories async
                             → memoria temporal
```

Express sirve tanto el frontend como `/api`, desde el mismo origen. No se necesita un servidor Python separado. Las entidades principales y la autenticación ya no dependen de LocalStorage.

## Instalación y ejecución

```bash
# Desde la raíz del repositorio, con Node.js 24:
npm ci --prefix backend
npm start --prefix backend
```

La aplicación y la API se sirven en el puerto 3000 por defecto. Para desarrollo con recarga del backend:

```bash
npm run dev --prefix backend
```

No hay paso de compilación frontend. `PORT` permite cambiar el puerto. El archivo `.nvmrc` indica Node 24. Se comprobaron Node 24.19.0 y npm 11.9.0.

### Cuentas y administrador inicial

El registro público crea Comerciantes o Compradores. No se distribuyen cuentas ni contraseñas predeterminadas.

Para habilitar el Administrador inicial, configura **ambas** variables `ADMIN_EMAIL` y `ADMIN_PASSWORD` en el entorno del proceso. También puedes copiar `backend/.env.example` a `backend/.env` y completarlas localmente; `.env` está ignorado por Git y los scripts de arranque lo leen mediante Node. La contraseña debe tener entre 12 y 128 caracteres. Nunca incorporar ese archivo o valores reales al repositorio.

Las cuentas, comercios, productos y sesiones permanecen **solo en memoria**: reiniciar el backend los restablece. El administrador se vuelve a crear al arrancar si las variables están configuradas. Esta limitación es intencional hasta la futura persistencia; no cargar aquí datos únicos sin respaldo.

Para un despliegue externo se requiere HTTPS, `NODE_ENV=production` y `APP_ORIGIN` con el origen HTTPS exacto, sin ruta. Los [avisos de seguridad conocidos](docs/SECURITY.md) deben revisarse antes de considerar un despliegue comercial.

## Roles

| Rol | Inicio | Capacidades |
|---|---|---|
| Administrador | `dashboard.html` | KPIs, alertas, actividad y CRUD de usuarios, negocios y productos |
| Comerciante | `mi-negocio.html` | Su comercio, indicadores, preview público y sus productos |
| Comprador | `marketplace.html` | Catálogo, detalle y carrito temporal propio |
| Visitante | `index.html` / marketplace | Explorar catálogo público y detalle; debe iniciar sesión para usar carrito |

La propiedad y los permisos se comprueban en servidor. El carrito no genera pedidos, cobra pagos, reserva ni descuenta inventario.

## Datos del prototipo anterior

Al detectar los antiguos `usuarios`, `usuarioSesion`, `negocios`, `productos` o `carrito`, el navegador prepara un respaldo descargable **sin contraseñas**, fuera del modelo activo. No importa identidades ni roles manipulables al servidor. Es necesario registrar las cuentas y volver a publicar los datos pertinentes. No hay migración automática de IDs.

LocalStorage queda para carrito temporal por comprador/instancia, notificaciones entre pestañas y respaldo legado sin credenciales. La sesión usa una cookie HttpOnly; ni contraseña ni token de autenticación se guardan en LocalStorage.

## Pruebas

```bash
npm ci --prefix tests
npx --prefix tests playwright install chromium
npm test --prefix tests
```

Si Chromium ya está instalado:

```bash
CHROMIUM_PATH=/usr/bin/chromium npm test --prefix tests
```

API sin navegador: `npm test --prefix backend`.

Resultado final: **52 pruebas aprobadas, 0 fallidas, 0 omitidas**. Incluyen API real, Chromium, permisos, sesiones, CRUD, carrito, imágenes, fallos de red, CSP, enlaces y responsive a 360/768/1024/1440 px. Detalle en [TESTING](docs/TESTING.md).

## Estructura

```text
backend/
  config/ controllers/ data/ middleware/ repositories/ routes/ services/ utils/
  app.js
frontend/
  páginas HTML, css/estilos.css, js/
tests/
  api.test.cjs, phase1.test.cjs, structure.test.cjs
docs/
  arquitectura, API, roles, UI, pruebas, seguridad y evolución
```

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md) y [contrato HTTP](docs/API.md).
- [Roles](docs/ROLES.md) y [seguridad y limitaciones](docs/SECURITY.md).
- [UX/UI](docs/UX_UI.md), [preparación MySQL](docs/MYSQL_READY.md) y [pruebas](docs/TESTING.md).
- [Cambios y justificación por fase](docs/CHANGELOG.md).
- [Archivos, diff y estado Git](docs/REVISION_GIT.md).

No se realizó commit ni push como parte de esta ejecución.
