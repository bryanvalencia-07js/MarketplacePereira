# API REST — Reactiva Pereira

## Propósito

Reactiva Pereira expone una API REST propia desarrollada con Node.js y Express.

El frontend consume esta API mediante `fetch()`.

El flujo general es:

```text
Frontend
↓
fetch()
↓
HTTP Request
↓
Express
↓
Routes
↓
Controllers
↓
Services
↓
Repositories
↓
MySQL / MariaDB
↓
HTTP Response
↓
JSON
↓
Frontend
```

La API utiliza como prefijo:

```text
/api
```

En desarrollo local:

```text
http://localhost:3000/api
```

Express sirve tanto la API como el frontend, por lo que ambos trabajan normalmente bajo el mismo origen.

---

# Formato general de respuesta

Las respuestas exitosas utilizan:

```json
{
  "ok": true,
  "data": {}
}
```

Cuando el resultado es una colección:

```json
{
  "ok": true,
  "data": []
}
```

Los errores utilizan:

```json
{
  "ok": false,
  "mensaje": "Descripción comprensible del error."
}
```

La API no devuelve directamente errores internos de SQL ni stack traces al cliente.

---

# Cache

Las rutas bajo:

```text
/api
```

responden con:

```text
Cache-Control: no-store
```

para evitar almacenar respuestas sensibles o dinámicas en caché.

---

# JSON

Las solicitudes con body utilizan JSON.

Ejemplo:

```http
Content-Type: application/json
```

El tamaño máximo configurado para el cuerpo JSON es:

```text
2 MiB
```

Los cuerpos comprimidos son rechazados.

---

# Campos de fecha

El esquema MySQL actual no contiene `createdAt` y `updatedAt` universalmente.

Por esta razón, los clientes no deben asumir que todas las entidades contienen esos campos.

Actualmente el Repository puede proyectar `createdAt` cuando existe una fecha equivalente en la tabla física.

Ejemplos:

```text
usuario.fecha_registro  → createdAt
negocio.fecha_registro  → createdAt
reserva.fecha_creacion  → createdAt
favorito.fecha_agregado → createdAt
pedido.fecha_pedido     → createdAt
```

Entidades como:

```text
producto
servicio
horario_servicio
detalle_pedido
```

no tienen actualmente un timestamp de creación dentro del esquema académico aprobado.

`updatedAt` no forma parte del esquema MySQL actual y no debe considerarse un campo obligatorio del contrato REST.

---

# Autenticación

La autenticación utiliza una cookie opaca de sesión llamada:

```text
rp_session
```

La cookie es:

```text
HttpOnly
SameSite=Strict
```

y utiliza `Secure` en producción.

El frontend no guarda la sesión en `localStorage`.

---

## POST /api/auth/registro

Registra públicamente una cuenta.

Roles permitidos:

```text
Comerciante
Comprador
```

No permite registrar directamente un Administrador.

### Body

```json
{
  "nombre": "Laura",
  "apellido": "Pereira",
  "correo": "laura@example.invalid",
  "password": "Una-clave-larga-de-prueba",
  "rol": "Comprador"
}
```

`telefono` es opcional.

### Restricciones

La contraseña debe contener entre:

```text
12 y 128 caracteres
```

El correo se normaliza a minúsculas.

No se permiten campos como:

```text
id
rolId
idRol
id_rol
passwordHash
estado
```

durante el autorregistro.

### Respuesta

```text
201 Created
```

Devuelve el Usuario creado sin el hash de contraseña.

---

## POST /api/auth/login

Inicia sesión.

### Body

```json
{
  "correo": "laura@example.invalid",
  "password": "Una-clave-larga-de-prueba"
}
```

### Respuesta

```json
{
  "ok": true,
  "data": {
    "usuario": {},
    "csrfToken": "..."
  }
}
```

También establece la cookie:

```text
rp_session
```

---

## GET /api/auth/me

Requiere sesión válida.

Devuelve:

```json
{
  "ok": true,
  "data": {
    "usuario": {},
    "csrfToken": "..."
  }
}
```

Sin sesión:

```text
401 Unauthorized
```

---

## GET /api/auth/sesion

Permite al frontend comprobar si existe una sesión.

No requiere autenticación.

Respuesta conceptual:

```json
{
  "ok": true,
  "data": {
    "usuario": null,
    "csrfToken": "",
    "instancia": "..."
  }
}
```

