# Arquitectura actual

## Recorrido completo

```text
Acción del usuario
→ evento DOM (sin handlers inline)
→ módulo frontend
→ api.js / fetch, cookie del mismo origen y CSRF
→ ruta Express
→ controller (HTTP / JSON)
→ service (validación, permisos y reglas)
→ repository async (memory o MySQL)
→ DTO / JSON { ok, data }
→ estado y render del DOM
```

`backend/app.js` es la raíz de composición. `createApplication({ repositories, ...config })` permite inyectar adaptadores y crear aplicaciones aisladas en pruebas. Solo abre el puerto cuando se ejecuta como programa principal. Sirve `frontend/` y `/api`; evita un despliegue CORS separado y centraliza cabeceras, límites y errores.

## Backend

| Carpeta        | Responsabilidad                                                                  |
| -------------- | -------------------------------------------------------------------------------- |
| `config`       | Puerto, origen, DATA_SOURCE, parámetros DB y bootstrap opcional de administrador |
| `routes`       | Endpoints, autenticación, roles, CSRF y límites de intentos                      |
| `controllers`  | Traducir request/response; no manipulan arreglos                                 |
| `services`     | Reglas de usuario, comercio, producto, autenticación y propiedad                 |
| `repositories` | Contrato async y adaptadores memory/MySQL                                        |
| `db`           | Pool mysql2/promise, preparación de conexiones y migraciones explícitas          |
| `data`         | Estado inicial vacío, sin cuentas predeterminadas                                |
| `middleware`   | Sesión, políticas HTTP, origen, CSRF, rate limits y errores                      |
| `utils`        | Validación, errores de dominio y hashing                                         |

Los servicios acceden a `usuario`, `negocio`, `producto`, `servicio`, `horario`, `reserva`, `favorito`, `pedido` y `detallePedido` mediante `list/find/create/update/delete`. Los repositorios devuelven copias, generan IDs monotónicos y preservan `createdAt`; `updatedAt` cambia al actualizar. No exponen la colección interna. `transaccion(callback)` serializa escrituras y comprobaciones de unicidad; memory lo hace en este proceso y MySQL entre procesos con una fila bloqueada en InnoDB. MySQL usa AsyncLocalStorage para que el callback comparta conexión sin cambiar services. IDs y fechas se normalizan en DTOs; el propietario se deriva del usuario vigente, sin columna duplicada en MySQL.

El adaptador de memoria no es almacenamiento duradero ni una implementación distribuida. Las transacciones usan copias privadas con commit/rollback y las asociaciones dependientes se eliminan explícitamente en memory. El adaptador MySQL proporciona BEGIN/COMMIT/ROLLBACK reales y libera o descarta la conexión en finally; ver [DATABASE](DATABASE.md).

## Frontend

- `api.js`: única ubicación de `fetch`, prefijo `/api`, JSON, timeout, credenciales, CSRF y errores HTTP.
- `sesion.js`: identidad obtenida del servidor, destinos por rol y logout. No decide los permisos reales del backend.
- `app-init.js`: enlaza eventos mediante atributos `data-*`, espera la sesión y carga solo el módulo permitido. Sin `eval`, scripts inline ni frameworks.
- `ui.js`: tareas con loading y restauración del botón, mensajes inline y notificaciones descartables, skeletons, validación asociada al campo, contraseña visible opcional, menú móvil con Escape, confirmación con `<dialog>`, KPIs y tarjetas escapadas. Un observador decora controles dinámicos con el sprite Lucide local.
- `estado-local.js`: IDs, precios, texto/imagen segura y reconciliación del carrito temporal con datos actuales de API.
- `imagenes.js`: lectura, preview, redimensionado y compresión local. Aislado del CRUD para reemplazarlo después por upload.
- `legado.js`: respaldo local de la etapa anterior, sin credenciales y sin importación de identidades.
- Módulos por página: landing, marketplace, detalle, carrito, comercio, productos, usuarios, negocios y dashboard.

Las páginas públicas no requieren sesión. Las páginas administrativas y de comerciante esperan la identidad del servidor antes de cargar su lógica. Las comprobaciones de rol del cliente solo mejoran la navegación; cada escritura HTTP se autoriza nuevamente en Express.

