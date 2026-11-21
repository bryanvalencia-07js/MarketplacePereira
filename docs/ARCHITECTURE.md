# Arquitectura — Reactiva Pereira

## Propósito

Reactiva Pereira utiliza una arquitectura web por capas.

El objetivo es separar:

```text id="vmp3ut"
interfaz
lógica HTTP
reglas de negocio
persistencia
base de datos
```

para evitar que una sola parte de la aplicación concentre todas las responsabilidades.

La arquitectura principal es:

```text id="76c8fv"
Usuario
↓
Frontend
↓
fetch()
↓
HTTP
↓
Express
↓
Route
↓
Controller
↓
Service
↓
Repository
↓
MySQL / MariaDB
```

La respuesta realiza el camino inverso:

```text id="d2a3p3"
MySQL / MariaDB
↓
Repository
↓
Service
↓
Controller
↓
HTTP Response
↓
JSON
↓
Frontend
↓
DOM
↓
Usuario
```

---

# Principio fundamental

El frontend nunca se conecta directamente a MySQL.

La única forma normal de acceder a los datos es:

```text id="e8r48b"
Frontend
↓
API REST
↓
Backend
↓
Repository
↓
Base de datos
```

Esto permite aplicar en el servidor:

```text id="gr4mah"
autenticación
autorización
validación
reglas de negocio
transacciones
manejo de errores
seguridad
```

antes de acceder o modificar información.

---

# Estructura general

```text id="xxylnt"
MarketplacePereira/
│
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── data/
│   ├── db/
│   ├── middleware/
│   ├── repositories/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   └── app.js
│
├── frontend/
│   ├── assets/
│   ├── css/
│   ├── js/
│   └── *.html
│
├── docs/
│
├── tests/
│
├── scripts/
│
└── .github/
```

---

# Backend

El backend está desarrollado con:

```text id="e7r96c"
Node.js
Express
JavaScript
mysql2/promise
```

Su responsabilidad es:

```text id="e2mkx4"
recibir Requests
↓
validar
↓
autorizar
↓
ejecutar reglas
↓
consultar o modificar datos
↓
devolver Responses JSON
```

---

# app.js

Archivo:

```text id="nhfmf6"
backend/app.js
```

Es la raíz de composición del backend.

Su responsabilidad principal es ensamblar:

```text id="lrlri6"
Express
Middleware
Repositories
Services
Routes
Frontend estático
Manejo de errores
```

Conceptualmente:

```text id="aybstp"
createApplication()
↓
crear Express
↓
preparar Repository
↓
crear Services
↓
registrar Middleware
↓
registrar Routes
↓
servir frontend
↓
registrar errorHandler
```

La función:

```javascript id="1xr4qi"
createApplication(...)
```

permite además inyectar Repositories diferentes durante las pruebas.

Eso evita que todos los tests necesiten una base MySQL real.

---

# Arranque del servidor

Cuando `backend/app.js` se ejecuta directamente:

```text id="f0rmi8"
configuración
↓
Repository
↓
createApplication()
↓
app.listen()
```

La configuración determina, entre otras cosas:

```text id="ivvo2c"
PORT
DATA_SOURCE
conexión DB
APP_ORIGIN
NODE_ENV
Administrador inicial opcional
```

---

# Config

Carpeta:

```text id="wpl8b7"
backend/config/
```

Archivo principal:

```text id="150lr8"
backend/config/index.js
```

Lee variables de entorno como:

```text id="12155o"
PORT
DATA_SOURCE

DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD

APP_ORIGIN

ADMIN_EMAIL
ADMIN_PASSWORD
```

No contiene credenciales reales escritas directamente en el código.

---

# Routes

Carpeta:

```text id="ckcgl2"
backend/routes/
```

Las Routes relacionan:

```text id="05h7j7"
Método HTTP
+
URL
+
Middleware
+
Controller
```

Ejemplo conceptual:

```javascript id="0qclj4"
router.post(
  "/productos",
  roles("Administrador", "Comerciante"),
  csrf,
  controller.crear
);
```

La Route decide:

```text id="w25699"
qué URL existe
qué método HTTP utiliza
qué Middleware debe ejecutarse
qué Controller continúa el proceso
```

No debe contener consultas SQL ni reglas complejas del negocio.

---

# Controllers

Carpeta:

