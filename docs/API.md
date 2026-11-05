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

| Método | Ruta | Body / respuesta | Permiso |
|---|---|---|---|
| POST | `/auth/registro` | Nombre, apellido, correo, password, rol → Usuario, 201 | Público, solo Comerciante/Comprador |
| POST | `/auth/login` | Correo/password → `{ usuario, csrfToken }`, cookie de sesión | Público |
| GET | `/auth/me` | `{ usuario, csrfToken }` | Sesión válida; 401 si falta |
| GET | `/auth/sesion` | `{ usuario: Usuario o null, csrfToken, instancia }` | Bootstrap público; solo identidad de la cookie propia |
| POST | `/auth/logout` | Sin body → `{ cerrada: true }`, elimina cookie | Sesión + CSRF |

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

El ejemplo no es una cuenta distribuida ni una credencial real. Contraseñas: entre 12 y 128 caracteres; hashing scrypt en servidor. Correo normalizado a minúsculas y único. Estado inicial de registro: Activo. El autorregistro no admite `estado`, `id`, `passwordHash` ni rol Administrador.

Login establece `rp_session`, cookie opaca HttpOnly, SameSite Strict, duración máxima de ocho horas; Secure en producción. `csrfToken` se conserva solo en memoria de la página. Se obtiene de login o del bootstrap de sesión y se envía en `X-CSRF-Token` para CRUD y logout. No se utiliza bearer token en LocalStorage.

## Usuarios

Todos estos endpoints requieren Administrador. Escrituras además requieren CSRF.

| Método | Ruta | Body | Resultado |
|---|---|---|---|
| GET | `/usuarios` | — | Array de usuarios |
| GET | `/usuarios/:id` | — | Usuario |
| POST | `/usuarios` | nombre, apellido, correo, password, rol; opcionales telefono/estado | Usuario, 201 |
| PUT | `/usuarios/:id` | Campos editables parciales | Usuario actualizado |
| DELETE | `/usuarios/:id` | — | `{ id }` |

Usuario público: `id, nombre, apellido, correo, telefono?, rol, estado, createdAt, updatedAt`.

Roles admitidos en gestión: Administrador, Comerciante, Comprador. Estados: Activo, Inactivo. Los cambios de contraseña, rol o estado revocan sesiones. Se rechazan correo duplicado, eliminación propia, pérdida del último administrador activo y eliminación/cambio de rol de un usuario con comercio pendiente de resolver.

## Negocios

| Método | Ruta | Body / resultado | Permiso |
|---|---|---|---|
| GET | `/negocios` | Array público de activos | Público |
| GET | `/negocios/:id` | Negocio visible; inactivo solo para dueño/admin | Público o gestión propia |
| POST | `/negocios` | Datos del comercio → Negocio, 201 | Comerciante/Administrador + CSRF |
| PUT | `/negocios/:id` | Datos parciales → Negocio | Dueño/Administrador + CSRF |
| DELETE | `/negocios/:id` | `{ id }`; exige no tener productos | Dueño/Administrador + CSRF |

Datos de creación: `nombre`, `categoria`, `telefono`, `direccion`; opcionales `estado` y `usuarioId`. Para Comerciante, el propietario se toma de la sesión; enviar otro ID devuelve 403. Para Administrador, se selecciona un `usuarioId` de una cuenta Comerciante existente. Máximo un comercio por comerciante.

Negocio público: `id, usuarioId, propietario, nombre, categoria, telefono, direccion, estado, createdAt, updatedAt`. `propietario` se deriva de la cuenta vigente; no se acepta como texto arbitrario de entrada.

Filtros: `?gestion=true`, `?usuarioId=2`, `?buscar=cafe`, `?categoria=Alimentos`, `?estado=Activo`. Gestión exige Comerciante o Administrador; el comerciante solo recibe recursos propios. Los filtros no amplían permisos.

## Productos

| Método | Ruta | Body / resultado | Permiso |
|---|---|---|---|
| GET | `/productos` | Array público visible | Público |
| GET | `/productos/:id` | Producto visible; privado solo para dueño/admin | Público o gestión propia |
| POST | `/productos` | Datos → Producto, 201 | Dueño del comercio/Administrador + CSRF |
| PUT | `/productos/:id` | Datos parciales → Producto | Dueño/Administrador + CSRF |
| DELETE | `/productos/:id` | `{ id }` | Dueño/Administrador + CSRF |
| POST | `/productos/:id/visita` | Sin body → Producto con popularidad incrementada | Público, mismo origen, rate limit |

Datos de creación:

```text
negocioId: entero positivo de un comercio existente
nombre: texto, máximo 120
descripcion: texto, máximo 2000
categoria: texto, máximo 60
precio: número positivo, máximo 1 000 000 000, hasta dos decimales
stock: entero entre 0 y 1 000 000
imagen: Data URL JPEG/PNG/WEBP optimizada, máximo 1 800 000 caracteres
estado: Activo o Inactivo, opcional
```

El formato y la firma básica de imagen se validan. No se aceptan URLs externas, `popularidad`, IDs ni timestamps enviados por cliente. `popularidad` comienza en cero. PUT conserva los campos omitidos.

Producto público: `id, negocioId, nombre, descripcion, categoria, precio, stock, imagen, estado, popularidad, createdAt, updatedAt`.

Filtros combinables: `?buscar=artesanal`, `?categoria=Alimentos`, `?negocioId=1`, `?estado=Activo`, `?gestion=true`. Sin gestión, exige producto activo y negocio existente activo. Los agotados se mantienen en catálogo; visita exige además stock positivo. Una consulta pública nunca lista huérfanos/inactivos por añadir filtros.

La visita cuenta cargas válidas del detalle, no visitantes únicos; no equivale a una venta. No necesita sesión, pero está limitada por IP y origen.

## Otros endpoints

| Método | Ruta | Resultado |
|---|---|---|
| GET | `/salud` | `{ estado: "disponible" }` |
| GET | `/publico/resumen` | Conteos de comercios activos, productos públicos, usuarios registrados y categorías |

El resumen no expone la lista de cuentas.

## Errores y límites

| Status | Uso |
|---|---|
| 200 / 201 | Operación correcta / creación |
| 400 | Validación, integridad, campos no permitidos o JSON inválido |
| 401 | Falta sesión o credenciales incorrectas |
| 403 | Rol/propiedad, origen o CSRF no permitido |
| 404 | Recurso/ruta inexistente o recurso no visible |
| 413 | Solicitud JSON superior a 2 MiB |
| 415 | Cuerpo comprimido rechazado antes de parsear |
| 429 | Límite de solicitudes/intentos |
| 500 | Error interno, sin stack ni detalles de persistencia |
| 503 | Capacidad temporal de sesiones agotada |

No hay endpoints de carrito, pedidos ni pagos. MySQL es persistencia interna y no expone endpoints SQL. El carrito es del cliente y se valida contra `/productos`, `/negocios` y la sesión actual antes de operar.