## Modelo y consistencia

La fundación PR5 contiene cinco entidades: Rol, Usuario, Categoria, Negocio y Producto. `Rol.id → Usuario.rolId`; `Categoria.id → Negocio.categoriaId` y `Producto.categoriaId`; `Usuario.id → Negocio.usuarioId`; `Negocio.id → Producto.negocioId`.

Los catálogos internos `rol` y `categoria` ofrecen `list/find`, sin CRUD HTTP de escritura. `relations.js` resuelve nombre/FK y valida categoría activa y propietario Comerciante en ambos adaptadores; MySQL mantiene SQL parametrizado/JOIN dentro del repository. Memory almacena relaciones y proyecta los mismos textos, fechas y alias de contador que MySQL. Servicios y rutas siguen validando roles, propiedad y campos HTTP; ni `idRol` ni `rolId` son entradas aceptadas para conceder permisos.

`001` describe el modelo textual anterior y permanece intacta. `002` incorpora catálogos y backfill, retira `usuarioRol` y textos duplicados, preservando datos existentes. Descripción y municipio de negocios históricos quedan nullable; ambos formularios permiten completarlos. El mapeo de nombres académicos, la ventana de migración y las restricciones están en [DATABASE](DATABASE.md). No se crean Inventario (stock pertenece a Producto) ni Sector_Comercial (se utiliza Categoria).

PR6 incorpora Servicio, Horario_Servicio, Reserva y Favorito mediante 003. Negocio/Categoria 1:N Servicio; Servicio 1:N Horario_Servicio y Reserva; Usuario 1:N Reserva; Favorito resuelve Usuario N:M Producto. PR7 completa el modelo con Pedido y Detalle_Pedido mediante 004.

`servicio.service.js`, `horario.service.js`, `reserva.service.js` y `favorito.service.js` concentran validación y propiedad; `agenda.controller.js` traduce HTTP y `agenda.routes.js` exige rol/CSRF. SQL permanece en el repository MySQL. `utils/agenda.js` calcula slots y pico de ocupación, común a ambos adaptadores. No hay tabla Disponibilidad ni fechaHoraFin persistida.

La operación reserva revalida servicio/negocio/categoría Activos, fecha futura, slot exacto y cupo dentro de `transaccion`, después de obtener el bloqueo global MySQL. Mantiene conexión hasta COMMIT/ROLLBACK. Esto impide sobreventa entre procesos/pools que usen el adaptador. Memory serializa por instancia y publica las copias solo al confirmar. GET puede quedar desactualizado; POST vuelve a comprobar. La duración no cambia con reservas Confirmadas futuras/en curso; capacidad no baja del pico reservado. Horarios pueden cambiar sin eliminar reservas, incluidas las que quedan fuera de la nueva cuadrícula. Cancelar libera cupo; Inactivo impide nuevas reservas sin borrar historial. Borrado de servicio/usuario con reservas se rechaza; favorito dependiente y horario sin historial usan CASCADE documentado en DATABASE.

Horarios representan America/Bogota y la conversión IANA no depende de TZ del host. Reserva almacena UTC DATETIME(3), mysql2 usa timezone Z y las respuestas ISO incluyen Z. Frontend formatea explícitamente en Pereira. Precio de referencia 0 significa consultar; capacidad se limita a 100. No se incorpora pago.

Un comerciante tiene como máximo un comercio. El administrador asigna un comerciante real mediante un selector, no un nombre suelto. El nombre del propietario se proyecta desde su cuenta vigente. No se elimina un usuario con comercio ni un negocio con productos; la API responde 400 y explica la acción previa necesaria. No se crean huérfanos mediante los endpoints.

Un producto público exige producto activo y comercio existente activo. Los agotados pueden verse, pero no comprarse ni generar visita. La gestión privada permite consultar inactivos al propietario/administrador. `visitas` aumenta por carga válida del detalle, no por renderizar tarjetas; no representa visitantes únicos ni ventas.

