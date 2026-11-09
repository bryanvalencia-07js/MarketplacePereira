# API REST implementada

Base: `/api`, mismo origen que el frontend. JSON UTF-8, sin CORS abierto. Todos los endpoints responden con `Cache-Control: no-store`.

```json
{ "ok": true, "data": {} }
```

```json
{ "ok": false, "mensaje": "Descripción comprensible del error" }
```

Las colecciones usan `data: []`; no el antiguo `{ total, usuarios }`. No se devuelve contraseña ni hash. Los DTOs de entidades incluyen `id`, `createdAt` y `updatedAt`.

## Autenticación

| Método | Ruta             | Body / respuesta                                             | Permiso                                               |
| ------ | ---------------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| POST   | `/auth/registro` | Nombre, apellido, correo, password, rol → Usuario, 201       | Público, solo Comerciante/Comprador                   |
| POST   | `/auth/login`    | Correo/password → `{ usuario, csrfToken }`, cookie de sesión | Público                                               |
| GET    | `/auth/me`       | `{ usuario, csrfToken }`                                     | Sesión válida; 401 si falta                           |
| GET    | `/auth/sesion`   | `{ usuario: Usuario o null, csrfToken, instancia }`          | Bootstrap público; solo identidad de la cookie propia |
| POST   | `/auth/logout`   | Sin body → `{ cerrada: true }`, elimina cookie               | Sesión + CSRF                                         |

Ejemplo de registro:

```json
{
  "nombre": "Laura",
  "apellido": "Pereira",
  "correo": "laura@example.invalid",
  "password": "Una-frase-larga-de-prueba",
  "rol": "Comerciante"
}
```

El ejemplo no es una cuenta distribuida ni una credencial real. Contraseñas: entre 12 y 128 caracteres; hashing scrypt en servidor. Correo normalizado a minúsculas y único. Estado inicial de registro: Activo. El autorregistro no admite `estado`, `id`, `passwordHash` ni `rolId`, `idRol`, `id_rol` o rol Administrador.

Login establece `rp_session`, cookie opaca HttpOnly, SameSite Strict, duración máxima de ocho horas; Secure en producción. `csrfToken` se conserva solo en memoria de la página. Se obtiene de login o del bootstrap de sesión y se envía en `X-CSRF-Token` para CRUD y logout. No se utiliza bearer token en LocalStorage.

## Usuarios

Todos estos endpoints requieren Administrador. Escrituras además requieren CSRF.

| Método | Ruta            | Body                                                                | Resultado           |
| ------ | --------------- | ------------------------------------------------------------------- | ------------------- |
| GET    | `/usuarios`     | —                                                                   | Array de usuarios   |
| GET    | `/usuarios/:id` | —                                                                   | Usuario             |
| POST   | `/usuarios`     | nombre, apellido, correo, password, rol; opcionales telefono/estado | Usuario, 201        |
| PUT    | `/usuarios/:id` | Campos editables parciales                                          | Usuario actualizado |
| DELETE | `/usuarios/:id` | —                                                                   | `{ id }`            |

Usuario público: `id, nombre, apellido, correo, telefono?, rolId, rol, estado, createdAt, updatedAt`.

Roles admitidos en gestión: Administrador, Comerciante, Comprador. Estados: Activo, Inactivo. Los cambios de contraseña, rol o estado revocan sesiones. Se rechazan correo duplicado, eliminación propia, pérdida del último administrador activo y eliminación/cambio de rol de un usuario con comercio pendiente de resolver.

## Categorías

`GET /api/categorias` es público y devuelve `data: [{ id, nombre, descripcion, estado }]` con solo categorías Activas y `Cache-Control: no-store`. No devuelve `Todas`: ese nombre es un filtro del cliente. No hay endpoints de escritura de categorías ni CRUD de roles.