Si existe sesión válida, `usuario` contiene la cuenta correspondiente.

---

## POST /api/auth/logout

Cierra la sesión.

Requiere:

```text
sesión
CSRF
```

Respuesta:

```json
{
  "ok": true,
  "data": {
    "cerrada": true
  }
}
```

---

# CSRF

Las operaciones sensibles autenticadas requieren el header:

```http
X-CSRF-Token: <token>
```

El token se obtiene mediante:

```text
login
/auth/me
/auth/sesion
```

cuando existe una sesión válida.

No debe almacenarse permanentemente en `localStorage`.

---

# Usuarios

Las rutas administrativas de Usuarios requieren:

```text
Rol: Administrador
```

Las operaciones de escritura también requieren CSRF.

---

## GET /api/usuarios

Lista los Usuarios.

### Permiso

```text
Administrador
```

### Respuesta

```json
{
  "ok": true,
  "data": []
}
```

El hash de contraseña nunca se devuelve.

---

## GET /api/usuarios/:id

Consulta un Usuario.

Ejemplo:

```text
GET /api/usuarios/5
```

### Permiso

```text
Administrador
```

Si no existe:

```text
404 Not Found
```

---

## POST /api/usuarios

Crea un Usuario desde administración.

### Permiso

```text
Administrador + CSRF
```

### Body

```json
{
  "nombre": "Andrea",
  "apellido": "Torres",
  "correo": "andrea@example.invalid",
  "telefono": "3001234567",
  "password": "Una-clave-segura-de-prueba",
  "rol": "Comerciante",
  "estado": "Activo"
}
```

Roles:

```text
Administrador
Comerciante
Comprador
```

Estados:

```text
Activo
Inactivo
```

### Respuesta

```text
201 Created
```

---

## PUT /api/usuarios/:id

Actualiza parcialmente un Usuario existente.

Aunque se utiliza `PUT`, el Service conserva los campos omitidos.

Puede modificar campos autorizados como:

```text
nombre
apellido
correo
telefono
password
rol
estado
```

Cambiar:

```text
password
rol
estado
```

puede revocar las sesiones activas del Usuario.

La aplicación evita dejar el sistema sin ningún Administrador activo.

---

## DELETE /api/usuarios/:id

Elimina físicamente un Usuario cuando el dominio lo permite.

No permite:

```text
eliminar la propia cuenta del Administrador
eliminar un Usuario con Negocio
eliminar un Usuario con Reservas
eliminar un Usuario con Pedidos históricos
eliminar el último Administrador activo
```

Cuando existe historial que debe conservarse, se recomienda:

```text
estado = Inactivo
```

en lugar de eliminar.

---

# DTO de Usuario

Campos típicos:

```text
id
rolId
rol
nombre
apellido
correo
telefono
estado
createdAt
```

`createdAt` corresponde a:

```text
usuario.fecha_registro
```

Nunca se expone:

```text
passwordHash
contrasena_hash
password
```

---

# Categorías

## GET /api/categorias

Endpoint público.

Devuelve únicamente Categorías con:

```text
estado = Activo
```

Respuesta típica:

```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "nombre": "Alimentos",
      "descripcion": "Productos alimenticios y de consumo",
      "estado": "Activo"
    }
  ]
}
```

No existe CRUD HTTP público de Categorías actualmente.

Tampoco existe CRUD HTTP de Roles.

---

# Negocios

---

## GET /api/negocios

Consulta Negocios.

Sin modo de gestión devuelve únicamente Negocios activos.

### Filtros disponibles

```text
?buscar=
?categoria=
?usuarioId=
?estado=
?gestion=true
```

`estado` tiene utilidad principalmente dentro del modo de gestión.

---

## GET /api/negocios/:id

Consulta un Negocio.

Un Negocio inactivo solo puede ser visible para:

```text
Administrador
Comerciante propietario
```

---

## POST /api/negocios

Crea un Negocio.

### Permiso

```text
Comerciante
Administrador
+
CSRF
```

### Body

```json
{
  "nombre": "Café Pereira",
  "categoria": "Café y panadería",
  "telefono": "3001234567",
  "direccion": "Calle 10 # 20-30",
  "descripcion": "Café local",
  "municipio": "Pereira"
}
```

Campos principales:

```text
nombre
categoria
telefono
direccion
```

Opcionales:

```text
descripcion
municipio
estado
usuarioId
```

Para un Comerciante normal, el propietario es el Usuario autenticado.

Un Comerciante no puede asignar su Negocio a otro Usuario.

Un Administrador puede seleccionar un `usuarioId`, pero dicho Usuario debe tener rol Comerciante.

---

# Regla: un Negocio por Comerciante

El sistema permite como máximo:

```text
1 Negocio por Comerciante
```

La regla se valida en la aplicación y también mediante:

```text
UNIQUE(id_usuario)
```

en MySQL.

---

## PUT /api/negocios/:id

Actualiza un Negocio.

### Permiso

```text
Administrador
o
Comerciante propietario
```

Requiere CSRF.

---

## DELETE /api/negocios/:id

Elimina físicamente un Negocio únicamente cuando no exista información incompatible con la eliminación.

Por ejemplo, puede rechazarse si existen:

```text
Productos
Servicios
Pedidos históricos
```

En recursos con historial se prefiere desactivar.

---

# DTO de Negocio

Campos típicos:

```text
id
usuarioId
categoriaId
nombre
categoria
propietario
descripcion
municipio
telefono
direccion
estado
createdAt
```

`createdAt` corresponde a:

```text
negocio.fecha_registro
```

---

# Productos

---

## GET /api/productos

Consulta Productos visibles.

### Filtros

```text
?buscar=
?categoria=
?negocioId=
?estado=
?gestion=true
```

Sin gestión, solo se muestran Productos activos pertenecientes a Negocios activos.

Un Producto con:

```text
stock = 0
```

puede seguir apareciendo en catálogo.

Estar agotado no equivale a tener estado Inactivo.

---

## GET /api/productos/:id

Consulta un Producto específico.

Los Productos inactivos pueden ser consultados por:

```text
Administrador
Comerciante propietario
```

cuando corresponde.

---

## POST /api/productos

Crea un Producto.

### Permiso

```text
Administrador
o
Comerciante propietario del Negocio
+
CSRF
```

### Body

```json
{
  "negocioId": 3,
  "nombre": "Café especial",
  "descripcion": "Café producido en Risaralda",
  "categoria": "Café y panadería",
  "precio": 25000,
  "stock": 15,
  "imagen": "data:image/webp;base64,...",
  "estado": "Activo"
}
```

### Reglas

`negocioId` debe corresponder a un Negocio existente y autorizado.

`nombre`:

```text
máximo 120 caracteres
```

`descripcion`:

```text
máximo 2000 caracteres
```

`categoria`:

```text
categoría existente y válida
```

`precio`:

```text
> 0
máximo 1.000.000.000
máximo dos decimales
```

`stock`:

```text
entero
0 a 1.000.000
```

`imagen` debe ser un Data URL válido:

```text
JPEG
PNG
WEBP
```

con máximo aproximado de:

```text
1.800.000 caracteres
```

---

# Visitas de Producto

## POST /api/productos/:id/visita

Incrementa el contador:

```text
visitas
```

No requiere sesión.

Tiene rate limiting.

Solo funciona cuando el Producto es públicamente visible y tiene:

```text
stock > 0
```

`popularidad` puede aparecer como alias de compatibilidad del valor `visitas`.

No debe enviarse desde el cliente durante creación o edición.

---

# DTO de Producto

Campos típicos:

```text
id
negocioId
categoriaId
nombre
descripcion
categoria
precio
stock
imagen
estado
visitas
popularidad
```

Actualmente Producto no tiene una columna física de fecha de creación en el esquema MySQL aprobado.

Por tanto, el cliente no debe requerir:

```text
createdAt
updatedAt
```

para Producto.

---

## PUT /api/productos/:id

Actualiza parcialmente un Producto.

El Comerciante solo puede modificar Productos de su propio Negocio.

Un Producto que participa en Pedidos históricos no puede trasladarse libremente a otro Negocio.

---

## DELETE /api/productos/:id

Elimina un Producto cuando no exista historial que deba conservarse.

Si está referenciado por Detalle_Pedido:

```text
409 Conflict
```

y debe utilizarse:

```text
estado = Inactivo
```

---

# Servicios

---

## GET /api/servicios

Consulta Servicios.

### Filtros

```text
?negocioId=
?categoria=
?buscar=
?estado=
?gestion=true
```

Sin modo gestión, un Servicio debe tener:

```text
Servicio Activo
Negocio Activo
Categoria Activa
```

para ser público.

El filtro `estado` requiere gestión autorizada.

---

## GET /api/servicios/:id

Consulta un Servicio.

Los inactivos solo son visibles durante gestión autorizada.

---

## POST /api/servicios

Crea un Servicio.

### Body

```json
{
  "negocioId": 3,
  "categoria": "Servicios",
  "nombre": "Mantenimiento de equipos",
  "descripcion": "Servicio técnico",
  "precioReferencia": 50000,
  "duracionMinutos": 60,
  "capacidadSimultanea": 1,
  "estado": "Activo"
}
```

### Reglas

`precioReferencia`:

```text
0 a 1.000.000.000
máximo dos decimales
```

Un valor:

```text
0
```

puede significar:

```text
consultar / cotizar
```

`duracionMinutos`:

```text
entero positivo
```

El dominio actual limita su valor a:

```text
1 a 1440
```

`capacidadSimultanea`:

```text
mínimo 1
```

El dominio actual limita su valor máximo a:

```text
100
```

---

# DTO de Servicio

Campos típicos:

```text
id
negocioId
categoriaId
nombre
descripcion
categoria
precioReferencia
estado
duracionMinutos
capacidadSimultanea
```

Actualmente Servicio no posee timestamp de creación dentro del esquema MySQL aprobado.

---

## PUT /api/servicios/:id

Actualiza un Servicio.

Puede rechazarse con:

```text
409 Conflict
```

si el cambio rompe información relacionada.

Ejemplos:

```text
trasladar un Servicio con Reservas a otro Negocio
reducir capacidad por debajo de Reservas existentes
cambiar duración cuando afecta Reservas confirmadas
```

---

## DELETE /api/servicios/:id

Elimina el Servicio cuando no tenga Reservas que deban conservarse.

Cuando existe historial:

```text
409 Conflict
```

Se recomienda utilizar:

```text
estado = Inactivo
```

---

# Horarios de Servicio

## GET /api/servicios/:id/horarios

Devuelve los Horarios de un Servicio visible.

Respuesta típica:

```json
{
  "ok": true,
  "data": [
    {
      "id": 10,
      "servicioId": 5,
      "diaSemana": 1,
      "horaInicio": "09:00",
      "horaFin": "12:00"
    }
  ]
}
```

---

## POST /api/servicios/:id/horarios

Crea un Horario.

### Permiso

```text
Administrador
o
Comerciante propietario
+
CSRF
```

### Body

```json
{
  "diaSemana": 1,
  "horaInicio": "09:00",
  "horaFin": "12:00"
}
```

`diaSemana` utiliza:

```text
1 = Lunes
2 = Martes
3 = Miércoles
4 = Jueves
5 = Viernes
6 = Sábado
7 = Domingo
```

Las horas utilizan:

```text
HH:mm
```

La hora inicial debe ser menor que la final.

El horario debe permitir al menos una duración completa del Servicio.

No se permiten Horarios superpuestos para el mismo Servicio y día.

---

## PUT /api/horarios-servicio/:id

Actualiza un Horario existente.

No permite trasladarlo arbitrariamente a otro Servicio.

---

## DELETE /api/horarios-servicio/:id

Elimina el Horario.

Las Reservas existentes no se eliminan automáticamente por esta operación de aplicación.

---

# Disponibilidad

## GET /api/servicios/:id/disponibilidad

Query requerida:

```text
?fecha=YYYY-MM-DD
```

Ejemplo:

```text
GET /api/servicios/5/disponibilidad?fecha=2026-12-10
```

Respuesta conceptual:

```json
{
  "ok": true,
  "data": {
    "servicioId": 5,
    "fecha": "2026-12-10",
    "zonaHoraria": "America/Bogota",
    "slots": [
      {
        "fechaHoraInicio": "2026-12-10T14:00:00.000Z",
        "capacidadTotal": 3,
        "cuposOcupados": 1,
        "cuposDisponibles": 2,
        "disponible": true
      }
    ]
  }
}
```

La Disponibilidad no se almacena en una tabla.

Se calcula utilizando:

```text
Horario
+
Duración
+
Capacidad
+
Reservas Confirmadas
```

El GET es informativo.

La capacidad se vuelve a comprobar durante el POST de Reserva.

---

# Reservas

---