`popularidad` se conserva únicamente como alias de salida de `visitas`, para compatibilidad. El frontend consulta `/api/categorias` antes de cargar formularios/marketplace; su mapa local contiene solo correspondencias de SVG. Las categorías adicionales usan el SVG existente `otro`. Si falla el catálogo, se muestra el estado de error con reintento. `Todas` se construye como filtro de interfaz.

## Trazabilidad DER ↔ funcionalidad real

| Entidad          | Pantalla / módulo frontend                                                                                                    | Ruta y service backend                                                            | Persistencia                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------- |
| Servicio         | `servicios.html` + `servicios.js`, `detalle-servicio.html` + `detalle-servicio.js`, `mis-servicios.html` + `mis-servicios.js` | `/api/servicios`, `servicio.service.js`                                           | repos.servicio / servicios        |
| Horario_Servicio | Detalle público y sección Horarios de `mis-servicios.html`                                                                    | `/api/servicios/:id/horarios`, `/api/horarios-servicio/:id`, `horario.service.js` | repos.horario / horarios_servicio |
| Reserva          | Slots en detalle, `mis-reservas.html`, `reservas.html` + `reservas.js`                                                        | disponibilidad, `/api/reservas`, `reserva.service.js`                             | repos.reserva / reservas          |
| Favorito         | Tarjetas/detalle de producto + `favorito-acciones.js`; `favoritos.html` + `favoritos.js`                                      | `/api/favoritos`, `favorito.service.js`                                           | repos.favorito / favoritos        |

`app-init.js` registra las seis páginas y carga módulos después de la sesión; `sesion.js` añade enlaces por rol. Los nuevos módulos enlazan eventos con addEventListener; el controlador compartido de favoritos funciona también en las tarjetas creadas dinámicamente. API es la fuente de verdad, sin localStorage para reservas/favoritos. Los formularios conservan valores al fallar la red y no muestran confirmaciones simuladas. La UI usa los paneles, botones, formularios, Serif + Sans y CSS modular existentes; no sustituye fotografías, assets manuales ni storytelling.

## Sesiones y carrito

Sesiones absolutas de ocho horas en memoria; cookie opaca HttpOnly. El token se indexa por su hash en servidor y la identidad se vuelve a leer para cada request. Cambiar contraseña/rol/estado o eliminar una cuenta revoca sus sesiones.

El carrito conserva referencias `{ usuarioId, productoId, cantidad }`. Su clave incluye un identificador aleatorio de instancia del backend: un reinicio no vuelve a asociar IDs nuevos con carritos antiguos. Antes de operar se verifica la sesión y se consulta el catálogo público. Solo se ajustan entradas del comprador actual; otros compradores se preservan.

Se eliminan referencias no disponibles y cantidades inválidas, se combinan duplicados y se limita al stock. Los importes se suman en centavos y se formatean como COP con decimales cuando corresponda. Un fallo de red no se interpreta como catálogo vacío ni borra el carrito. El carrito no reserva stock; confirmar mediante `/api/pedidos` crea historial y descuenta stock en servidor.

## Roles y permisos

| Operación                                  | Visitante             | Comprador | Comerciante      | Administrador                        |
| ------------------------------------------ | --------------------- | --------- | ---------------- | ------------------------------------ |
| Landing, catálogo y comercios públicos     | Sí                    | Sí        | Sí               | Sí                                   |
| Detalle de producto público activo         | Sí                    | Sí        | Sí               | Sí                                   |
| Registrar cuenta pública                   | Comprador/Comerciante | Igual     | Igual            | Igual                                |
| Carrito temporal                           | Iniciar sesión        | Propio    | No               | No                                   |
| CRUD de usuarios                           | No                    | No        | No               | Sí                                   |
| Crear comercio                             | No                    | No        | Uno propio       | Asignado a comerciante real          |
| Editar/eliminar comercio                   | No                    | No        | Propio           | Cualquiera, con reglas de integridad |
| CRUD de productos                          | No                    | No        | De su comercio   | De cualquier comercio                |
| Gestión de inactivos                       | No                    | No        | Recursos propios | Todos                                |
| Dashboard global                           | No                    | No        | No               | Sí                                   |
| Servicios/horarios/disponibilidad públicos | Sí                    | Sí        | Sí               | Sí                                   |
| Gestionar servicios y horarios             | No                    | No        | Su negocio       | Global                               |
| Crear reserva / Mis reservas               | No                    | Propias   | No               | No                                   |
| Consultar/cancelar reserva                 | No                    | Propia    | Su negocio       | Global                               |
| Favoritos                                  | No                    | Propios   | No               | No                                   |