```text id="3vbyb3"
backend/controllers/
```

El Controller funciona como puente entre HTTP y la lógica de negocio.

Recibe:

```text id="36gm35"
req
```

y utiliza:

```text id="4gzcg9"
res
```

para responder.

Por ejemplo:

```text id="5er1by"
req.params
req.query
req.body
req.usuario
```

pueden convertirse en argumentos para un Service.

Después el resultado se transforma en:

```json id="kgrtb0"
{
  "ok": true,
  "data": {}
}
```

El Controller no debería decidir reglas como:

```text id="tg89pt"
si un Comerciante es propietario
si existe suficiente stock
si una reserva tiene cupo
si un pedido puede cambiar de estado
```

Eso corresponde al Service.

---

# Services

Carpeta:

```text id="jv2wwm"
backend/services/
```

Los Services contienen las reglas de negocio.

Actualmente existen Services para:

```text id="s42v4u"
Auth
Usuario
Categoria
Negocio
Producto
Servicio
Horario
Reserva
Favorito
Pedido
Público
```

Ejemplos:

```text id="yym2pz"
usuario.service.js
negocio.service.js
producto.service.js
servicio.service.js
reserva.service.js
pedido.service.js
```

---

# Responsabilidad de Service

Un Service responde preguntas como:

```text id="63dqta"
¿puede este usuario hacer esta operación?

¿el recurso existe?

¿le pertenece al comerciante?

¿el estado solicitado es válido?

¿hay stock?

¿hay cupo?

¿puede eliminarse?

¿debe conservarse el historial?
```

Ejemplo:

```text id="69dqqs"
POST /api/productos
↓
Route
↓
Controller
↓
ProductoService
```

ProductoService valida:

```text id="92gntp"
Comerciante autorizado
Negocio existente
propiedad del Negocio
nombre
descripción
Categoría
precio
stock
imagen
estado
```

y solo después utiliza el Repository.

---

# Repository Pattern

Carpeta:

```text id="3s4jjr"
backend/repositories/
```

El proyecto utiliza el patrón Repository para separar la lógica de negocio del mecanismo concreto de almacenamiento.

Los Services no ejecutan SQL directamente.

En lugar de:

```javascript id="a5rxnj"
connection.query(...)
```

un Service utiliza operaciones como:

```javascript id="9d9qld"
repos.producto.find(id)
repos.producto.create(datos)
repos.producto.update(id, datos)
repos.producto.delete(id)
```

---

# Contrato del Repository

Archivo:

```text id="5j5e73"
backend/repositories/contract.js
```

Los repositorios principales implementan:

```text id="796k0q"
list()
find()
create()
update()
delete()
```

También existe:

```text id="6yn5gh"
transaccion(callback)
```

y para operaciones de stock:

```text id="eziztb"
bloquearProductos(ids)
```

Los catálogos:

```text id="rb4x4q"
rol
categoria
```

son de lectura dentro del Repository actual y exponen:

```text id="0k9ohr"
list()
find()
```

---

# Dos implementaciones de persistencia

La aplicación dispone de:

```text id="ahgy6e"
Memory Repository
MySQL Repository
```

La selección se realiza con:

```text id="ic8wzs"
DATA_SOURCE
```

---

# Memory Repository

Se utiliza con:

```text id="gbmkgj"
DATA_SOURCE=memory
```

Los datos viven dentro del proceso Node.js.

Arquitectura:

```text id="m71lh3"
Service
↓
Memory Repository
↓
objetos JavaScript
```

Ventajas:

```text id="qy58w1"
rápido para tests
no necesita MySQL
permite aislar escenarios
```

Limitación principal:

```text id="82xldp"
reiniciar Node
↓
se pierden los datos
```

No constituye persistencia permanente.

---

# MySQL Repository

Se utiliza con:

```text id="rylnpr"
DATA_SOURCE=mysql
```

Arquitectura:

```text id="2lazjc"
Service
↓
MySQL Repository
↓
mysql2/promise
↓
MySQL / MariaDB
```

Los datos permanecen después de reiniciar la aplicación.

---

# Selección del Repository

Archivo:

```text id="at82j3"
backend/repositories/index.js
```

Conceptualmente:

```text id="q16j2z"
DATA_SOURCE=memory
↓
createRepositories()


DATA_SOURCE=mysql
↓
createPool()
↓
createMysqlRepositories()
```

