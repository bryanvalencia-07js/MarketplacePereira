# Seguridad y pruebas

## Controles efectivos

- Scrypt con sal aleatoria de 16 bytes, clave de 64 bytes, N=32768, r=8, p=3 y comparación constante. El formato guarda parámetros para evolución. Contraseñas de 12–128 caracteres; API y respaldo legado no exponen contraseña/hash.
- Sesiones opacas aleatorias de 32 bytes, indexadas por SHA-256 en memoria del servidor, expiración absoluta de ocho horas y revocación por cambio real de rol/estado/contraseña o eliminación.
- Cookie HttpOnly, SameSite Strict, Path=/, Secure en producción. Sin autenticación en LocalStorage; CSRF de página en memoria.
- CSRF en CRUD y logout; origen/Fetch Metadata también en login, registro y visitas. Frontend y API comparten origen; no hay CORS abierto.
- Roles y propiedad en servidor, campos permitidos y validaciones de tipos/límites. No hay autorregistro de Administrador ni cuentas demo automáticas; bootstrap privado por entorno.
- CSP estricta sin `unsafe-inline`/`unsafe-eval`; scripts/eventos externos y escape de texto en tarjetas/listados. Las Data URLs se limitan a imágenes admitidas con validación básica de firma.
- Cabeceras nosniff, frames denegados, referrer same-origin y permisos de cámara/micrófono/geolocalización deshabilitados. HSTS en producción.
- JSON máximo 2 MiB, imágenes máximo 1 800 000 caracteres. Content-Encoding distinto de identity se rechaza antes del parser; `inflate:false` se conserva. Query parser `simple`.
- Rate limits: API 300/IP/min; auth 30/IP/15 min; login 12/correo/15 min; visitas 40/IP/min. Mapas acotados con expiración.
- Request timeout 30 segundos y headers 15 segundos. Errores internos sin stack, credenciales, SQL ni datos del driver.
- MySQL: consultas parametrizadas, identificadores cerrados, pool limitado, UTC/modo estricto, PK/FK/UNIQUE/CHECK, transacciones con rollback y cierre de conexiones. Ver [DATABASE](DATABASE.md).

## Dependencias

Consultar siempre el estado actual:

```bash
npm audit --omit=dev --prefix backend
npm audit --prefix backend
npm audit --prefix tests
```

En la validación de esta fundación se actualizaron `body-parser` 2.3.0 → 2.4.0 y `qs` 6.16.0 → 6.17.1 dentro de los rangos existentes, sin `--force` ni overrides. El audit de producción quedó sin avisos; tests también sin avisos. Se conservan el rechazo de compresión y el parser simple aunque esas dependencias ya estén corregidas.

El audit completo de backend mantiene dos avisos moderados de desarrollo, en `minimatch` y su dependiente `nodemon`: [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). La corrección que propone npm requiere forzar un cambio de la dependencia nodemon; no se aplicó automáticamente. nodemon solo participa en `npm run dev`, no en `npm start`. El audit completo retorna fallo y no se presenta como aprobado. Estos resultados son una observación de la ejecución, no una garantía permanente del registro.

## Ejecución reproducible

Node 24, indicado en `.nvmrc` y `engines`:

```bash
npm ci
npm ci --prefix backend
npm ci --prefix tests
npx --prefix tests playwright install chromium
npm test --prefix tests
```

Con navegador existente: `CHROMIUM_PATH=/ruta/al/chromium npm test --prefix tests`.

```bash
npm test --prefix backend
npm run test:api --prefix tests
npm run test:browser --prefix tests
node --test tests/structure.test.cjs
node --test tests/mysql.test.cjs
```

La suite normal usa repositorios memory aislados, puertos efímeros y fixtures ficticios. No lee credenciales de una base ni necesita un servidor ya iniciado. Las fuentes e iconos se sirven localmente. Chromium conserva la interceptación de fuentes externas como protección contra dependencias de red accidentales. Se requiere un entorno que permita puertos locales y lanzar el navegador.