## GET /api/reservas/mias

Devuelve las Reservas del Comprador autenticado.

### Permiso

```text
Comprador
```

Cada Reserva puede proyectar además información del Servicio y Negocio relacionados.

---

## GET /api/reservas/gestion

Permite gestionar Reservas recibidas.

### Permiso

```text
Comerciante
Administrador
```

Filtros:

```text
?negocioId=
?servicioId=
```

Un Comerciante solo puede acceder a Reservas relacionadas con sus Servicios.

---

## GET /api/reservas/:id

Consulta una Reserva.

Puede acceder:

```text
Comprador propietario
Comerciante propietario del Servicio
Administrador
```

---

## POST /api/reservas

Crea una Reserva.

### Permiso

```text
Comprador + CSRF
```

### Body

```json
{
  "servicioId": 8,
  "fechaHoraInicio": "2026-12-10T14:00:00.000Z"
}
```

No se acepta:

```text
usuarioId
```

El Usuario se obtiene directamente de la sesión.

### Validaciones

La fecha debe:

```text
estar en el futuro
corresponder a un slot válido
tener capacidad disponible
pertenecer a un Servicio público
```

Una Reserva nueva nace como:

```text
Confirmada
```

---

# DTO de Reserva

Campos principales:

```text
id
usuarioId
servicioId
fechaHoraInicio
estado
createdAt
```

`createdAt` corresponde a:

```text
reserva.fecha_creacion
```

Cuando se proyecta para determinadas pantallas también puede incluir:

```text
servicio
negocio
```

---

## PATCH /api/reservas/:id/cancelar

Cancela una Reserva.

Requiere:

```text
sesión
autorización
CSRF
```

La operación es idempotente.

Si ya está Cancelada, continúa devolviendo la Reserva cancelada sin crear otra operación.

No existe DELETE físico de Reserva mediante la API.

---

# Favoritos

---

## GET /api/favoritos

Devuelve los Favoritos del Comprador autenticado.

### Permiso

```text
Comprador
```

Cada elemento puede contener:

```text
producto
disponible
```

Si el Producto dejó de ser públicamente visible:

```json
{
  "producto": null,
  "disponible": false
}
```

Esto permite conservar la asociación hasta que el usuario decida quitarla sin exponer información privada.

---

## POST /api/favoritos

Agrega un Producto a Favoritos.

### Body

```json
{
  "productoId": 15
}
```

### Permiso

```text
Comprador + CSRF
```

No se acepta `usuarioId`.

El Usuario se obtiene de la sesión.

Un Producto no puede agregarse dos veces.

Duplicado:

```text
409 Conflict
```

---

# DTO de Favorito

Campos principales:

```text
id
usuarioId
productoId
createdAt
```

`createdAt` corresponde a:

```text
favorito.fecha_agregado
```

En listados también puede incluir:

```text
producto
disponible
```

---

## DELETE /api/favoritos/:id

Elimina un Favorito.

El ID corresponde al:

```text
Favorito
```

no al Producto.

Solo el propietario puede eliminarlo.

---

# Pedidos

---

## POST /api/pedidos

Crea uno o varios Pedidos a partir del carrito.

### Permiso

```text
Comprador + CSRF
```

### Body

```json
{
  "items": [
    {
      "productoId": 15,
      "cantidad": 2
    },
    {
      "productoId": 31,
      "cantidad": 1
    }
  ],
  "observaciones": "Entregar en horario comercial"
}
```

Solo se permiten las claves:

```text
items
observaciones
```

Dentro de cada item:

```text
productoId
cantidad
```

No se permiten campos proporcionados por el cliente como:

```text
usuarioId
negocioId
precioUnitario
precio
subtotal
total
estado
```

Esos datos se determinan en el servidor.

---

# Límites del Pedido

Cantidad de líneas de entrada:

```text
1 a 100
```

Cantidad consolidada por Producto:

```text
1 a 1000
```

Observaciones:

```text
máximo 2000 caracteres
```

Los Productos repetidos en el mismo body se consolidan antes de procesarse.

---

# Agrupación por Negocio

Un mismo carrito puede contener Productos de varios Negocios.

Ejemplo:

```text
Producto A → Negocio 1
Producto B → Negocio 1
Producto C → Negocio 2
```

El backend genera:

```text
Pedido 1 → Negocio 1
Pedido 2 → Negocio 2
```

