# Reactiva Pereira

Marketplace universitario para visibilizar comercios de Pereira, descubrir productos locales y apoyar la reactivación de la ciudad. Conserva las experiencias de Administrador, Comerciante, Comprador y visitante, el Coverflow 3D con SVG y el storytelling existente.

## Stack y estado

HTML5, CSS3 y JavaScript nativo; Node.js 24, Express 5 y `mysql2/promise`. API REST del mismo origen, sin ORM ni frameworks frontend/CSS.

```text
Browser → fetch → Express API → Controller → Service → Repository → Memory / MySQL
```

Usuarios, negocios y productos pueden persistir en MySQL. `DATA_SOURCE=memory` sigue siendo el valor predeterminado y permite ejecutar las pruebas sin una base. Sesiones y rate limits permanecen en memoria del proceso. El carrito es temporal del navegador: no hay pedidos, pagos, reservas ni descuento de stock.

## Instalar y ejecutar

Con Node 24 (ver `.nvmrc`):

```bash
npm ci --prefix backend
cp backend/.env.example backend/.env
npm start --prefix backend
```

Abrir [http://localhost:3000](http://localhost:3000). Express sirve el frontend y `/api`; no hay compilación frontend ni servidor estático separado. `PORT` cambia el puerto y `npm run dev --prefix backend` activa nodemon.

### Persistencia

- `DATA_SOURCE=memory`: no requiere DB; cada reinicio borra entidades.
- `DATA_SOURCE=mysql`: configurar `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` en `backend/.env` o en el entorno. Crear la base/usuario y ejecutar las migraciones **antes** del servidor:

```bash
npm run db:migrate --prefix backend
npm start --prefix backend
```

MySQL >= 8.0.16; se recomienda 8.4 LTS. Instrucciones, permisos, modelo y recuperación de migraciones en [DATABASE](docs/DATABASE.md). El servidor falla si MySQL no está preparado; no sustituye silenciosamente la base por memoria. Las migraciones son explícitas, no se ejecutan al arrancar.

### Cuentas

No se crean usuarios demo ni contraseñas predeterminadas. El registro público crea Comerciantes o Compradores. Para crear el primer Administrador, configurar juntas `ADMIN_EMAIL` y `ADMIN_PASSWORD` (12–128 caracteres); se crea solo si no existe ningún Administrador. En MySQL queda persistido; las variables no cambian la contraseña de una cuenta ya existente. Retirar las variables de bootstrap tras la creación. Nunca incorporar `.env` ni secretos a Git.

## Uso y roles

| Rol | Entrada | Capacidades |
|---|---|---|
| Visitante | `index.html` / `marketplace.html` | Catálogo, comercios y detalle públicos |
| Comprador | `marketplace.html` | Catálogo y carrito temporal propio |
| Comerciante | `mi-negocio.html` | Un comercio propio, indicadores, preview y sus productos |
| Administrador | `dashboard.html` | KPIs, alertas y gestión de usuarios, negocios y productos |

La API comprueba roles y propiedad en servidor. La autenticación usa cookies HttpOnly; nunca LocalStorage. Los datos del prototipo antiguo se ofrecen como respaldo descargable sin contraseñas, sin importar identidades o permisos al servidor; los comercios/productos se deben volver a publicar. No hay importación automática de IDs ni migración automática desde memory a MySQL.

## Comandos de calidad

```bash
npm ci --prefix tests
npx --prefix tests playwright install chromium
npm test --prefix tests
npm test --prefix backend
npm audit --omit=dev --prefix backend
```

Con Chrome/Chromium instalado: `CHROMIUM_PATH=/ruta/al/chromium npm test --prefix tests`.

La suite normal usa memory y no necesita MySQL. La integración real se ejecuta separadamente con `DATA_SOURCE=mysql` y una `DB_NAME` terminada en `_test`: **borra las entidades de esa base de prueba**.

```bash
npm run test:mysql --prefix tests
```

Cobertura, controles, CI y límites: [SECURITY_TESTING](docs/SECURITY_TESTING.md).

## Estructura y documentación

```text
backend/
  config/ controllers/ routes/ services/ middleware/ utils/
  repositories/           # contrato, memory y mysql
  db/                    # pool, runner y migraciones SQL
frontend/                # HTML, CSS, módulos JS y assets propios
tests/                   # API, navegador, estructura y persistencia
.github/workflows/       # CI memory + MySQL
```

- [AGENTS](AGENTS.md): instrucciones de trabajo y ciclos XP.
- [ARCHITECTURE](docs/ARCHITECTURE.md): flujo, responsabilidades, roles, UI y estado local.
- [API](docs/API.md): endpoints, contratos y errores.
- [DATABASE](docs/DATABASE.md): modelo, restricciones, transacciones y operación.
- [SECURITY_TESTING](docs/SECURITY_TESTING.md): seguridad, pruebas y limitaciones.

Para exposición externa: HTTPS, `NODE_ENV=production`, `APP_ORIGIN` con el origen exacto sin ruta y revisión de los límites documentados. No se presenta como sistema de pagos ni despliegue multiinstancia preparado para producción.