Los Services reciben el mismo contrato independientemente del adaptador.

Esta es una de las principales ventajas de la arquitectura.

---

# Ejemplo de desacoplamiento

UsuarioService puede ejecutar:

```javascript id="1wpqo1"
repos.usuario.create(datos)
```

Sin saber si termina en:

```text id="qjddes"
Map / objetos JavaScript
```

o:

```text id="6wsm0w"
INSERT INTO usuario
```

Por tanto:

```text id="8qpmma"
Service
```

depende de una abstracción de persistencia, no directamente del motor SQL.

---

# relations.js

Archivo:

```text id="10iwrn"
backend/repositories/relations.js
```

Contiene normalizaciones compartidas entre ambos adaptadores.

Entre otras cosas resuelve:

```text id="v23scc"
Rol textual
↓
rolId

Categoria textual
↓
categoriaId
```

También valida reglas como:

```text id="6w82ai"
Categoria existente
Categoria activa
Comerciante propietario válido
un Negocio máximo por Comerciante
Negocio existente para Producto/Servicio
```

Esto ayuda a que Memory y MySQL mantengan comportamientos equivalentes.

---

# Traducción JavaScript ↔ SQL

El esquema de base utiliza nombres académicos en snake_case.

El backend utiliza nombres JavaScript en camelCase.

Ejemplos:

| JavaScript | SQL |
|---|---|
| `rolId` | `id_rol` |
| `usuarioId` | `id_usuario` |
| `negocioId` | `id_negocio` |
| `categoriaId` | `id_categoria` |
| `productoId` | `id_producto` |
| `servicioId` | `id_servicio` |
| `pedidoId` | `id_pedido` |
| `passwordHash` | `contrasena_hash` |
| `precioReferencia` | `precio_referencia` |
| `duracionMinutos` | `duracion_minutos` |
| `capacidadSimultanea` | `capacidad_simultanea` |
| `fechaHoraInicio` | `fecha_hora_inicio` |
| `precioUnitario` | `precio_unitario` |

Esta traducción pertenece al:

```text id="hbvq56"
MySQL Repository
```

No al frontend.

---

# DTO

DTO significa:

```text id="l6vo9h"
Data Transfer Object
```

El Repository transforma resultados SQL a objetos cómodos para JavaScript.

Por ejemplo:

```text id="bf2aku"
DECIMAL de MySQL
↓
Number
```

o:

```text id="koc1tp"
TIME 09:00:00
↓
09:00
```

También transforma determinadas fechas a ISO.

---

# Fechas

El esquema actual no tiene fechas técnicas universales.

Algunas entidades tienen una fecha real del dominio:

```text id="m4thbl"
Usuario.fecha_registro
Negocio.fecha_registro
Reserva.fecha_creacion
Favorito.fecha_agregado
Pedido.fecha_pedido
```

El Repository puede proyectarlas como:

```text id="4vfk8t"
createdAt
```

En cambio:

```text id="zmul34"
Producto
Servicio
Horario_Servicio
Detalle_Pedido
```

no tienen actualmente una fecha de creación física en el esquema académico.

`updatedAt` tampoco forma parte del esquema MySQL actual.

Por esta razón los Services y el frontend no deben depender universalmente de ese campo.

---

# Base de datos

Carpeta:

```text id="w2lpio"
backend/db/
```

Contiene:

```text id="2bjeh6"
pool.js
migrate.js
migrations/
```

---

# pool.js

Responsable de crear el pool de conexiones mediante:

```text id="j850wi"
mysql2/promise
```

El pool permite reutilizar conexiones.

También configura:

```text id="q2ghr1"
UTF-8
UTC
SQL estricto
límite de conexiones
timeout
multipleStatements=false
```

---

# migrate.js

Responsable de ejecutar las migraciones SQL.

Proceso:

```text id="dcwuqv"
leer migraciones
↓
ordenarlas
↓
calcular checksum
↓
comprobar schema_migrations
↓
ejecutar pendientes
↓
registrar resultado
```

Las migraciones actuales son:

```text id="674nkh"
001_foundation.sql
002_reference_data.sql
003_services_reservations_favorites.sql
004_orders_and_details.sql
```

---

# Modelo de negocio

El DER contiene once entidades:

```text id="33ic7t"
Rol
Usuario
Categoria
Negocio
Producto
Servicio
Horario_Servicio
Reserva
Favorito
Pedido
Detalle_Pedido
```

No forman parte del DER:

```text id="115tvs"
repository_lock
schema_migrations
```

porque son tablas técnicas.

---

# Mapa entidad → Repository

| Entidad | Repository | Tabla MySQL |
|---|---|---|
| Rol | `repos.rol` | `rol` |
| Categoria | `repos.categoria` | `categoria` |
| Usuario | `repos.usuario` | `usuario` |
| Negocio | `repos.negocio` | `negocio` |
| Producto | `repos.producto` | `producto` |
| Servicio | `repos.servicio` | `servicio` |
| Horario_Servicio | `repos.horario` | `horario_servicio` |
| Reserva | `repos.reserva` | `reserva` |
| Favorito | `repos.favorito` | `favorito` |
| Pedido | `repos.pedido` | `pedido` |
| Detalle_Pedido | `repos.detallePedido` | `detalle_pedido` |

---

# Transacciones

Algunas operaciones necesitan modificar varios registros como una sola unidad.

Ejemplo:

```text id="6z4zmh"
crear Pedido
+
crear Detalles
+
descontar Stock
```

No sería correcto que solo algunas partes quedaran guardadas.

Por eso se utiliza:

```javascript id="axdcdx"
repos.transaccion(async () => {
  ...
});
```

---

# Transacción MySQL

Conceptualmente:

```text id="xzl3qf"
BEGIN
↓
operaciones
↓
COMMIT
```

Si algo falla:

```text id="yczsrf"
ROLLBACK
```

---

# AsyncLocalStorage

El Repository MySQL utiliza:

```text id="kv1td1"
AsyncLocalStorage
```

para conservar la misma conexión durante una transacción.

Así, un Service puede hacer:

```text id="541ez0"
repos.pedido.create()
repos.detallePedido.create()
repos.producto.update()
```

sin recibir manualmente un objeto `connection`.

Internamente todas las operaciones continúan usando la conexión de la misma transacción.

---

# repository_lock

Existe una tabla técnica:

```text id="mx32wy"
repository_lock
```

con una fila:

```text id="xqk05d"
id = 1
```

Durante ciertas transacciones MySQL se ejecuta:

```sql id="z3dyvp"
SELECT id
FROM repository_lock
WHERE id = 1
FOR UPDATE;
```

Esto serializa las escrituras críticas que utilizan el Repository.

Es una solución sencilla y apropiada para el alcance académico actual.

En sistemas con mucha concurrencia podría evolucionarse hacia estrategias de locking más específicas.

---

# Bloqueo de Productos

Los Pedidos además pueden bloquear las filas de Producto que van a modificar.

Conceptualmente:

```sql id="3ewtwx"
SELECT id_producto
FROM producto
WHERE id_producto = ?
FOR UPDATE;
```

Los IDs se bloquean en orden para reducir problemas de concurrencia.

Esto protege operaciones de stock.

---

# Flujo de creación de Pedido

```text id="wt20rk"
Comprador
↓
carrito.html
↓
carrito.js
↓
api.js
↓
POST /api/pedidos
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
consultar Producto
↓
consultar Negocio
↓
consultar Categoria
↓
validar stock y precio
↓
agrupar por Negocio
↓
crear Pedido
↓
crear Detalle_Pedido
↓
descontar Stock
↓
COMMIT
↓
JSON 201
↓
Frontend
```

Si cualquier parte falla:

```text id="3o04z8"
ROLLBACK
```

---

# Flujo de creación de Reserva

```text id="il2u68"
Comprador
↓
detalle-servicio.html
↓
detalle-servicio.js
↓
POST /api/reservas
↓
agenda.routes.js
↓
agenda.controller.js
↓
reserva.service.js
↓
repos.transaccion()
↓
consultar Servicio
↓
validar disponibilidad
↓
validar fecha futura
↓
validar cupo
↓
crear Reserva
↓
COMMIT
↓
JSON 201
```

La disponibilidad mostrada mediante GET es informativa.

Durante POST se vuelve a comprobar.

---

# Concurrencia de Reserva

Dos compradores pueden intentar reservar simultáneamente el último cupo.

El sistema no confía únicamente en el resultado anterior del GET.