Todo ocurre dentro de una única transacción.

---

# Pedido all-or-nothing

La creación es:

```text
todo o nada
```

Si cualquier Producto falla por:

```text
stock
estado
precio
Negocio inactivo
Categoria inactiva
error de escritura
```

la transacción completa se revierte.

No deben quedar Pedidos o descuentos de stock parciales.

---

# Precio del Pedido

El frontend no decide el precio.

El backend consulta:

```text
producto.precio
```

y lo copia a:

```text
detalle_pedido.precio_unitario
```

Esto conserva el precio histórico.

---

# Stock

Antes de confirmar, el backend comprueba:

```text
stock actual >= cantidad solicitada
```

Si no hay suficiente:

```text
409 Conflict
```

Después descuenta el stock dentro de la misma transacción.

---

# DTO de Pedido

Campos principales:

```text
id
usuarioId
negocioId
estado
observaciones
createdAt
fecha
negocio
detalles
total
```

`createdAt` corresponde a:

```text
pedido.fecha_pedido
```

`fecha` es un alias utilizado por la proyección del Service:

```text
fecha = createdAt
```

`total` se calcula dinámicamente.

No se almacena una columna `total` dentro de Pedido.

---

# DTO de Detalle_Pedido

Campos principales:

```text
id
pedidoId
productoId
cantidad
precioUnitario
nombre
subtotal
```

Actualmente Detalle_Pedido no posee una fecha física de creación dentro del esquema MySQL.

`nombre` se obtiene del Producto relacionado.

`precioUnitario` es histórico.

`subtotal` se calcula:

```text
cantidad × precioUnitario
```

---

## GET /api/pedidos/mios

Devuelve los Pedidos del Comprador autenticado.

### Permiso

```text
Comprador
```

Se ordenan del ID más reciente al más antiguo.

---

## GET /api/pedidos/gestion

Gestiona Pedidos recibidos.

### Permiso

```text
Comerciante
Administrador
```

Filtros:

```text
?negocioId=
?estado=
```

Un Comerciante únicamente obtiene los Pedidos correspondientes a su Negocio.

---

## GET /api/pedidos/:id

Consulta un Pedido.

Puede acceder:

```text
Comprador propietario
Comerciante propietario del Negocio
Administrador
```

---

# Estados de Pedido

Estados válidos:

```text
Pendiente
Confirmado
Completado
Cancelado
```

Transiciones permitidas:

```text
Pendiente
├── Confirmado
└── Cancelado

Confirmado
├── Completado
└── Cancelado

Completado
└── terminal

Cancelado
└── terminal
```

No se permite:

```text
Pendiente → Completado
Cancelado → otro estado
Completado → otro estado
```

---

## PATCH /api/pedidos/:id/estado

### Permiso

```text
Comerciante propietario
Administrador
+
CSRF
```

Body:

```json
{
  "estado": "Confirmado"
}
```

El Comprador no utiliza este endpoint.

---

## PATCH /api/pedidos/:id/cancelar

Cancela un Pedido.

Puede utilizarlo:

```text
Comprador propietario
Comerciante propietario
Administrador
```

pero las reglas dependen del estado y rol.

El Comprador solo puede cancelar su Pedido cuando está:

```text
Pendiente
```

Comerciante y Administrador pueden cancelar según las transiciones permitidas.

---

# Restauración de stock

Al cancelar un Pedido que todavía puede cancelarse:

```text
Detalle_Pedido
↓
cantidad
↓
Producto.stock += cantidad
```

La restauración ocurre dentro de la misma transacción que cambia el estado.

No debe ejecutarse dos veces.

Si el Pedido ya está:

```text
Cancelado
```

repetir `/cancelar` no vuelve a sumar stock.

---

# Eliminación de Pedidos

No existe:

```text
DELETE /api/pedidos/:id
```

Los Pedidos constituyen historial.

Tampoco existe CRUD HTTP directo de Detalle_Pedido.

Los detalles son gestionados internamente durante el flujo del Pedido.

---

# Resumen público

## GET /api/publico/resumen

Endpoint público.

Respuesta conceptual:

```json
{
  "ok": true,
  "data": {
    "comercios": 8,
    "productos": 25,
    "usuarios": 15,
    "categorias": 10
  }
}
```

Los conteos se calculan desde los Services.

No devuelve información privada de las cuentas.

---

# Salud