El backend resuelve los nombres de categorías al guardar negocio/producto; acepta variaciones de mayúsculas, acentos y espacios triviales y devuelve el nombre del catálogo. Una asignación inexistente o inactiva responde 400. La relación histórica se conserva si un PUT omite `categoria`. `categoriaId` se devuelve para identificar la relación, pero no se acepta como entrada HTTP en PR5.

## Negocios

| Método | Ruta            | Body / resultado                                | Permiso                          |
| ------ | --------------- | ----------------------------------------------- | -------------------------------- |
| GET    | `/negocios`     | Array público de activos                        | Público                          |
| GET    | `/negocios/:id` | Negocio visible; inactivo solo para dueño/admin | Público o gestión propia         |
| POST   | `/negocios`     | Datos del comercio → Negocio, 201               | Comerciante/Administrador + CSRF |
| PUT    | `/negocios/:id` | Datos parciales → Negocio                       | Dueño/Administrador + CSRF       |
| DELETE | `/negocios/:id` | `{ id }`; exige no tener productos              | Dueño/Administrador + CSRF       |

Datos de creación: `nombre`, `categoria`, `telefono`, `direccion`; opcionales `estado`, `usuarioId`, `descripcion` y `municipio`. Para Comerciante, el propietario se toma de la sesión; enviar otro ID devuelve 403. Para Administrador, se selecciona un `usuarioId` de una cuenta Comerciante existente. Máximo un comercio por comerciante.

Negocio público: `id, usuarioId, propietario, nombre, categoriaId, categoria, descripcion, municipio, telefono, direccion, estado, createdAt, updatedAt`.

`descripcion` (hasta 2000) y `municipio` (hasta 80) son opcionales y admiten null/vacío para ausencia de información; los negocios migrados no reciben un municipio ni descripción ficticios. `propietario` se deriva de la cuenta vigente; no se acepta como texto arbitrario de entrada.

Filtros: `?gestion=true`, `?usuarioId=2`, `?buscar=cafe`, `?categoria=Alimentos`, `?estado=Activo`. Gestión exige Comerciante o Administrador; el comerciante solo recibe recursos propios. Los filtros no amplían permisos.

## Productos

| Método | Ruta                    | Body / resultado                                | Permiso                                 |
| ------ | ----------------------- | ----------------------------------------------- | --------------------------------------- |
| GET    | `/productos`            | Array público visible                           | Público                                 |
| GET    | `/productos/:id`        | Producto visible; privado solo para dueño/admin | Público o gestión propia                |
| POST   | `/productos`            | Datos → Producto, 201                           | Dueño del comercio/Administrador + CSRF |
| PUT    | `/productos/:id`        | Datos parciales → Producto                      | Dueño/Administrador + CSRF              |
| DELETE | `/productos/:id`        | `{ id }`                                        | Dueño/Administrador + CSRF              |
| POST   | `/productos/:id/visita` | Sin body → Producto con visitas incrementadas   | Público, mismo origen, rate limit       |

Datos de creación:

```text
negocioId: entero positivo de un comercio existente
nombre: texto, máximo 120
descripcion: texto, máximo 2000
categoria: nombre de una categoría activa del catálogo, máximo 60
precio: número positivo, máximo 1 000 000 000, hasta dos decimales
stock: entero entre 0 y 1 000 000
imagen: Data URL JPEG/PNG/WEBP optimizada, máximo 1 800 000 caracteres
estado: Activo o Inactivo, opcional
```

El formato y la firma básica de imagen se validan. No se aceptan URLs externas, `popularidad`, `visitas`, IDs ni timestamps enviados por cliente. `visitas` comienza en cero. PUT conserva los campos omitidos.

Producto público: `id, negocioId, nombre, descripcion, categoriaId, categoria, precio, stock, imagen, estado, visitas, popularidad, createdAt, updatedAt`.

`popularidad` es un alias de respuesta calculado de `visitas`, conservado para clientes anteriores. Ambos valores son idénticos y solo `/visita` incrementa el contador; la migración no genera visitas. No existe una entidad Inventario: el stock permanece en Producto.