Hace:

```text id="5jwl5q"
POST
↓
transacción
↓
bloqueo
↓
recalcular cupo
↓
INSERT
```

Así se reduce el riesgo de sobrepasar la capacidad.

---

# utils

Carpeta:

```text id="66xcl6"
backend/utils/
```

Contiene responsabilidades reutilizables.

---

## validation.js

Centraliza validaciones como:

```text id="25xvbg"
texto
correo
password
entero
ID
opciones permitidas
imagen
campos permitidos
```

---

## errors.js

Contiene:

```text id="a3z25a"
AppError
exigir()
```

Permite lanzar errores controlados con:

```text id="y1jnue"
status HTTP
mensaje seguro
```

---

## password.js

Contiene el sistema de hashing de contraseñas.

Utiliza:

```text id="xxoei4"
scrypt
```

Las contraseñas nunca se guardan directamente.

---

## agenda.js

Contiene reglas relacionadas con:

```text id="gg3rpu"
fechas
zona horaria
slots
duración
capacidad
ocupación
```

La misma lógica puede ser reutilizada independientemente del Repository.

---

# Middleware

Carpeta:

```text id="dt1y5m"
backend/middleware/
```

---

## security.js

Incluye:

```text id="sjle6o"
lectura de cookie
sesión requerida
roles
CSRF
mismo origen
rate limiting
headers de seguridad
CSP
```

La Route aplica estas funciones antes de llegar al Controller.

---

## errors.js

Contiene el Middleware final de errores.

Transforma errores controlados o inesperados en respuestas JSON seguras.

Ejemplo:

```json id="2kvq0n"
{
  "ok": false,
  "mensaje": "Producto no encontrado."
}
```

No devuelve stack traces al navegador.

---

# Autenticación

La aplicación utiliza sesiones almacenadas en memoria del proceso Node.js.

El navegador recibe una cookie:

```text id="5n0v90"
rp_session
```

con:

```text id="usds0p"
HttpOnly
SameSite=Strict
```

La contraseña nunca se guarda en la cookie.

La sesión del servidor relaciona el token con el Usuario autenticado.

---

# Autenticación vs autorización

Autenticación:

```text id="o54zb7"
¿Quién eres?
```

Autorización:

```text id="y7mhlg"
¿Puedes hacer esto?
```

Ejemplo:

```text id="ap2hz3"
cookie válida
↓
Usuario Comerciante
↓
intenta modificar Producto
↓
Service consulta Negocio
↓
comprueba propietario
↓
permitir / rechazar
```

---

# Roles

Roles operativos:

```text id="db4o7r"
Administrador
Comerciante
Comprador
```

La autorización real ocurre en backend.

El frontend solo adapta la experiencia visual.

---

# Propiedad

Un Comerciante no puede modificar cualquier recurso únicamente por tener rol Comerciante.

También debe cumplirse la propiedad.

Ejemplo:

```text id="v3sz94"
Comerciante
↓
Negocio
↓
Producto
```

Para modificar el Producto:

```text id="j8048j"
Producto.negocioId
↓
Negocio.usuarioId
↓
Usuario autenticado
```

deben coincidir.

---

# Un Negocio por Comerciante

La regla existe en:

```text id="rr3zcf"
Service
Repository relations
Base de datos
```

En MySQL:

```text id="f3dya7"
UNIQUE(id_usuario)
```

Esto proporciona defensa en profundidad.

---

# Historial

Algunos recursos no deben eliminarse físicamente cuando poseen información histórica.

Ejemplos:

```text id="cqs860"
Usuario con Pedidos
Negocio con Pedidos
Producto en Detalle_Pedido
Servicio con Reservas
```

En estos casos la aplicación normalmente rechaza DELETE y recomienda:

```text id="i5wjtz"
estado = Inactivo
```

Esto conserva las relaciones históricas.

---

# Frontend

Carpeta:

```text id="p821sr"
frontend/
```

Está desarrollado con:

```text id="iwabqd"
HTML5
CSS3
JavaScript nativo
```

No utiliza React, Vue, Angular ni frameworks CSS.

---

# api.js

Archivo:

```text id="57h5kd"
frontend/js/api.js
```

Centraliza las solicitudes HTTP realizadas por el frontend.

Conceptualmente:

```text id="8wlc1g"
módulo de página
↓
api.js
↓
fetch()
↓
/api
```