## GET /api/salud

Permite comprobar que Express está respondiendo.

Respuesta:

```json
{
  "ok": true,
  "data": {
    "estado": "disponible"
  }
}
```

Este endpoint confirma disponibilidad HTTP básica del backend.

---

# Códigos HTTP

## 200 OK

Operación completada correctamente.

Ejemplos:

```text
GET
PUT
PATCH
DELETE lógico o autorizado
```

---

## 201 Created

Un recurso nuevo fue creado.

Ejemplos:

```text
POST /api/usuarios
POST /api/productos
POST /api/reservas
POST /api/favoritos
POST /api/pedidos
```

---

## 400 Bad Request

Datos inválidos.

Ejemplos:

```text
campos no permitidos
correo inválido
precio inválido
ID inválido
horario incorrecto
JSON mal formado
```

---

## 401 Unauthorized

No existe una sesión válida cuando la operación la requiere.

Ejemplo:

```json
{
  "ok": false,
  "mensaje": "Inicia sesión para continuar."
}
```

---

## 403 Forbidden

Existe sesión pero el Usuario no tiene autorización.

Ejemplos:

```text
rol incorrecto
recurso de otro Comerciante
Favorito de otro Comprador
CSRF incorrecto
origen no permitido
```

---

## 404 Not Found

El recurso:

```text
no existe
```

o no debe exponerse públicamente.

También se utiliza para ocultar ciertos recursos inactivos a usuarios no autorizados.

---

## 409 Conflict

La petición es válida sintácticamente pero entra en conflicto con el estado actual.

Ejemplos:

```text
stock insuficiente
Favorito duplicado
Horario superpuesto
Servicio con Reservas
Producto con Pedidos históricos
transición de Pedido inválida
sin capacidad disponible
```

---

## 413 Payload Too Large

El JSON supera el límite permitido.

---

## 415 Unsupported Media Type

La API rechaza cuerpos comprimidos.

---

## 429 Too Many Requests

El cliente superó un límite de solicitudes.

Puede incluir:

```http
Retry-After
```

---

## 500 Internal Server Error

Error interno no controlado.

La respuesta no incluye:

```text
stack trace
SQL
credenciales
detalles internos de persistencia
```

---

# Rate limiting

Existe limitación general sobre las rutas `/api`.

También existen límites específicos para operaciones como:

```text
login
registro
visita de Producto
```

Los rate limits actuales viven en memoria del proceso Node.js.

Al reiniciar el servidor, sus contadores se reinician.

---

# Seguridad de origen

En operaciones distintas de:

```text
GET
HEAD
OPTIONS
```

la API verifica el origen de la solicitud.

También rechaza solicitudes identificadas como:

```text
cross-site
```

mediante `Sec-Fetch-Site`.

---

# Headers de seguridad

El backend configura headers como:

```text
X-Content-Type-Options
Referrer-Policy
X-Frame-Options
Permissions-Policy
Content-Security-Policy
```

En producción también puede establecer:

```text
Strict-Transport-Security
```

---

# Content Security Policy

La política actual limita fuentes de:

```text
scripts
styles
fonts
images
connections
frames
objects
forms
```

El objetivo es reducir la ejecución o carga de contenido no autorizado.

---

# Validación de campos extra

Los Services utilizan una estrategia de lista permitida.

Por ejemplo, si un endpoint acepta:

```text
nombre
precio
stock
```

y el cliente intenta enviar:

```json
{
  "nombre": "Producto",
  "precio": 10000,
  "stock": 5,
  "admin": true
}
```

el campo:

```text
admin
```

provoca:

```text
400 Bad Request
```

Esto evita aceptar silenciosamente propiedades que el cliente no debería controlar.

---

# IDs

Los parámetros de ruta utilizan IDs enteros positivos.

Ejemplo válido:

```text
/api/productos/12
```

Ejemplos inválidos:

```text
/api/productos/0
/api/productos/-2
/api/productos/abc
```

producen:

```text
400 Bad Request
```

---

# Autorización

Reactiva Pereira diferencia:

```text
Autenticación
```

de:

```text
Autorización
```

Autenticación responde:

```text
¿Quién eres?
```

Autorización responde:

```text
¿Puedes realizar esta operación?
```

Ejemplo:

```text
Usuario autenticado: Comerciante
↓
intenta editar Producto
↓
backend consulta el Negocio
↓
comprueba propietario
↓
permite o rechaza
```

