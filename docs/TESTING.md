# Pruebas y validación final

## Resultado

**52 pruebas aprobadas, 0 fallidas, 0 omitidas** en la última ejecución completa. Duración aproximada: 46 segundos. Node 24.19.0, npm 11.9.0, Playwright 1.62.1 y Chromium del sistema.

También pasaron sintaxis de los **40 scripts** frontend/backend y `git diff --check`. La comprobación HTTP de la instancia actual respondió correctamente a `/api/salud`; la suite usa sus propias instancias aisladas de Express.

El audit de dependencias **no pasa**: quedan avisos transitivos sin parche publicado. Se documentan y mitigan las rutas usadas en [SECURITY](SECURITY.md); no se suman como pruebas aprobadas.

## Repetir

```bash
npm ci --prefix backend
npm ci --prefix tests
npx --prefix tests playwright install chromium
npm test --prefix tests
```

Con Chromium instalado en Linux:

```bash
CHROMIUM_PATH=/usr/bin/chromium npm test --prefix tests
```

Por grupo:

```bash
npm test --prefix backend
npm run test:api --prefix tests
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser --prefix tests
node --test tests/structure.test.cjs
```

El runner abre puertos efímeros y no requiere un servidor ya iniciado. Los usuarios/passwords de fixtures son ficticios, exclusivos de pruebas; no se crean en el proceso de desarrollo del usuario. El navegador usa contextos separados y las fuentes externas se interceptan para independizar el resultado de Google Fonts.

## Cobertura

### API: 22 pruebas

- Registro, login, hash, cookie, sesión, logout y redacción de credenciales.
- Rechazo de autoasignación de admin, campos protegidos y contraseña corta.
- 401/403 por rol y propietario; CSRF y origen.
- CRUD/filtros, timestamps, relaciones, visibilidad y visitas.
- Último administrador, correo único, revocación y dueño vigente.
- Concurrencia real de correo/comercio, sin duplicados.
- Stock entero, precio, imagen real, IDs y recursos inexistentes.
- Cabeceras, JSON inválido, límite de body y cuerpos comprimidos.
- Expiración determinista, tokens distintos, rate limit de login.
- Repositorios por contrato, copias, IDs monotónicos y error interno sin filtración.

### Chromium: 27 pruebas

El archivo `phase1.test.cjs` conserva las regresiones funcionales de Fase 1 y las adapta al servidor real. Ya no usa identidades manipuladas de LocalStorage como autenticación.

- Login real de cada rol, destinos y ausencia de credenciales persistidas en cliente.
- Carga condicional de módulos, sesión inactiva y logout entre pestañas.
- Módulos/KPIs del administrador y creación de comercio por su dueño.
- CRUD de productos, imagen conservada/reemplazada, compresión y error de imagen.
- Fallo HTTP de guardado sin éxito falso ni pérdida del formulario.
- Catálogo, filtros combinados, limpiar, populares y recientes.
- Detalle/vendedor/visita/cantidades y contador global.
- Inactivos, huérfanos, agotados e ID inválido.
- Carrito por usuario, cantidades, stock, borrar, vaciar/cancelar y totales con centavos.
- Red caída o JSON corrupto sin borrado destructivo.
- Escape de HTML, respaldo legado sin credenciales y registro por HTTP.
- Landing con datos reales y reduced motion; preview público sin permisos de compra.
- Loading visible y recuperación tras fallo de bootstrap.
- Escape/foco de modal y separación de carritos entre instancias del backend.
- Las doce páginas públicas y por rol a 360/768/1024/1440 px, con carrito poblado, sin overflow.
- Consola sin excepciones ni violaciones CSP; recursos locales sin fallos. Los errores HTTP provocados deliberadamente se verifican por su estado/feedback, no se confunden con éxito.

### Estructura: 3 pruebas

Enlaces/anclas/recursos locales existentes, labels asociados a IDs, ausencia de scripts/handlers inline y un único root de variables con reduced motion.

## Proceso y regresiones corregidas

Las 19 pruebas de Fase 1 pasaron también tras las mejoras visuales, antes de migrar la persistencia. Después se ampliaron para Express/cookies en lugar de simular credenciales locales.

Durante integración se corrigió la preparación de una prueba de error HTTP que se detenía antes por falta de imagen; ahora usa una imagen válida y prueba el fallo de servidor. También se aisló la navegación del fixture antes de restablecer el servidor para evitar carreras de una página anterior. No se omitieron tests ni se desactivaron aserciones.

Las capturas revisadas están en `/tmp/reactiva-landing-desktop.png` y `/tmp/reactiva-marketplace-mobile.png`, generadas por la suite y fuera de Git. La primera valida composición de escritorio y la segunda la jerarquía móvil, además de las comprobaciones programáticas de ancho.

## Límites

No se probaron MySQL, pagos, multiinstancia ni recuperación duradera: no existen en esta fase. No hay compilación frontend porque se conserva JavaScript nativo. No se afirma una auditoría WCAG, pentest completo ni validación en Safari/Firefox. Verificados los objetivos requeridos, no se ampliaron suites ajenas al proyecto.