Para MySQL, crear una base dedicada cuyo nombre termine en `_test`, completar las variables DB y `DATA_SOURCE=mysql` en `backend/.env` o en el entorno:

```bash
npm run test:mysql --prefix tests
```

Esta suite aplica/verifica migraciones y **borra las entidades de esa base antes de cada prueba**. Rechaza otro modo o un nombre sin ese sufijo. No ejecutarla contra datos reales ni simultáneamente con otras suites que usen la misma base. No omite pruebas SQL si falta el entorno: el comando separado falla con instrucciones claras.

## Cobertura

| Grupo | Casos | Comportamiento comprobado |
|---|---:|---|
| API real con memory | 22 | Registro/login/hash/cookies, CSRF/origen/CSP, roles/propiedad, CRUD/filtros/fechas, unicidad concurrente, validación, revocación, último admin, rate limits, errores y compresión |
| Chromium | 49 | Tres roles y visitante; formularios/CRUD/imágenes; catálogo/detalle/carrito; red caída, XSS, legado sin credenciales, sesión entre pestañas; loading/feedback; modal/foco; Coverflow/SVG/selección por teclado/limpiar; responsive |
| Estructura | 3 | Enlaces/anclas/recursos, labels, scripts compatibles con CSP, variables y reduced motion |
| Adaptador MySQL simulado/config | 7 | Contrato, parámetros y DTOs; BEGIN/COMMIT/ROLLBACK/release; fallo de commit/rollback; aislamiento de contexto y errores seguros |
| Normalización memory/API | 5 | FK/DTOs, hashes y 37→38 visitas, catálogo activo, rechazo de categorías inexistentes/inactivas, campos opcionales, privilegios y roles con IDs distintos |
| MySQL real (separado) | 11 | Migración repetible y detección de drift/fallo parcial; CRUD/decimales/fechas; UNIQUE/FK/CHECK/rol; rollback de varias entidades; concurrencia entre pools; visitas/último admin; API/CSRF/cookie y persistencia al recrear aplicación |

La suite independiente de MySQL contiene 86 casos; la modernización añade regresiones de loading/restauración, validación y contraseña, menú/foco, skeletons, toast/SVG, teclado del Coverflow, indicadores desplegables, movimiento reducido y limpieza de ScrollTrigger, recuperación HTTP y acciones móviles. Axe revisa las doce páginas a 360 y 1440 px, incluido el carrito con productos, con reglas WCAG A/AA; esta comprobación automática no equivale a una certificación. La integración real agrega 11. La fase visual añade seis regresiones: duración y sesión de apertura; descarte por interacción; clic y cambio a reduced motion; preferencia reducida y almacenamiento denegado; narrativa sin JavaScript; y centrado del Coverflow sin salto vertical. Se mantienen todas las aserciones previas y se amplía el fixture de axe para incluir el resumen con productos. No se modificaron aserciones existentes para esconder regresiones. El baseline inicial tenía cuatro fallos por cuentas demo introducidas automáticamente; al retirar ese arranque inseguro, las 52 pruebas originales pasaron sin modificar sus expectativas.

En la fase técnica anterior, la depuración CSS comprobó referencias en HTML, templates, scripts, clases dinámicas, selectores, estados y tests. Además de las regresiones, se compararon estilos calculados en 12 páginas × 4 anchos (360/768/1024/1440), con reduced motion: sin diferencias en las propiedades comparadas. Esta comparación puntual excluye propiedades temporales de animación y no sustituye una auditoría visual de todas las posiciones de scroll o estados hover.

La CI en `.github/workflows/ci.yml` configura Node 24, regeneración y comparación de assets, suite memory/navegador y una integración separada con MySQL 8.4. `UI_SCREENSHOTS=../test-artifacts npm test --prefix tests` guarda 48 capturas (12 páginas × 360/768/1024/1440); Actions las publica como artefacto `responsive-chromium`. La ejecución local se verificó con Node 24.22.2, Playwright 1.62.1, Chrome del sistema y MySQL 8.0.46. La existencia del workflow no prueba una ejecución remota exitosa; comprobar el resultado de Actions en el PR.

