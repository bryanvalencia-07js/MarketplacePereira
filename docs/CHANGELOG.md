# Cambios y justificación

## Alcance de la entrega

Se ejecutaron consecutivamente las Fases **2 a 13** del [roadmap final](ROADMAP.md), sobre la Fase 1 ya aprobada. No se volvió a implementar esa fase desde cero. El [roadmap inicial](ROADMAP_INICIAL.md) y [su entrega histórica](FASE_1.md) se conservan como antecedentes.

El árbol de trabajo ya contenía los cambios de Fase 1 sin commit; se preservaron y evolucionaron. El diff Git acumulado compara contra `1d284a11d43becb5b0575db53bf52c650e041fa9`, por lo que incluye esa base no confirmada y el trabajo posterior. No se modificó historial ni se hicieron commit/push.

## Por fase

| Fase | Implementación | Justificación |
|---|---|---|
| 2 · UI/UX | Tokens centrales amarillo/rojo/crema/carbón, componentes, estados, foco y responsive | Dar identidad consistente sin frameworks ni saturación |
| 3 · Landing | Narrativa, ilustración CSS, IntersectionObserver, reduced motion y datos reales | Comunicar propósito y conectar historia con catálogo existente |
| 4 · Comprador | Tarjetas compartidas, búsqueda por descripción/comercio, categorías, limpiar, recientes/populares, detalle y modal de carrito | Descubrimiento y navegación coherentes con disponibilidad actual |
| 5 · Comerciante | KPIs, completitud, accesos, preview público y CRUD con imágenes aisladas | Administrar su presencia desde un mismo portal |
| 6 · Administrador | KPIs, alertas, actividad y gestión global de productos; negocios con dueño real | Supervisar el ecosistema sin bibliotecas de charts |
| 7 · Backend | Routes/controllers/services/repositories/middleware/config/utils y composición inyectable | Separar HTTP, reglas y persistencia; facilitar pruebas y sustitución de almacenamiento |
| 8 · API | Auth, CRUD completo, filtros, timestamps, resumen público, visitas y respuestas normalizadas | Conectar datos reales y retirar CRUD independientes |
| 9 · Autorización | Scrypt, cookie HttpOnly, CSRF, origen, rate limits y propiedad en servidor | No depender de roles/IDs manipulables en navegador |
| 10 · Integración | api.js central, módulos con fetch y sesión del servidor; respaldo legado sin credenciales | Migrar entidades principales sin importar permisos inseguros del prototipo |
| 11 · MySQL-ready | Contratos async validados e inyección de repositorios | Sustituir el adaptador sin cambiar API/frontend, sin instalar SQL u ORM |
| 12 · Calidad | Pruebas HTTP/Chromium/estructura, consola/CSP, red, tipos inválidos, centavos y mitigaciones de dependencias | Verificar comportamiento y corregir regresiones reales |
| 13 · Documentación | README, arquitectura, API, roles, UI, SQL-ready, pruebas, seguridad e inventario Git | Entrega sustentable y límites explícitos después de implementación/validación |

## Archivos y componentes relevantes

El inventario exacto creado/modificado/eliminado se encuentra en [REVISION_GIT](REVISION_GIT.md), junto con las salidas completas solicitadas.

- **Backend nuevo:** services de usuario/negocio/producto/auth/resumen público, repositorios y contrato, middleware de seguridad/errores, controllers genérico/auth/público, validadores, hashing, configuración y estado inicial vacío.
- **Backend modificado:** app, rutas/controlador de usuarios, scripts/lockfile. Se eliminó CORS porque frontend y API comparten origen.
- **Frontend nuevo:** api, bootstrap de eventos/módulos, UI, landing, dashboard, imágenes, respaldo legado y gestión global `productos.html`. `estado-local.js` conserva presentación/carrito temporal y ahora valida catálogo con API.
- **Frontend actualizado:** páginas y scripts de login, registro, usuarios, negocios, comercio, productos, marketplace, detalle y carrito; CSS compartido.
- **Tests:** suite API, regresiones Chromium migradas a HTTP real y comprobaciones de estructura; Playwright solo en desarrollo.
- **Eliminación justificada:** `backend/data/usuarios.js`, antiguo arreglo de demostración sin autenticación, sustituido por estado inicial vacío y repositorios.
- **Renombre:** `README.MD` → `README.md`, para normalizar la entrada de documentación solicitada. No se descartó su propósito.

## Validación final

**52/52 pruebas aprobadas**, sin omisiones: 22 API, 27 Chromium y 3 estructura. Sintaxis correcta en 40 scripts y `git diff --check` limpio. Se comprobaron también respuestas HTTP de salud, landing, catálogo, sesión, resumen y rechazo de usuarios anónimos en la instancia actual.

Las 19 pruebas anteriores pasaron tras la fase visual. La suite posterior usa Express real y cookies, en vez de autenticar fixtures mediante LocalStorage. Se conservaron los comportamientos correctos y se añadieron pruebas de autorización, concurrencia, red caída, CSRF/CSP, credenciales, precios decimales y almacenamiento temporal.

## Entorno reutilizable

Se actualizaron `install_script` y `start_skill` en el borrador del entorno de nube: Node 24, `npm ci` para backend/tests y un solo servidor Express para HTML y API. Se detuvo únicamente el servidor Python estático que el asistente había iniciado anteriormente; el servidor Express se reutilizó y se verificó por HTTP.

El guardado del borrador fue confirmado. No publica el entorno ni confirma su restauración en una tarea nueva. Para activar esa configuración, revisar/guardar y publicar el entorno desde sus ajustes cuando corresponda. No se cambiaron repositorios, red ni requisitos de credenciales en ese borrador.

## Pendientes reales

- Persistencia y sesiones siguen en memoria, por diseño. Reiniciar elimina datos y sesiones; no es almacenamiento duradero ni multiinstancia.
- El Administrador inicial requiere `ADMIN_EMAIL` y `ADMIN_PASSWORD` configurados de forma privada. No hay contraseña predeterminada ni se crearon credenciales reales para revisión.
- La auditoría npm mantiene tres hallazgos transitivos sin parche publicado. Se bloquearon rutas de uso afectadas, pero las mitigaciones no eliminan avisos. Ver [SECURITY](SECURITY.md).
- El despliegue externo requiere HTTPS/configuración de producción y revisión de esos avisos. No se afirma certificación de seguridad/WCAG.

MySQL, pagos y pedidos están expresamente fuera del alcance del roadmap ejecutado, no son funcionalidades simuladas o presentadas como terminadas.