### Autorización real

Las rutas de escritura exigen sesión, rol permitido y CSRF. El servicio determina propiedad a partir del usuario de la sesión y la relación almacenada; no confía en `usuarioId` enviado por el navegador para otorgar permisos.

Un comerciante no puede asignar su comercio a otro usuario, modificar un producto ajeno o moverlo a otro negocio. El administrador puede asignar o reasignar comercios respetando el límite de uno por comerciante. No hay autorregistro de administradores.

- Falta sesión en operación protegida: 401.
- Rol o propiedad no permitidos: 403.
- Recurso privado no visible en consulta pública: 404.
- Reglas de integridad o datos inválidos: 400.

`?gestion=true` solo permite Administrador o Comerciante. Para el comerciante devuelve únicamente sus recursos, incluidos inactivos. Sin ese parámetro, los listados respetan disponibilidad pública incluso cuando quien consulta está autenticado.

### Navegación por rol

- Administrador → `dashboard.html`, `usuarios.html`, `negocios.html`, `productos.html`, `mis-servicios.html`, `reservas.html`.
- Comerciante → `mi-negocio.html`, `mis-productos.html`, `mis-servicios.html`, `reservas.html`, preview público de su comercio.
- Comprador → `marketplace.html`, detalles, `carrito.html`, `mis-reservas.html`, `favoritos.html`, `mis-pedidos.html`. Catálogo de servicios en `servicios.html`.
- Invitado → landing, marketplace y detalle; el botón de compra conduce al login.

Un rol incorrecto vuelve a su inicio, evitando el antiguo bucle hacia dashboard. El preview no convierte al comerciante en comprador ni habilita carrito. La protección del cliente no sustituye al servidor.

### Revocación e integridad

La sesión caduca a las ocho horas, al reiniciar el proceso, al cerrar sesión o cuando se revocan permisos/contraseña/estado. Usuarios inactivos no pueden iniciar sesión. Los mensajes entre pestañas no contienen identidad ni token; sirven para refrescar la sesión desde API.

No puede desaparecer el último administrador activo. No se permite eliminar la propia cuenta administradora. Un comerciante con comercio no puede cambiar a otro rol hasta resolver esa relación. Los borrados de usuario/comercio con dependencias se rechazan, sin cascadas destructivas.

## UI, accesibilidad y storytelling

Las categorías usan el Coverflow 3D de `categorias.js`, tarjetas creadas dinámicamente y SVG propios de `assets/icons/categorias.svg`. Se conservan flechas, scroll táctil, hover 3D, selección activa, `aria-pressed` y filtros compartidos con los selects de formularios. El centrado usa scroll horizontal del carrusel: `scrollIntoView` desplazaba verticalmente el nuevo hero móvil durante el arranque. Perspectiva y escala mantienen la profundidad; se retiró la atenuación de opacidad del texto para conservar contraste en todas las categorías.

### Identidad

Variables centralizadas en un único `:root` de `frontend/css/tokens.css`; escala de espacios, radios y tipografías compartidos. `base.css`, `layout.css`, `components.css`, `pages.css` y `animations.css` separan responsabilidades; `estilos.css` es el resultado compacto generado mediante `npm run assets`, nunca la fuente a editar:

| Token                | Valor / uso                                 |
| -------------------- | ------------------------------------------- |
| `--amarillo-rp`      | `#efc75e`: energía, ilustración y acentos   |
| `--rojo-rp`          | `#a33242`: acciones e identidad             |
| `--rojo-oscuro`      | `#642635`: contraste y secciones narrativas |
| `--crema`            | `#faf7f0`: fondo cálido                     |
| `--superficie`       | Blanco: formularios y tarjetas              |
| `--texto`            | `#2b302d`: texto principal                  |
| `--texto-secundario` | `#65665f`: información secundaria           |
| `--exito`            | `#176346`: estados positivos                |
| `--peligro`          | `#a22535`: errores y acciones destructivas  |