Esto evita repetir lógica de Requests en cada página.

---

# sesion.js

Archivo:

```text id="k1kjvz"
frontend/js/sesion.js
```

Gestiona la identidad visible del usuario en el cliente.

Obtiene la sesión real desde el backend.

Puede adaptar:

```text id="wvjjut"
navegación
botones
destinos
logout
```

según el rol.

No sustituye la autorización del servidor.

---

# app-init.js

Archivo:

```text id="tyrb7e"
frontend/js/app-init.js
```

Inicializa comportamiento común de la interfaz.

Ayuda a cargar la lógica correspondiente a cada página y a vincular eventos.

---

# ui.js

Archivo:

```text id="toxd9o"
frontend/js/ui.js
```

Agrupa funciones reutilizables de interfaz.

Ejemplos:

```text id="xxcpap"
mensajes
loading
notificaciones
skeletons
formularios
diálogos
menú móvil
estados visuales
```

---

# estado-local.js

Archivo:

```text id="mzlu83"
frontend/js/estado-local.js
```

Administra determinadas estructuras temporales del navegador.

El caso principal es el carrito.

El carrito no constituye persistencia de negocio.

---

# Carrito

El carrito permanece temporalmente en el navegador.

Conceptualmente:

```text id="hyzlk5"
Comprador
↓
Carrito local
↓
Confirmar
↓
POST /api/pedidos
↓
persistencia MySQL
```

Antes de confirmar, los datos se vuelven a validar contra la API.

El frontend no puede decidir de forma confiable:

```text id="b5fsd5"
precio
stock
Negocio
estado
```

El servidor vuelve a consultar esos valores.

---

# Módulos frontend principales

Entre los módulos actuales se encuentran:

```text id="y0sj7j"
landing.js
marketplace.js
detalle-producto.js
detalle-servicio.js
carrito.js
mi-negocio.js
mis-productos.js
mis-servicios.js
reservas.js
favoritos.js
pedidos.js
usuarios.js
negocios.js
dashboard.js
```

Cada módulo se ocupa principalmente de una pantalla o flujo concreto.

---

# Páginas públicas

Entre las páginas públicas están:

```text id="zwwret"
index.html
marketplace.html
detalle-producto.html
servicios.html
detalle-servicio.html
negocios.html
login.html
registro.html
```

Algunas acciones dentro de ellas pueden requerir autenticación.

---

# Páginas del Comprador

Entre otras:

```text id="ui9ggl"
carrito.html
mis-pedidos.html
mis-reservas.html
favoritos.html
```

---

# Páginas del Comerciante

Entre otras:

```text id="5ckkxi"
mi-negocio.html
mis-productos.html
mis-servicios.html
reservas.html
pedidos.html
```

---

# Páginas administrativas

Entre otras:

```text id="p1dihn"
dashboard.html
usuarios.html
negocios.html
productos.html
mis-servicios.html
reservas.html
pedidos.html
```

El mismo HTML puede utilizar lógica diferente dependiendo del rol.

---

# API como fuente de verdad

Los datos persistentes no deben duplicarse como fuente autoritativa dentro del frontend.

La fuente principal es:

```text id="yrjpus"
API REST
```

y, detrás de ella:

```text id="pf7soa"
Repository
↓
MySQL / MariaDB
```

El DOM únicamente representa una vista temporal de los datos.

---

# Modelo de flujo frontend

Ejemplo para mostrar Productos:

```text id="rlx71m"
productos.html
↓
JavaScript
↓
api.js
↓
GET /api/productos
↓
JSON
↓
render
↓
DOM
```

---

# Seguridad frontend

El frontend no debe contener:

```text id="zdk7hi"
credenciales MySQL
contraseñas
hashes
secretos
tokens privados de servicios externos
```

Tampoco se utiliza `localStorage` para guardar autenticación.

---

# Categorías

Las Categorías reales provienen del backend:

```text id="dyzrcc"
GET /api/categorias
```

El frontend puede asociar un SVG o presentación visual a los nombres conocidos.

La categoría:

```text id="1hmfnv"
Todas
```

es únicamente un filtro de interfaz.

No es una fila de la tabla `categoria`.

---

# Disponibilidad

Disponibilidad tampoco es una entidad persistente.

Se calcula con:

```text id="15sdel"
Servicio
+
Horario_Servicio
+
duración
+
capacidad
+
Reservas Confirmadas
```

Esto evita almacenar información derivada que puede quedar desactualizada.

---

# Totales de Pedido

El total tampoco se almacena directamente.

Se calcula con:

```text id="ac72fv"
Σ (
  Detalle_Pedido.cantidad
  ×
  Detalle_Pedido.precio_unitario
)
```

El precio unitario sí se almacena porque representa información histórica.

---

# Stock

Stock pertenece a:

```text id="auhykk"
Producto
```

No existe entidad Inventario en el alcance actual.

Esto mantiene el modelo más sencillo mientras no existan requerimientos de múltiples almacenes, movimientos de inventario o lotes.

---

# Tabla de responsabilidades

| Capa | Responsabilidad |
|---|---|
| HTML | Estructura visual |
| CSS | Presentación y responsive |
| JavaScript frontend | Interacción y consumo de API |
| `api.js` | Requests HTTP |
| Route | Método, URL y Middleware |
| Controller | Traducir HTTP ↔ Service |
| Service | Reglas del negocio |
| Repository | Persistencia abstracta |
| MySQL Repository | Traducción a SQL |
| `mysql2` | Comunicación con el motor |
| MySQL/MariaDB | Persistencia e integridad |
| Middleware | Seguridad y errores |
| Utils | Lógica reutilizable |

---

# Ejemplo completo: crear Producto

```text id="5drqka"
Comerciante
↓
formulario
↓
JavaScript
↓
api.js
↓
fetch()
↓
POST /api/productos
↓
Express
↓
roles()
↓
csrf()
↓
recurso.controller.js
↓
producto.service.js
↓
validar propietario
↓
validar campos
↓
repos.producto.create()
↓
MySQL Repository
↓
INSERT INTO producto
↓
MariaDB
↓
SELECT del registro creado
↓
DTO
↓
Controller
↓
201 Created
↓
JSON
↓
Frontend
↓
actualizar DOM
```

---

# Ejemplo completo: consultar Producto

```text id="l78ep8"
Visitante
↓
marketplace.html
↓
marketplace.js
↓
api.js
↓
GET /api/productos
↓
Route
↓
Controller
↓
ProductoService
↓
repos.producto.list()
↓
SELECT
↓
MySQL
↓
DTO
↓
JSON
↓
render
```

---

# Ejemplo completo: login

```text id="zr8qrq"
Usuario
↓
login.html
↓
login.js
↓
POST /api/auth/login
↓
auth.controller.js
↓
auth.service.js
↓
buscar Usuario
↓
verificar scrypt
↓
crear sesión
↓
cookie rp_session
↓
csrfToken
↓
Frontend
```

La contraseña nunca vuelve al frontend.

---

# Manejo de errores

Un error puede originarse en:

```text id="pdiyzi"
validación
autorización
Service
Repository
MySQL
```

Los errores esperados utilizan:

```text id="klhdhr"
AppError
```

El Middleware:

```text id="pv1nyc"
errorHandler
```

los convierte en una respuesta uniforme.

Ejemplo:

```json id="1jqz8i"
{
  "ok": false,
  "mensaje": "Stock insuficiente para el producto #15."
}
```

---

# Errores MySQL

El MySQL Repository transforma determinados errores técnicos a mensajes seguros.

Ejemplos:

```text id="b0p321"
ER_DUP_ENTRY
↓
Ya existe un registro con esos datos.


ER_NO_REFERENCED_ROW_2
↓
La relación requiere un recurso existente.


ER_ROW_IS_REFERENCED_2
↓
El registro tiene información relacionada y no puede eliminarse.
```

El frontend no debe recibir sentencias SQL ni información sensible del servidor.

---

# Separación de responsabilidades

Una regla importante del proyecto es:

```text id="oxct2x"
Route
no debe hacer trabajo de Service

Controller
no debe hacer trabajo de Repository

Service
no debe ejecutar SQL

Frontend
no debe decidir autorización real
```

Cada capa debe mantener su responsabilidad.

---

# Ventajas de esta arquitectura

## Mantenibilidad

Un cambio en MySQL puede concentrarse principalmente en:

```text id="fgbwc5"
migraciones
Repository MySQL
```

sin reescribir toda la aplicación.

---