## Validación de PR5

Base actualizada: `bf8e12f21a10b2818e491e29d0e41ee891549d74`, después de confirmar el merge del PR visual #4 y actualizar referencias/main. Baseline en Node 24.22.2: **78/78** independientes de MySQL y **7/7** MySQL real, sin omisiones. Se conservan las aserciones anteriores.

Las regresiones nuevas se ejecutaron primero en rojo: faltaban FK/catálogo/visitas y los campos/carga de categorías en frontend. Por bloques: modelo y backend **82/82** con las cuatro pruebas iniciales de normalización y **7/7** SQL existentes; se añadió después el caso de roles con IDs diferentes. La suite completa con frontend y cinco casos de normalización queda en **86/86**, sin omisiones. La suite MySQL normalizada queda en **11/11** (7 existentes + 4 nuevos), contra MySQL 8.0.46 en una instancia/base dedicada nueva, sin datos reales.

Validaciones finales adicionales: backend/adaptador simulado **29/29**; **49** casos de navegador dentro de la suite completa, **48** capturas responsive y axe A/AA sin infracciones detectadas en 12 vistas × 360/1440. Sintaxis **58/58** archivos JS/CJS, assets regenerados sin diferencias, `git diff --check` correcto. El programa principal arranca, sirve salud/frontend/categorías y cierra con SIGTERM tanto en `memory` como en `mysql`.

Los cuatro casos SQL nuevos reconstruyen exclusivamente la base `_test` desde 001, crean tres usuarios con hashes y estados distintos, un negocio y dos productos históricos con 37/0 visitas. Comparan cada atributo preservado, FK/categorías normalizadas, ausencia de información inventada, UNIQUE/FK/CHECK, InnoDB/utf8mb4, catálogos activos y checksum de ambas versiones. Una categoría histórica `Todas` aborta antes de retirar datos y deja el intento incompleto visible. Se conserva la verificación existente de rollback, concurrencia, cookies/CSRF y persistencia al recrear aplicación/pools.

`001` conserva su SHA-256. La normalización no incorpora dependencias al proyecto ni cambia CSS, fuentes, imágenes, SVG o storytelling. El frontend conserva los controles de permisos y el backend rechaza IDs de rol y contadores enviados por HTTP. El catálogo público devuelve solo Activas y no ofrece escrituras. Audit de producción en esta ejecución: **0 vulnerabilidades**. No se afirma un resultado actualizado del audit completo de desarrollo: las observaciones de la sección de dependencias corresponden a la fase anterior.

## Validación de la dirección visual

Baseline de `main` (`0e0f1c6`): 72/72 casos, 48 capturas y axe sin infracciones detectadas. La nueva apertura tuvo pruebas fallando por ausencia del elemento antes de incorporarla; el salto vertical del Coverflow se reprodujo con una regresión que observó 209 px de scroll al iniciar. La primera revisión completa detectó contraste en números narrativos y etiquetas atenuadas del carrusel; se corrigieron colores y opacidad sin omitir reglas de axe.

La revisión visual usa los mismos fixtures ficticios (no son datos de producción) en las doce vistas y cuatro anchos, con reduced motion para comparar estados estables. Para las capturas completas se espera a fuentes e imágenes diferidas, se vuelve al inicio y se fija el límite del documento; esta preparación no se usa para medir el arranque. El PR adjunta comparativas antes/después, medidas locales de LCP/CLS y tamaño de recursos; estas mediciones de laboratorio no equivalen a métricas de campo. No se modifican backend, CSP, autenticación, roles ni MySQL en esta fase.

### Resultado local de la fase visual