Filtros combinables: `?buscar=artesanal`, `?categoria=Alimentos`, `?negocioId=1`, `?estado=Activo`, `?gestion=true`. Sin gestión, exige producto activo y negocio existente activo. Los agotados se mantienen en catálogo; visita exige además stock positivo. Una consulta pública nunca lista huérfanos/inactivos por añadir filtros.

La visita cuenta cargas válidas del detalle, no visitantes únicos; no equivale a una venta. No necesita sesión, pero está limitada por IP y origen.

## Servicios y horarios

| Método | Ruta                                             | Entrada / respuesta                                                                                                  | Permiso                                                   |
| ------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| GET    | `/servicios`                                     | Filtros negocioId, categoria (nombre), buscar. `gestion=true` incluye inactivos autorizados; estado solo con gestión | Público / gestión Comerciante propietario o Administrador |
| GET    | `/servicios/:id`                                 | Servicio visible; en gestión permite inactivo a propietario/Admin                                                    | Público / propietario/Admin                               |
| POST   | `/servicios`                                     | negocioId, nombre, descripcion, categoria, precioReferencia, duracionMinutos, capacidadSimultanea, estado opcional   | Comerciante propietario / Admin, CSRF                     |
| PUT    | `/servicios/:id`                                 | Campos anteriores parciales                                                                                          | Propietario / Admin, CSRF                                 |
| DELETE | `/servicios/:id`                                 | `{id}`; 409 si tiene cualquier reserva                                                                               | Propietario / Admin, CSRF                                 |
| GET    | `/servicios/:id/horarios`                        | Horarios del servicio visible                                                                                        | Público / propietario/Admin                               |
| POST   | `/servicios/:id/horarios`                        | diaSemana ISO 1..7, horaInicio/horaFin `HH:mm`                                                                       | Propietario / Admin, CSRF                                 |
| PUT    | `/horarios-servicio/:id`                         | Campos del horario parciales; no traslada a otro servicio                                                            | Propietario / Admin, CSRF                                 |
| DELETE | `/horarios-servicio/:id`                         | `{id}`; conserva reservas                                                                                            | Propietario / Admin, CSRF                                 |
| GET    | `/servicios/:id/disponibilidad?fecha=YYYY-MM-DD` | `{servicioId,fecha,zonaHoraria,slots:[]}` para servicio públicamente Activo                                          | Público                                                   |

Servicio público exige servicio, negocio y categoría Activos. Cada servicio pertenece a un negocio y categoría existentes; crear/reasignar categoría exige Activa. `categoria` acepta su nombre normalizado, como Producto/Negocio; no se admite stock. Precio 0..1e9 con dos decimales (0: consultar/cotizar), duración entera 1..1440, capacidad entera 1..100. Horas intradía 00:00..23:59, inicio < fin, ventana >= duración; superposición responde 409. Cambiar duración con reservas Confirmadas futuras/en curso, bajar capacidad bajo el pico confirmado o trasladar un servicio con reservas responde 409. Desactivar no cancela reservas.

Ejemplo de slot, 09:00 Pereira / 14:00 UTC:

```json
{
  "fechaHoraInicio": "2099-01-05T14:00:00.000Z",
  "capacidadTotal": 3,
  "cuposOcupados": 1,
  "cuposDisponibles": 2,
  "disponible": true
}
```

Los slots y el fin son derivados, nunca persistidos. Horarios comerciales se interpretan en America/Bogota; instantes HTTP tienen zona explícita y respuestas UTC con `Z`. GET es informativo: POST revalida capacidad bajo transacción.

## Reservas

