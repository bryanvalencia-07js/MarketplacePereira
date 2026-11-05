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
- `ui.js`: tareas con loading, mensajes accesibles, confirmación con `<dialog>`, KPIs y tarjetas escapadas.
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

Las categorías usan el Coverflow 3D de `categorias.js`, tarjetas creadas dinámicamente y SVG propios de `assets/icons/categorias.svg`. Se conservan flechas, scroll, hover, selección activa, `aria-pressed` y filtros compartidos con los selects de formularios.

### Identidad

Variables centralizadas en un único `:root` de `frontend/css/estilos.css`:

| Token | Valor / uso |
|---|---|
| `--amarillo-rp` | `#f4c548`: energía, ilustración y acentos |
| `--rojo-rp` | `#aa293b`: acciones e identidad |
| `--rojo-oscuro` | `#7b1d2d`: contraste y secciones narrativas |
| `--crema` | `#faf7f1`: fondo cálido |
| `--superficie` | Blanco: formularios y tarjetas |
| `--texto` | `#252830`: texto principal |
| `--texto-secundario` | `#5b606a`: información secundaria |
| `--exito` | `#176346`: estados positivos |
| `--peligro` | `#a22535`: errores y acciones destructivas |

Serif para identidad/títulos, sans serif para interfaz, con fallbacks locales. Rojo y amarillo se concentran en CTAs, bordes, ilustración y narrativa; el verde queda para estados positivos. Se unificaron botones, tarjetas, KPIs, badges, mensajes, formularios, modal, foco y estados disabled.

### Landing y scrollytelling

Narrativa: contexto de la comunidad → comerciante publica → comprador descubre → apoyo local → comunidad activa. Hero con identidad y multimedia locales, CTA a explorar y registro de comerciante. Comercios, productos e indicadores se obtienen de API; no se inventan cifras o publicaciones.

`IntersectionObserver` revela secciones y activa los contadores al entrar en viewport. No hay biblioteca de animación. Con `prefers-reduced-motion` se omiten reveal y contadores animados; sin soporte de observer el contenido sigue visible. La página incluye enlace para saltar al contenido.

### Experiencias

- Marketplace: buscador por nombre/descripción/categoría/comercio, categorías combinadas, limpiar filtros, resultados, populares, recientes, comercios y contador real del carrito. El hero móvil se compacta.
- Detalle: imagen, categoría, descripción, precio, stock, estado, datos del vendedor, selector y feedback de compra. Agotado deshabilita selector y agregar.
- Carrito: cantidades, stock actual, quitar, vaciar con confirmación, estado vacío correcto y totales actualizados. No simula pago.
- Comerciante: KPIs de catálogo, activos/inactivos, agotados, stock bajo y visitas; completitud del perfil, edición y accesos a productos/preview.
- Administrador: KPIs, alertas y actividad con `createdAt`; usuarios, negocios con dueño real y catálogo global.

### Accesibilidad y feedback

Eventos enlazados desde JavaScript externo, sin handlers inline. Formularios con labels y filtros con nombres accesibles. Foco visible, botones disabled durante tareas, estados loading/error/success/empty, mensajes con `role` y `aria-live`.

La confirmación usa `<dialog>` nativo con Cancelar inicialmente enfocado, Escape para cancelar y retorno de foco al disparador. Se sustituyeron `alert()` y `confirm()` del flujo normal.

Se comprobaron 360/768/1024/1440 px en las páginas de los tres roles y las públicas, sin overflow horizontal. Se revisaron capturas de landing escritorio y marketplace móvil. Esto no equivale a una certificación WCAG ni a una revisión completa en todos los navegadores.

## Límites y siguientes decisiones

Con MySQL persisten las tres entidades; sesiones y rate limits siguen siendo de un proceso. El carrito se invalida por instancia al reiniciar, incluso con IDs duraderos, conservando la experiencia actual. Para varias instancias se requieren sesiones/límites compartidos; imágenes grandes deben evolucionar a almacenamiento de objetos y upload validado. No se implementan pagos, pedidos ni facturas. Las consultas actuales conservan listados y filtros en services: paginación y consultas específicas se pueden añadir después con pruebas y sin mezclar SQL en esa capa.
