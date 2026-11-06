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

| Carpeta | Responsabilidad |
|---|---|
| `config` | Puerto, origen, DATA_SOURCE, parámetros DB y bootstrap opcional de administrador |
| `routes` | Endpoints, autenticación, roles, CSRF y límites de intentos |
| `controllers` | Traducir request/response; no manipulan arreglos |
| `services` | Reglas de usuario, comercio, producto, autenticación y propiedad |
| `repositories` | Contrato async y adaptadores memory/MySQL |
| `db` | Pool mysql2/promise, preparación de conexiones y migraciones explícitas |
| `data` | Estado inicial vacío, sin cuentas predeterminadas |
| `middleware` | Sesión, políticas HTTP, origen, CSRF, rate limits y errores |
| `utils` | Validación, errores de dominio y hashing |

Los servicios acceden a `usuario`, `negocio` y `producto` mediante `list/find/create/update/delete`. Los repositorios devuelven copias, generan IDs monotónicos y preservan `createdAt`; `updatedAt` cambia al actualizar. No exponen la colección interna. `transaccion(callback)` serializa escrituras y comprobaciones de unicidad; memory lo hace en este proceso y MySQL entre procesos con una fila bloqueada en InnoDB. MySQL usa AsyncLocalStorage para que el callback comparta conexión sin cambiar services. IDs y fechas se normalizan en DTOs; el propietario se deriva del usuario vigente, sin columna duplicada en MySQL.

El adaptador de memoria no es almacenamiento duradero ni una implementación distribuida. Un error no transforma automáticamente un callback arbitrario en un rollback; los servicios actuales realizan una única escritura de entidad por mutación. El adaptador MySQL proporciona BEGIN/COMMIT/ROLLBACK reales y libera o descarta la conexión en finally; ver [DATABASE](DATABASE.md).

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

`Usuario.id → Negocio.usuarioId`; `Negocio.id → Producto.negocioId`.

Un comerciante tiene como máximo un comercio. El administrador asigna un comerciante real mediante un selector, no un nombre suelto. El nombre del propietario se proyecta desde su cuenta vigente. No se elimina un usuario con comercio ni un negocio con productos; la API responde 400 y explica la acción previa necesaria. No se crean huérfanos mediante los endpoints.

Un producto público exige producto activo y comercio existente activo. Los agotados pueden verse, pero no comprarse ni generar visita. La gestión privada permite consultar inactivos al propietario/administrador. Popularidad aumenta por carga válida del detalle, no por renderizar tarjetas; no representa visitantes únicos ni ventas.

## Sesiones y carrito

Sesiones absolutas de ocho horas en memoria; cookie opaca HttpOnly. El token se indexa por su hash en servidor y la identidad se vuelve a leer para cada request. Cambiar contraseña/rol/estado o eliminar una cuenta revoca sus sesiones.

El carrito conserva referencias `{ usuarioId, productoId, cantidad }`. Su clave incluye un identificador aleatorio de instancia del backend: un reinicio no vuelve a asociar IDs nuevos con carritos antiguos. Antes de operar se verifica la sesión y se consulta el catálogo público. Solo se ajustan entradas del comprador actual; otros compradores se preservan.

Se eliminan referencias no disponibles y cantidades inválidas, se combinan duplicados y se limita al stock. Los importes se suman en centavos y se formatean como COP con decimales cuando corresponda. Un fallo de red no se interpreta como catálogo vacío ni borra el carrito. No hay reserva de stock, checkout ni pedidos.


## Roles y permisos

| Operación | Visitante | Comprador | Comerciante | Administrador |
|---|---|---|---|---|
| Landing, catálogo y comercios públicos | Sí | Sí | Sí | Sí |
| Detalle de producto público activo | Sí | Sí | Sí | Sí |
| Registrar cuenta pública | Comprador/Comerciante | Igual | Igual | Igual |
| Carrito temporal | Iniciar sesión | Propio | No | No |
| CRUD de usuarios | No | No | No | Sí |
| Crear comercio | No | No | Uno propio | Asignado a comerciante real |
| Editar/eliminar comercio | No | No | Propio | Cualquiera, con reglas de integridad |
| CRUD de productos | No | No | De su comercio | De cualquier comercio |
| Gestión de inactivos | No | No | Recursos propios | Todos |
| Dashboard global | No | No | No | Sí |