| Método | Ruta                     | Entrada / respuesta                                                    | Permiso                                                  |
| ------ | ------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| GET    | `/reservas/mias`         | Reservas del usuario de sesión, con servicio y negocio                 | Solo Comprador                                           |
| GET    | `/reservas/gestion`      | Reservas recibidas; filtros negocioId/servicioId sin ampliar permisos  | Comerciante de ese negocio / Admin global                |
| GET    | `/reservas/:id`          | Reserva con servicio y negocio                                         | Comprador propio / Comerciante propietario / Admin       |
| POST   | `/reservas`              | `{servicioId,fechaHoraInicio}` ISO 8601 con zona; crea Confirmada, 201 | Solo Comprador, CSRF                                     |
| PATCH  | `/reservas/:id/cancelar` | Estado Cancelada, 200; idempotente y conserva fila                     | Comprador propio / Comerciante propietario / Admin, CSRF |

El servidor asigna usuarioId desde la sesión; enviarlo en POST produce 400. Solo acepta slots futuros exactos de un servicio/negocio/categoría Activos. Fecha pasada, sin zona o fuera de slot: 400; servicio inexistente/no público: 404; sin capacidad: 409. Dos solicitudes simultáneas no exceden la capacidad. No hay DELETE físico ni aprobación manual, ni estados diferentes a Confirmada/Cancelada. Identificadores de recursos ajenos no permiten ver/cancelar reservas: 403. Cambios de horario no borran confirmaciones.

## Favoritos

| Método | Ruta             | Entrada / respuesta                                                    | Permiso                     |
| ------ | ---------------- | ---------------------------------------------------------------------- | --------------------------- |
| GET    | `/favoritos`     | Asociaciones propias con producto público o null y disponible booleano | Solo Comprador              |
| POST   | `/favoritos`     | `{productoId}`, crea asociación, 201                                   | Solo Comprador, CSRF        |
| DELETE | `/favoritos/:id` | `{id}`; el ID es del Favorito, no del Producto                         | Comprador propietario, CSRF |

usuarioId se obtiene de sesión; campos extra se rechazan con 400. Producto inexistente/inactivo, negocio o categoría inactivos: 404; duplicado: 409; ID de otro comprador: 403. UNIQUE(usuarioId,productoId) refuerza la regla en SQL. La API conserva favoritos de productos posteriormente desactivados con `producto:null` para no publicar contenido privado y permitir quitarlos. Borrar físicamente producto/usuario aplica CASCADE a la asociación.

## Otros endpoints

| Método | Ruta               | Resultado                                                                           |
| ------ | ------------------ | ----------------------------------------------------------------------------------- |
| GET    | `/salud`           | `{ estado: "disponible" }`                                                          |
| GET    | `/publico/resumen` | Conteos de comercios activos, productos públicos, usuarios registrados y categorías |

El resumen no expone la lista de cuentas.

## Errores y límites

| Status    | Uso                                                           |
| --------- | ------------------------------------------------------------- |
| 200 / 201 | Operación correcta / creación                                 |
| 400       | Validación, integridad, campos no permitidos o JSON inválido  |
| 401       | Falta sesión o credenciales incorrectas                       |
| 403       | Rol/propiedad, origen o CSRF no permitido                     |
| 404       | Recurso/ruta inexistente o recurso no visible                 |
| 409       | Stock insuficiente, transición inválida o historial protegido |
| 413       | Solicitud JSON superior a 2 MiB                               |
| 415       | Cuerpo comprimido rechazado antes de parsear                  |
| 429       | Límite de solicitudes/intentos                                |
| 500       | Error interno, sin stack ni detalles de persistencia          |
| 503       | Capacidad temporal de sesiones agotada                        |

No hay endpoints de carrito persistente o pagos. Pedido/Detalle_Pedido se exponen mediante las operaciones documentadas abajo. MySQL es persistencia interna y no expone endpoints SQL. El carrito es del cliente y se valida contra `/productos`, `/negocios` y la sesión actual antes de operar.

## Pedidos