Playfair Display para identidad/títulos e Inter para interfaz, ambas WOFF2 variables locales precargadas, con fallbacks de sistema. Rojo y amarillo se concentran en CTAs, bordes, ilustración y narrativa; el verde queda para estados positivos. Se unificaron botones, tarjetas, KPIs, badges, mensajes, formularios, modal, foco y estados disabled.

### Landing y scrollytelling

Narrativa: contexto de la comunidad → comerciante publica → comprador descubre → apoyo local → comunidad activa. Hero editorial con retrato local en arco, postal de la ciudad, firma «Pereira se levanta. Contigo.», CTA a explorar y registro de comerciante. Comercios, productos e indicadores se obtienen de API; no se inventan cifras o publicaciones.

La antigua intro de cinco segundos sigue retirada. La nueva firma de apertura (`apertura.js`, diferida e independiente de API) dura 1250 ms, no captura puntero ni foco y se descarta con pointerdown, rueda, scroll, tacto, teclado o foco. Usa una clave de sessionStorage para mostrarse una sola vez por sesión; con movimiento reducido, ancla inicial, scroll restaurado o almacenamiento denegado, el acceso es inmediato. `pagehide` y el cambio de preferencia limpian listeners y temporizador. No modifica el scroll del documento ni intercepta navegación. `IntersectionObserver` conserva reveal y contadores puntuales. GSAP + ScrollTrigger reemplazan cuatro manejadores manuales de scroll y sus bucles; solo se cargan en la landing por encima de 900 px y con `prefers-reduced-motion: no-preference`. Un contexto revierte estilos y elimina triggers al cambiar la preferencia o el ancho. No hay animación de filtros de imagen durante scroll. La landing usa fotografía local con dimensiones reservadas y carga diferida fuera del hero. Se retiró el vídeo del hero y sus observadores: los archivos históricos se conservan, pero no se solicitan desde la landing.

Sin movimiento o sin la biblioteca, todos los mensajes narrativos se muestran en orden estático. Todas las páginas ofrecen salto al contenido, foco visible y controles accesibles por teclado.

### Dirección de arte: Pereira se levanta

La composición toma la puerta del comercio como motivo: arcos fotográficos, serif editorial y acentos de amarillo sobre papel cálido. El rojo profundo guía acciones y selección; la tinta verde `#293d35` sostiene narrativa y resumen del carrito; `#fffcf6` distingue las superficies. No se añaden colores a los estados de manera decorativa: éxito y error conservan sus significados. Playfair Display e Inter continúan como fuentes locales.

- Landing: apertura breve → retrato de comerciante → impacto → personas → visibilidad → vitrina digital → descubrimiento → acción. Los capítulos se distinguen por fotografía, papel y ritmo tipográfico; GSAP conserva cuatro triggers y solo se carga por encima de 900 px con movimiento permitido. Los dos capítulos progresivos duran 240vh en escritorio; móvil, reduced motion y ausencia de JS muestran mensajes en secuencia estática.
- Marketplace: hero fotográfico, búsqueda con foco compartido, categorías con selección marcada y tarjetas con comercio, precio/COP y stock diferenciados. Los productos sin imagen se identifican como «Imagen por publicar». No se inventan ofertas, ventas, reseñas ni fotografías de producto.
- Detalle y carrito: ruta de regreso, fotografía reservada, precio protagonista, disponibilidad y vendedor visibles; lista y resumen de selección con cantidades y totales. El texto explica que el carrito no reserva ni cobra.
- Acceso: fotografía de encuentro comercial, firma de Pereira y formulario en papel; escritorio presenta relato y formulario en paralelo, móvil conserva una cabecera narrativa compacta y campos de ancho completo.
- Gestión: navegación lateral a partir de 1200 px; cabecera horizontal en tablet y menú móvil por debajo de 768 px. KPIs jerarquizados, alertas/actividad y superficies de formulario/listado; sin cambiar autenticación, acciones, permisos o datos.