### Autorización real

Las rutas de escritura exigen sesión, rol permitido y CSRF. El servicio determina propiedad a partir del usuario de la sesión y la relación almacenada; no confía en `usuarioId` enviado por el navegador para otorgar permisos.

Un comerciante no puede asignar su comercio a otro usuario, modificar un producto ajeno o moverlo a otro negocio. El administrador puede asignar o reasignar comercios respetando el límite de uno por comerciante. No hay autorregistro de administradores.

- Falta sesión en operación protegida: 401.
- Rol o propiedad no permitidos: 403.
- Recurso privado no visible en consulta pública: 404.
- Reglas de integridad o datos inválidos: 400.

`?gestion=true` solo permite Administrador o Comerciante. Para el comerciante devuelve únicamente sus recursos, incluidos inactivos. Sin ese parámetro, los listados respetan disponibilidad pública incluso cuando quien consulta está autenticado.

### Navegación por rol

- Administrador → `dashboard.html`, `usuarios.html`, `negocios.html`, `productos.html`.
- Comerciante → `mi-negocio.html`, `mis-productos.html`, preview público de su comercio.
- Comprador → `marketplace.html`, detalle y `carrito.html`.
- Invitado → landing, marketplace y detalle; el botón de compra conduce al login.

Un rol incorrecto vuelve a su inicio, evitando el antiguo bucle hacia dashboard. El preview no convierte al comerciante en comprador ni habilita carrito. La protección del cliente no sustituye al servidor.

### Revocación e integridad

La sesión caduca a las ocho horas, al reiniciar el proceso, al cerrar sesión o cuando se revocan permisos/contraseña/estado. Usuarios inactivos no pueden iniciar sesión. Los mensajes entre pestañas no contienen identidad ni token; sirven para refrescar la sesión desde API.

No puede desaparecer el último administrador activo. No se permite eliminar la propia cuenta administradora. Un comerciante con comercio no puede cambiar a otro rol hasta resolver esa relación. Los borrados de usuario/comercio con dependencias se rechazan, sin cascadas destructivas.

## UI, accesibilidad y storytelling

Las categorías usan el Coverflow 3D de `categorias.js`, tarjetas creadas dinámicamente y SVG propios de `assets/icons/categorias.svg`. Se conservan flechas, scroll táctil, hover 3D, selección activa, `aria-pressed` y filtros compartidos con los selects de formularios. El centrado usa scroll horizontal del carrusel: `scrollIntoView` desplazaba verticalmente el nuevo hero móvil durante el arranque. Perspectiva y escala mantienen la profundidad; se retiró la atenuación de opacidad del texto para conservar contraste en todas las categorías.

### Identidad

Variables centralizadas en un único `:root` de `frontend/css/tokens.css`; escala de espacios, radios y tipografías compartidos. `base.css`, `layout.css`, `components.css`, `pages.css` y `animations.css` separan responsabilidades; `estilos.css` es el resultado compacto generado mediante `npm run assets`, nunca la fuente a editar:

| Token | Valor / uso |
|---|---|
| `--amarillo-rp` | `#efc75e`: energía, ilustración y acentos |
| `--rojo-rp` | `#a33242`: acciones e identidad |
| `--rojo-oscuro` | `#642635`: contraste y secciones narrativas |
| `--crema` | `#faf7f0`: fondo cálido |
| `--superficie` | Blanco: formularios y tarjetas |
| `--texto` | `#2b302d`: texto principal |
| `--texto-secundario` | `#65665f`: información secundaria |
| `--exito` | `#176346`: estados positivos |
| `--peligro` | `#a22535`: errores y acciones destructivas |

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

Con MySQL persisten las tres entidades; sesiones y rate limits siguen siendo de un proceso. El carrito se invalida por instancia al reiniciar, incluso con IDs duraderos, conservando la experiencia actual. Para varias instancias se requieren sesiones/límites compartidos; imágenes grandes deben evolucionar a almacenamiento de objetos y upload validado. No se implementan pagos, pedidos ni facturas. Las consultas actuales conservan listados y filtros en services: paginación y consultas específicas se pueden añadir después con pruebas y sin mezclar SQL en esa capa.