## Pruebas

Los Services pueden probarse utilizando Memory Repository.

No necesitan arrancar una base real para cada prueba.

---

## Persistencia intercambiable

La misma lógica puede utilizar:

```text id="ze3tns"
memory
```

o:

```text id="sl9jb1"
mysql
```

según configuración.

---

## Seguridad

Las reglas están concentradas en el backend.

El navegador no tiene acceso directo a la base.

---

## Claridad

El recorrido de una operación puede explicarse capa por capa.

Eso facilita mantenimiento y sustentación académica.

---

# Integridad en dos niveles

Reactiva Pereira utiliza:

```text id="h1chq2"
reglas de aplicación
+
restricciones de base de datos
```

Ejemplo:

```text id="743q9o"
Un Comerciante solo puede tener un Negocio.
```

La aplicación lo comprueba en Service/Repository.

MySQL además utiliza:

```text id="u77nsk"
UNIQUE(id_usuario)
```

Otro ejemplo:

```text id="bad0io"
stock >= 0
```

Service valida el valor.

MySQL además utiliza:

```sql id="mj54j2"
CHECK (stock >= 0)
```

Esto proporciona defensa en profundidad.

---

# Estado actual de persistencia

La aplicación ya superó la etapa inicial de almacenamiento únicamente temporal.

Actualmente el flujo principal puede ser:

```text id="stnjna"
Frontend
↓
Express
↓
Repository MySQL
↓
MariaDB
```

Los datos permanecen después de:

```text id="wpcgfa"
cerrar Node
reiniciar XAMPP
reiniciar el computador
```

si se vuelve a utilizar la misma base.

Memory continúa existiendo principalmente para pruebas y desarrollo aislado.

---

# Alcance del modelo

Actualmente no existen entidades independientes para:

```text id="ma49b3"
Pago
Factura
Método_Pago
Inventario
Disponibilidad
Sector_Comercial
Carrito
```

No deben añadirse simplemente para aumentar el número de tablas.

Una nueva entidad debe responder a un requerimiento real del sistema.

---

# Evolución futura

Para agregar una nueva funcionalidad persistente:

```text id="a0mvqj"
Requerimiento
↓
revisar modelo
↓
revisar relaciones
↓
crear migración
↓
adaptar Repository
↓
adaptar Service
↓
crear Route / Controller si corresponde
↓
adaptar frontend
↓
probar
↓
documentar
```

Este orden evita comenzar por la interfaz sin definir correctamente el dominio.

---

# Resumen para sustentación

## ¿Por qué existe Controller?

Para separar HTTP de las reglas del negocio.

---

## ¿Por qué existe Service?

Para concentrar validaciones, permisos y reglas del dominio.

---

## ¿Por qué existe Repository?

Para que los Services no dependan directamente de SQL.

---

## ¿Por qué existen Memory y MySQL Repository?

Memory permite pruebas y escenarios temporales.

MySQL proporciona persistencia real.

---

## ¿Quién habla con MySQL?

```text id="eqzd7l"
MySQL Repository
```

mediante:

```text id="vf91y5"
mysql2/promise
```

---

## ¿Puede el frontend hablar con MySQL?

No.

Debe utilizar:

```text id="inw9d3"
fetch()
↓
API REST
```

---

## ¿Dónde se validan los permisos?

Principalmente en:

```text id="yw2rxn"
Middleware
Services
```

---

## ¿Dónde se almacenan las reglas de integridad?

En dos niveles:

```text id="qjxb44"
Services
+
MySQL
```

---

## ¿Qué ocurre si MySQL deja de funcionar?

Si la aplicación está configurada con:

```text id="phpu15"
DATA_SOURCE=mysql
```

las operaciones que necesiten persistencia deben fallar.

La aplicación no debe cambiar silenciosamente a Memory.

---

## ¿Qué ocurre si reinicio Node?

Con MySQL:

```text id="o4lf4s"
los datos persisten
```

pero las sesiones almacenadas en memoria se pierden.

---

## ¿Cuál es el recorrido más importante del sistema?

```text id="cbvwhk"
Usuario
↓
Frontend
↓
fetch()
↓
Route
↓
Controller
↓
Service
↓
Repository
↓
MySQL
↓
JSON
↓
DOM
```

Ese recorrido resume la arquitectura de Reactiva Pereira.