Node 24.22.2 y Chrome del sistema: 78/78 pruebas completas; backend/adaptador simulado 29/29; MySQL 8.0.46 en base aislada nueva 7/7. Axe A/AA no detectó infracciones en las 24 combinaciones de vista/ancho verificadas; responsive generó 48 capturas sin overflow. Sintaxis válida en 53 archivos, regeneración reproducible de 10 assets y audit de producción con 0 vulnerabilidades detectadas.

| Landing / mediana de 3 ejecuciones | Antes | Después |
|---|---:|---:|
| LCP, 360 px | 1236 ms | 476 ms |
| LCP, 1440 px | 556 ms | 484 ms |
| CLS, 360 px | 0 | 0 |
| CLS, 1440 px | 0.000334 | 0.000334 |
| Transferencia de recursos, 360 px | 1 348 906 B | 1 085 324 B |
| Transferencia de recursos, 1440 px | 1 467 546 B | 1 203 964 B |

Medición de laboratorio en Chrome local: caché fría, CPU 4×, red 10 Mbit/s, latencia 40 ms y ventana de observación de 5,5 s; movimiento permitido y apertura incluida. La transferencia cuenta recursos observados en esa ventana, no el peso total del sitio. El arranque mantiene 0 triggers en móvil y 4 en escritorio. Datos completos y tamaños del bundle en [visual](visual/); [galería offline](visual/index.html), con 48 pares antes/después. Las PNG originales se entregan como evidencia externa; el repositorio conserva WebP de las mismas capturas para reducir su tamaño.

Deuda de validación: Safari/Firefox, dispositivos físicos y métricas de campo (incluido INP) siguen pendientes. Las imágenes de producto dependen del catálogo del comerciante; los fixtures de comparación usan explícitamente el estado sin fotografía. La revisión humana de dirección de arte queda pendiente en el PR. No se implementan checkout, pagos ni infraestructura fuera del alcance visual.

## Método XP

Baseline → prueba de comportamiento/regresión → cambio pequeño → prueba relacionada → refactor con comportamiento probado → suite completa. La caracterización del Coverflow detectó que limpiar filtros no restauraba `aria-pressed` ni la clase activa por usar un selector anterior; se corrigió la referencia conservando el componente. Las pruebas del adaptador se escribieron antes de implementarlo y la integración real descubrió una incompatibilidad de collation del handshake, corregida y verificada contra el servidor.

Cambios posteriores deben conservar estos controles y contratos. No generar documentos por cada paso: el historial y el PR registran los cambios; este documento mantiene cómo verificar el sistema.

## Límites y operación

- Con memory, reiniciar borra entidades. Con MySQL persisten entidades, pero sesiones y rate limits continúan por proceso. Reiniciar invalida sesiones y separa carritos por instancia. No hay almacén compartido ni revocación distribuida para múltiples instancias.
- La fila de bloqueo MySQL serializa escrituras para conservar reglas existentes; limita throughput. No coordina escritores que ignoren el adaptador.
- Carrito manipulable por el usuario y temporal: no es pedido, reserva, pago ni autorización de cobro. Checkout futuro deberá revalidar precios/stock transaccionalmente en servidor.
- Imágenes verificadas por tipo/firma/tamaño, sin análisis externo ni uploads multipart. Se conserva Data URL en el DTO y MEDIUMTEXT en MySQL para no romper el flujo actual; revisar almacenamiento de objetos al escalar.
- DDL no tiene rollback global ni down destructivo automático. Preparar respaldos y restauración de operación antes de usar datos únicos. No hay importación automática de memory/LocalStorage ni recuperación de desastre certificada.
- Exposición externa: HTTPS, `NODE_ENV=production`, `APP_ORIGIN` exacto, secretos fuera de Git, usuario DB con privilegios mínimos y revisión de proxy/IP. El pool actual está destinado a DB local o red privada de confianza; TLS hacia una DB remota requiere configuración adicional antes del despliegue.
- Las pruebas no constituyen pentest, certificación WCAG, validación Safari/Firefox, prueba de alta disponibilidad ni certificación de producción. No se añaden pagos ni pedidos.