No hay dependencias nuevas, framework, SPA, CDN ni cambios de seguridad. El CSS sigue en los seis módulos existentes; `estilos.css` se regenera. La eliminación se limita a la presentación del hero anterior y sus listeners de vídeo, que ya no tenían un elemento al que atender.

### Decisiones de herramientas

`package.json` de raíz contiene solo herramientas de preparación: PostCSS, lucide-static, GSAP y paquetes Fontsource variables. `scripts/prepare-ui.cjs` genera un CSS compacto, un sprite con 19 iconos funcionales, dos fuentes y dos scripts minificados, con licencias. Assets versionados permiten mantener el arranque Express existente; la CI regenera y detecta drift. No se introdujo Vite: este procesamiento acotado no necesita otro servidor ni cambiar rutas, módulos o despliegue.

Swiper fue evaluado: el componente actual ya resuelve scroll táctil, perspectiva y selección con un frame por evento. Se mantuvo para conservar `filtrarCategoria()`, SVG, hover y semántica de botones, añadiendo ArrowLeft/Right y Home/End sin otra dependencia. El estado sigue siendo local por página y no justifica Alpine CSP; no se añadió framework reactivo.

### Experiencias

- Marketplace: buscador por nombre/descripción/categoría/comercio, categorías combinadas, limpiar filtros, resultados, populares, recientes, comercios y contador real del carrito. El hero móvil se compacta.
- Detalle: imagen, categoría, descripción, precio, stock, estado, datos del vendedor, selector y feedback de compra. Agotado deshabilita selector y agregar.
- Carrito: cantidades, stock actual, quitar, vaciar con confirmación, estado vacío correcto y totales actualizados. No simula pago.
- Comerciante: KPIs de catálogo, activos/inactivos, agotados, stock bajo y visitas; completitud del perfil, edición y accesos a productos/preview.
- Administrador: cuatro KPIs principales y ocho desplegables mediante details/summary; alertas y actividad en paralelo, navegación vigente con aria-current, usuarios, negocios con dueño real y catálogo global.

### Accesibilidad y feedback

Eventos enlazados desde JavaScript externo, sin handlers inline. Formularios con labels y filtros con nombres accesibles. Foco visible, botones disabled durante tareas, estados loading/error/success/empty, mensajes con `role` y `aria-live`.

La confirmación usa `<dialog>` nativo con Cancelar inicialmente enfocado, Escape para cancelar y retorno de foco al disparador. Se sustituyeron `alert()` y `confirm()` del flujo normal.

Se comprobaron 360/768/1024/1440 px en las páginas de los tres roles y las públicas, sin overflow horizontal. Se revisaron capturas de landing escritorio y marketplace móvil. Esto no equivale a una certificación WCAG ni a una revisión completa en todos los navegadores.

## Límites y siguientes decisiones

Con MySQL persisten las once entidades implementadas; sesiones y rate limits siguen siendo de un proceso. El carrito se invalida por instancia al reiniciar, incluso con IDs duraderos, conservando la experiencia actual. Para varias instancias se requieren sesiones/límites compartidos; imágenes grandes deben evolucionar a almacenamiento de objetos y upload validado. No se implementan pagos ni facturas. Las consultas actuales conservan listados y filtros en services: paginación y consultas específicas se pueden añadir después con pruebas y sin mezclar SQL en esa capa.

## Cierre del dominio: pedidos

```text
carrito.html + carrito.js → API.post /pedidos
→ pedido.routes.js (sesión, Comprador, CSRF)
→ pedido.controller.js (HTTP / JSON)
→ pedido.service.js (campos, rol/propiedad, consolidación, validación y agrupación)
→ repos.transaccion + bloquearProductos
→ repos.pedido / repos.detallePedido / repos.producto
→ pedidos / detalles_pedido / productos
→ COMMIT → JSON 201 → confirmar en UI y limpiar los ítems procesados
```