| Método | Ruta                    | Entrada / respuesta                                                                             | Permiso                                                                           |
| ------ | ----------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| POST   | `/pedidos`              | `{items:[{productoId,cantidad}],observaciones?}` → array de pedidos con detalles y totales; 201 | Solo Comprador, sesión + CSRF                                                     |
| GET    | `/pedidos/mios`         | Pedidos del comprador de sesión, recientes primero                                              | Comprador                                                                         |
| GET    | `/pedidos/gestion`      | Pedidos recibidos, recientes primero; filtros `estado` y `negocioId`                            | Comerciante propio / Admin global                                                 |
| GET    | `/pedidos/:id`          | Pedido autorizado con detalles y total                                                          | Comprador propio / Comerciante propietario / Admin                                |
| PATCH  | `/pedidos/:id/cancelar` | Sin body o `{}` → Pedido Cancelado; 200 idempotente                                             | Comprador propio Pendiente / Comerciante propietario o Admin Pendiente/Confirmado |
| PATCH  | `/pedidos/:id/estado`   | `{estado:"Confirmado"}` o Completado/Cancelado → Pedido; 200                                    | Comerciante propietario / Admin                                                   |

```json
{
  "items": [
    { "productoId": 15, "cantidad": 2 },
    { "productoId": 31, "cantidad": 1 }
  ],
  "observaciones": "En horario comercial"
}
```

Solo se permiten esas claves. `usuarioId`, `idUsuario`, `id_usuario`, negocioId, precioUnitario, total, subtotal o estado inicial en el body producen 400, también los campos extra dentro de items. Usuario proviene de sesión; negocio/precio/stock/categoría provienen de registros actuales. IDs y cantidades son números enteros, cantidades 1..1000 después de consolidar repetidos, 1..100 líneas y observaciones opcionales hasta 2000 caracteres (vacío se normaliza a null). Servicios no tienen entrada en este flujo: se compran únicamente IDs de Producto; Servicio utiliza Reserva.

Cada negocio genera su Pedido Pendiente con la misma observación general. **Un solo POST es all-or-nothing**: si falta stock o falla un producto/escritura, ningún negocio queda confirmado ni conserva descuentos parciales. Requiere Producto/Negocio/Categoria Activos, precio válido y stock suficiente. Producto inexistente/no disponible: 404; precio inválido/stock insuficiente: 409. El mensaje de stock indica un ID de producto, sin SQL ni datos privados.

DTO por Pedido: `id, usuarioId, negocioId, estado, observaciones, createdAt, updatedAt, fecha, negocio:{id,nombre}, detalles:[], total`. `fecha` es alias de `createdAt` (DER fecha_pedido). Detalle: `id, pedidoId, productoId, cantidad, precioUnitario, createdAt, updatedAt, nombre, subtotal`. Nombre resuelto desde Producto actual (puede cambiar); precioUnitario y cantidad son históricos. El DTO no expone datos de la cuenta del comprador salvo su ID. Los totales usan solo cantidad × precio histórico; se suman en centavos con límite entero seguro, nunca se persisten.

Transiciones: Pendiente → Confirmado; Confirmado → Completado; Pendiente/Confirmado → Cancelado. Completado/Cancelado son terminales. Salto Pendiente → Completado y cancelación de Completado: 409. Comprador no usa `/estado` y solo cancela su Pendiente; cancelar Confirmado produce 409. Comerciante nunca accede a otro negocio (403 por ID, lista vacía si filtra uno ajeno). Admin gestiona globalmente y no crea por el flujo Comprador. Repetir `/cancelar` devuelve el Cancelado sin restitución adicional; una transición repetida vía `/estado` se rechaza 409.

Cancelar restaura cantidades dentro de la misma transacción que cambia estado. Si la restitución superaría el límite existente de stock 1.000.000, produce 409 sin modificar nada y solicita revisar existencias. Producto/Negocio/Usuario con pedidos históricos no se eliminan; sus endpoints DELETE devuelven 409 recomendando desactivar. Un Producto referenciado no puede trasladarse a otro comercio. No existen DELETE de pedidos/detalles, endpoints financieros ni pagos.
