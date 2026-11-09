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

En una validación anterior, el audit completo de backend reportó dos avisos moderados de desarrollo, en `minimatch` y su dependiente `nodemon`: [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). La corrección que propone npm requiere forzar un cambio de la dependencia nodemon; no se aplicó automáticamente. nodemon solo participa en `npm run dev`, no en `npm start`. Ese audit completo retornó fallo. PR6 vuelve a ejecutar el audit de producción solicitado; no afirma un resultado nuevo del audit de desarrollo. Estos resultados son una observación de la ejecución, no una garantía permanente del registro.

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

## Cobertura actual

| Grupo                           | Casos | Comportamiento comprobado                                                                                                                                                       |
| ------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API existente con memory        |    22 | Sesiones, hashing, CSRF/origen/CSP, roles, ownership, validación, integridad, rate limits y errores                                                                             |
| Adaptador MySQL simulado/config |     7 | Contrato, parámetros/DTO, bloqueo, BEGIN/COMMIT/ROLLBACK/release y errores seguros                                                                                              |
| Normalización memory/API        |     5 | Catálogos/FK, roles con IDs distintos, categorías activas, atributos y contador conservados                                                                                     |
| Chromium anterior               |    49 | Flujos de tres roles, catálogo/carrito, red, XSS, identidad/storytelling, teclado, responsive y axe                                                                             |
| Estructura                      |     3 | Recursos/enlaces locales, labels, CSP y CSS modular                                                                                                                             |
| Dominio PR6 memory              |    12 | Servicio/categoría/propiedad, horarios válidos/no superpuestos, slots/UTC, fechas, cupos concurrentes 1/3, cambios/cancelaciones/historial, cascadas y favoritos propios únicos |
| API PR6                         |     4 | Catálogo/horarios/disponibilidad, CRUD/roles/CSRF, carreras HTTP de reserva, gestión aislada y favoritos                                                                        |
| Chromium PR6                    |     7 | Reserva/cancelación reales, CRUD/horarios/recepción, favoritos API, protección de páginas, errores de red/409, responsive/axe y gestión Admin                                   |
| MySQL real (comando separado)   |    18 | 11 anteriores + 7 PR6: 001→002→003 con datos, esquema/checksums, PK/FK/UNIQUE/CHECK, dos pools/capacidad 1 y 3, rollback, cascadas, categorías y aislamiento                    |

La suite independiente de MySQL contiene 109 casos; el comando backend contiene 45 y el navegador 56 (subconjuntos de la suite general, no deben sumarse como pruebas distintas). Se conservan todas las aserciones anteriores. Los fixtures SQL se limpian en orden hijo→padre, incluyendo las nuevas asociaciones, para permitir repetir la suite sobre la misma base `_test`.

`UI_SCREENSHOTS=/ruta/absoluta npm test --prefix tests` guarda 72 capturas: 18 páginas × 360/768/1024/1440, incluidas las 24 de PR6. Axe A/AA revisa 18 páginas × 360/1440, 36 combinaciones, con datos reales de prueba; PR6 incluye un slot ocupado, reservas y favoritos. La prueba nueva comprueba también que la marca y el menú no se superpongan en móvil. Estas comprobaciones automáticas no equivalen a certificación WCAG ni pruebas en dispositivos físicos. Se revisaron visualmente las capturas nuevas y se corrigió la cabecera móvil sin modificar CSS global, fotografías ni narrativa.

CI mantiene Node 24, generación/comparación de assets, sintaxis, audit, memory/navegador y MySQL 8.4. Los scripts de tests incluyen PR6; no se retiraron jobs ni comprobaciones. El job SQL utiliza una base exclusiva y ejecuta secuencialmente los archivos de integración. Verificar el resultado de Actions del commit revisado antes de fusionar.

## Validación de PR6

PR5 (#5) se confirmó fusionado antes de modificar archivos. Base `42f17d4be19bd2362514e47718e9d06c01682359`; referencias y main actualizados, migración 002 presente. Baseline local: **86/86** memory/general y **11/11** MySQL, sin fallos ni omisiones. Rama exclusiva `feat/services-reservations-favorites`.

Se verificaron ciclos rojo→verde para ausencia de módulos, interfaces nuevas y una frontera temporal: el instante debe seguir siendo futuro después de consultar disponibilidad y antes de insertar. La creación comprueba cupos bajo el bloqueo, nunca mediante un SELECT liberado seguido de INSERT. Capacidad 1 con dos solicitudes simultáneas: exactamente una Confirmada y un 409; capacidad 3 con cuatro: tres Confirmadas y un 409. La prueba SQL alterna dos pools independientes; se cuentan las filas persistidas. Las ventanas cambiadas conservan ocupación de las reservas anteriores mediante intersección/pico de intervalos, sin crear Disponibilidad.

Validación local con Node 24.22.2, Chrome del sistema y MySQL 8.0.46 aislado: suite general **109/109**, backend **45/45**, MySQL **18/18**, navegador **56** incluido en la suite general, sin omisiones. Sintaxis **76/76** archivos JS/CJS; assets regenerados reproduciblemente; `git diff --check` correcto; audit `--omit=dev --prefix backend`: **0 vulnerabilidades**. Arranque CLI y cierre SIGTERM correctos en memory y mysql, con ocho rutas HTTP 200 y favorito protegido 401 por modo. No hay dependencias nuevas del proyecto.

Las ejecuciones de agenda/API/MySQL con `TZ=Asia/Tokyo` y de la suite general con `TZ=Pacific/Honolulu` conservan instantes UTC y horarios de America/Bogota. 001 y 002 permanecen intactas; solo 003 crea las cuatro tablas. La prueba de actualización compara todas las filas y columnas de PR5 y valida las tres versiones/checksums. Drift de 003 o intento incompleto bloquea migración/arranque según corresponda.

Las protecciones existentes de sesiones HttpOnly/SameSite, scrypt, origen/CSRF, CSP, límites, ownership, bloqueo de escrituras y SQL parametrizado se conservan. Solo Comprador crea reserva/favorito y usuarioId se toma de sesión; Comerciante no consulta/cancela reservas ni modifica servicios/horarios ajenos. El frontend protege navegación y el servidor aplica permisos. Favoritos de productos desactivados conservan asociación con producto null; el borrado físico de dependientes usa CASCADE documentado. Reserva y servicio con historial se protegen mediante RESTRICT y conflictos de dominio.

Deuda: sesiones/rate limits siguen por proceso; el bloqueo global serializa escrituras y los listados de agenda todavía no tienen paginación/consultas SQL específicas. No se protege a escritores SQL externos que ignoren el bloqueo. Memory no ofrece rollback de callbacks arbitrarios ni persistencia entre reinicios. Ventanas de horario son intradía, sin horario nocturno que cruce medianoche. Safari/Firefox, dispositivos físicos y revisión humana quedan pendientes. Pedido y Detalle_Pedido son exclusivamente PR7; no hay pagos, facturas, inventario, checkout ni carrito persistente.

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

| Landing / mediana de 3 ejecuciones |       Antes |     Después |
| ---------------------------------- | ----------: | ----------: |
| LCP, 360 px                        |     1236 ms |      476 ms |
| LCP, 1440 px                       |      556 ms |      484 ms |
| CLS, 360 px                        |           0 |           0 |
| CLS, 1440 px                       |    0.000334 |    0.000334 |
| Transferencia de recursos, 360 px  | 1 348 906 B | 1 085 324 B |
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