No hay SQL en controllers/services ni acceso MySQL desde frontend. Se amplía la abstracción existente porque su transacción ya coordina todos los módulos; `bloquearProductos` añade locks de filas deterministas sin sustituir el bloqueo global ni forzar lógica SQL en una capa HTTP. Memory conserva el contrato y añade copias privadas/rollback; MySQL conserva AsyncLocalStorage, parámetros, BEGIN/COMMIT/ROLLBACK/release y bloqueo de PR6.

`pedido.service.js` consulta de nuevo precio, stock, negocio y categoría; nunca acepta usuarioId/negocioId/precio/estado inicial del cliente. Crea un Pedido por negocio y todos sus detalles en una sola transacción. `precioUnitario` es histórico; total/subtotal son propiedades derivadas. Estados, límites, FK y decisiones de normalización se documentan en [DATABASE](DATABASE.md).

`pedido-vista.js` comparte únicamente presentación segura: cards, detalles, cantidades, precios, subtotales, total, fecha America/Bogota, nota escapada y botones autorizados por la vista. `pedidos.js` consulta `/mios` o `/gestion`; usa PATCH reales para estados/cancelación y filtro por estado en gestión. No guarda historial en LocalStorage. Si falla un refresco después de PATCH, informa que el cambio se registró y permite recargar sin fingir una escritura fallida.

El carrito captura `{productoId,cantidad}` al pulsar Confirmar pedido, revalida que no cambien usuario ni instancia, evita doble envío en la página y mantiene nota/cantidades si falla el POST. Solo después de recibir 201 muestra los pedidos de API y resta las cantidades procesadas de la lista más reciente, conservando otros compradores e incrementos durante el envío. Actualiza indicador y enlaza Mis pedidos. Si falla almacenamiento local tras el commit, conserva la confirmación e indica revisar el historial. No hay retry automático ni garantía de idempotencia de POST ante pérdida de respuesta; consultar Mis pedidos antes de repetir. No se añade entidad ni atributo fuera del DER para resolver esa futura mejora.

Se reutilizan paneles, cards, botones, tipografía, tokens y menú accesible; CSS nuevo se limita a estas vistas/formulario. Sin imágenes, historias, dependencias o frameworks nuevos. Comprador navega a Marketplace, Servicios, Favoritos, Mis reservas, Mis pedidos y Carrito; Comerciante a Mi negocio, Mis productos, Mis servicios, Reservas recibidas y Pedidos recibidos; Admin mantiene su gestión y recibe pedidos globales. El servidor vuelve a verificar siempre propiedad.

### Trazabilidad de las once entidades

| Entidad          | Pantalla / ruta real                                       | Service      | Repository / tabla              |
| ---------------- | ---------------------------------------------------------- | ------------ | ------------------------------- |
| Rol              | registro/usuarios, autenticación                           | usuario/auth | rol / roles                     |
| Usuario          | login, registro, usuarios; /api/usuarios                   | usuario/auth | usuario / usuarios              |
| Categoria        | catálogo y selects; /api/categorias                        | categoria    | categoria / categorias          |
| Negocio          | mi-negocio, negocios; /api/negocios                        | negocio      | negocio / negocios              |
| Producto         | marketplace, detalle, mis-productos; /api/productos        | producto     | producto / productos            |
| Servicio         | servicios, detalle-servicio, mis-servicios; /api/servicios | servicio     | servicio / servicios            |
| Horario_Servicio | horarios en mis-servicios/detalle; /api/horarios-servicio  | horario      | horario / horarios_servicio     |
| Reserva          | mis-reservas, reservas; /api/reservas                      | reserva      | reserva / reservas              |
| Favorito         | favoritos y tarjetas; /api/favoritos                       | favorito     | favorito / favoritos            |
| Pedido           | carrito, mis-pedidos, pedidos; /api/pedidos                | pedido       | pedido / pedidos                |
| Detalle_Pedido   | detalle dentro de cards de Pedido y DTO /api/pedidos/:id   | pedido       | detallePedido / detalles_pedido |

El contrato conserva list/find/create/update/delete como infraestructura interna; no expone CRUD genérico de Pedido/Detalle. La persistencia de historial y restauración exacta pasan por el service, no por botones ocultos. Las once entidades aprobadas tienen una funcionalidad real; el trabajo se detiene en PR7.