El frontend puede ocultar controles según el rol, pero la autorización definitiva siempre ocurre en el backend.

---

# API y Repository

La API trabaja con nombres JavaScript.

Ejemplo:

```json
{
  "negocioId": 3,
  "categoria": "Alimentos",
  "precio": 25000
}
```

El Repository transforma los datos al esquema SQL.

Ejemplo:

```text
negocioId
↓
id_negocio
```

El frontend nunca necesita conocer directamente:

```text
id_negocio
id_producto
contrasena_hash
```

como nombres físicos internos de la base.

---

# Persistencia

Con:

```text
DATA_SOURCE=mysql
```

una petición:

```text
POST /api/productos
```

termina conceptualmente en:

```text
INSERT INTO producto
```

y una petición:

```text
GET /api/productos
```

termina conceptualmente en:

```text
SELECT ...
FROM producto
```

a través del Repository.

---

# Memory y MySQL

Los mismos Services pueden trabajar contra:

```text
Memory Repository
```

o:

```text
MySQL Repository
```

Esto permite ejecutar muchas pruebas sin necesitar un servidor SQL.

Sin embargo, el contrato HTTP debe basarse en campos de dominio reales y no depender de campos temporales que solo genere el Repository Memory.

Especialmente:

```text
updatedAt
```

no debe considerarse obligatorio.

---

# Endpoints inexistentes

Actualmente no existen endpoints REST para:

```text
Pagos
Facturas
Inventario
Carrito persistente
Disponibilidad como entidad
Métodos de pago
```

El carrito vive en el frontend hasta que se convierte en Pedido.

La disponibilidad se calcula dinámicamente.

El sistema no procesa pagos reales.

---

# Resumen de endpoints

```text
AUTENTICACIÓN

POST   /api/auth/registro
POST   /api/auth/login
GET    /api/auth/me
GET    /api/auth/sesion
POST   /api/auth/logout


USUARIOS

GET    /api/usuarios
GET    /api/usuarios/:id
POST   /api/usuarios
PUT    /api/usuarios/:id
DELETE /api/usuarios/:id


CATEGORÍAS

GET    /api/categorias


NEGOCIOS

GET    /api/negocios
GET    /api/negocios/:id
POST   /api/negocios
PUT    /api/negocios/:id
DELETE /api/negocios/:id


PRODUCTOS

GET    /api/productos
GET    /api/productos/:id
POST   /api/productos
PUT    /api/productos/:id
DELETE /api/productos/:id
POST   /api/productos/:id/visita


SERVICIOS

GET    /api/servicios
GET    /api/servicios/:id
POST   /api/servicios
PUT    /api/servicios/:id
DELETE /api/servicios/:id


HORARIOS

GET    /api/servicios/:id/horarios
POST   /api/servicios/:id/horarios
PUT    /api/horarios-servicio/:id
DELETE /api/horarios-servicio/:id


DISPONIBILIDAD

GET    /api/servicios/:id/disponibilidad


RESERVAS

GET    /api/reservas/mias
GET    /api/reservas/gestion
GET    /api/reservas/:id
POST   /api/reservas
PATCH  /api/reservas/:id/cancelar


FAVORITOS

GET    /api/favoritos
POST   /api/favoritos
DELETE /api/favoritos/:id


PEDIDOS

POST   /api/pedidos
GET    /api/pedidos/mios
GET    /api/pedidos/gestion
GET    /api/pedidos/:id
PATCH  /api/pedidos/:id/cancelar
PATCH  /api/pedidos/:id/estado


OTROS

GET    /api/publico/resumen
GET    /api/salud
```

---

# Flujo completo de ejemplo

Un Comprador realiza un Pedido:

```text
Comprador
↓
carrito.html
↓
JavaScript
↓
fetch()
↓
POST /api/pedidos
↓
cookie de sesión
↓
CSRF
↓
Express
↓
pedido.routes.js
↓
pedido.controller.js
↓
pedido.service.js
↓
repos.transaccion()
↓
bloquear Productos
↓
validar stock
↓
crear Pedido
↓
crear Detalle_Pedido
↓
descontar stock
↓
COMMIT
↓
JSON 201
↓
Frontend
↓
limpiar carrito
```

Este recorrido resume la separación de responsabilidades utilizada en Reactiva Pereira.