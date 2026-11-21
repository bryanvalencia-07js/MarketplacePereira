# Base de datos — Reactiva Pereira

## Propósito

Reactiva Pereira utiliza una base de datos relacional para almacenar de forma persistente la información principal del marketplace.

La arquitectura de persistencia es:

```text
Frontend
↓
fetch()
↓
API REST
↓
Express
↓
Controller
↓
Service
↓
Repository
↓
mysql2/promise
↓
MySQL / MariaDB
```

El frontend nunca se conecta directamente a la base de datos.

La capa Repository es responsable de traducir entre los objetos utilizados por JavaScript y los nombres físicos utilizados por SQL.

---

# Motor utilizado

El proyecto utiliza SQL compatible con MySQL y MariaDB para las funcionalidades actuales.

Durante el desarrollo local se ha probado con:

```text
XAMPP 8.2.12
MariaDB 10.4.32
```

La integración continua del repositorio utiliza MySQL 8.4.

La conexión desde Node.js se realiza mediante:

```text
mysql2/promise
```

No se utiliza ORM.

---

# Base de datos local

El nombre utilizado actualmente es:

```text
reactiva_pereira
```

El cotejamiento recomendado para el entorno local es:

```text
utf8mb4_unicode_ci
```

`utf8mb4` permite almacenar correctamente caracteres como:

```text
á
é
í
ó
ú
ñ
símbolos
emojis
```

---

# Modelo de datos

El DER aprobado contiene exactamente once entidades de negocio:

```text
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

Las tablas físicas son:

```text
rol
usuario
categoria
negocio
producto
servicio
horario_servicio
reserva
favorito
pedido
detalle_pedido
```

También existen dos tablas técnicas:

```text
repository_lock
schema_migrations
```

Estas dos últimas no forman parte del DER.

---

# Diagrama lógico simplificado

```text
Rol
 │
 │ 1:N
 ↓
Usuario
 │
 ├────────────── 0..1 Negocio
 │                     │
 │                     ├──── 1:N Producto
 │                     │
 │                     ├──── 1:N Servicio
 │                     │            │
 │                     │            ├──── 1:N Horario_Servicio
 │                     │            │
 │                     │            └──── 1:N Reserva
 │                     │
 │                     └──── 1:N Pedido
 │                                  │
 │                                  └──── 1:N Detalle_Pedido
 │
 ├──── 1:N Reserva
 │
 ├──── 1:N Favorito ──── N:1 Producto
 │
 └──── 1:N Pedido


Categoria
 │
 ├──── 1:N Negocio
 ├──── 1:N Producto
 └──── 1:N Servicio
```

---

# Claves

## Primary Key

Una Primary Key o PK identifica de forma única cada fila de una tabla.

Ejemplo:

```text
usuario.id_usuario
```

Dos usuarios nunca pueden compartir el mismo `id_usuario`.

Las PK principales son:

```text
rol.id_rol
categoria.id_categoria
usuario.id_usuario
negocio.id_negocio
producto.id_producto
servicio.id_servicio
horario_servicio.id_horario
reserva.id_reserva
favorito.id_favorito
pedido.id_pedido
detalle_pedido.id_detalle
```

Todas son generadas mediante:

```sql
AUTO_INCREMENT
```

excepto la clave técnica de `repository_lock`.

---

## Foreign Key

Una Foreign Key o FK conecta una tabla con otra.

Ejemplo:

```text
usuario.id_rol
↓
rol.id_rol
```

Esto significa que un Usuario solo puede hacer referencia a un Rol que realmente exista.

Las FK ayudan a mantener la integridad referencial.

---

# 1. Rol

Tabla:

```text
rol
```

Estructura:

| Columna | Tipo | Regla |
|---|---|---|
| `id_rol` | INT | PK, AUTO_INCREMENT |
| `nombre_rol` | VARCHAR(50) | NOT NULL, UNIQUE |
| `descripcion` | VARCHAR(255) | Opcional |

Restricción principal:

```text
nombre_rol UNIQUE
```

No pueden existir dos roles con el mismo nombre.

Los roles operativos cargados actualmente son:

```text
Administrador
Comerciante
Comprador
```

La aplicación resuelve los permisos utilizando el nombre del rol y no debe depender de IDs mágicos como asumir que `1 = Administrador`.

---

# 2. Categoria

Tabla:

```text
categoria
```

Estructura:

| Columna | Tipo | Regla |
|---|---|---|
| `id_categoria` | INT | PK, AUTO_INCREMENT |
| `nombre_categoria` | VARCHAR(80) | NOT NULL, UNIQUE |
| `descripcion` | VARCHAR(255) | Opcional |
| `estado` | VARCHAR(20) | Activo/Inactivo |

Restricción:

```sql
CHECK (estado IN ('Activo', 'Inactivo'))
```

La migración de datos de referencia carga actualmente 24 categorías.

Entre ellas:

```text
Alimentos
Bebidas
Restaurantes
Café y panadería
Ropa
Calzado
Tecnología
Hogar
Belleza
Servicios
Turismo
Entretenimiento
Agro
Otro
```

Categoria es utilizada por:

```text
Negocio
Producto
Servicio
```

---

# 3. Usuario

Tabla:

```text
usuario
```

Estructura:

| Columna | Tipo | Regla |
|---|---|---|
| `id_usuario` | INT | PK, AUTO_INCREMENT |
| `id_rol` | INT | FK → rol |
| `nombre` | VARCHAR(100) | NOT NULL |
| `apellido` | VARCHAR(100) | NOT NULL |
| `correo` | VARCHAR(150) | NOT NULL, UNIQUE |
| `telefono` | VARCHAR(20) | Opcional |
| `contrasena_hash` | VARCHAR(255) | NOT NULL |
| `estado` | VARCHAR(20) | Activo/Inactivo |
| `fecha_registro` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

Relación:

```text
Rol 1:N Usuario
```

FK:

```text
usuario.id_rol
→
rol.id_rol
```

Política:

```text
ON DELETE RESTRICT
```

Esto evita eliminar un Rol mientras existan Usuarios relacionados.

El correo tiene:

```text
UNIQUE
```

por lo que no pueden existir dos cuentas con el mismo correo.

La contraseña nunca se guarda directamente.

El backend genera:

```text
password
↓
scrypt
↓
contrasena_hash
```

---

# 4. Negocio

Tabla:

```text
negocio
```

Estructura:

| Columna | Tipo | Regla |
|---|---|---|
| `id_negocio` | INT | PK |
| `id_categoria` | INT | FK |
| `id_usuario` | INT | FK, UNIQUE |
| `nombre_negocio` | VARCHAR(120) | NOT NULL |
| `descripcion` | TEXT | Opcional |
| `direccion_comercial` | VARCHAR(200) | NOT NULL |
| `municipio` | VARCHAR(80) | Opcional |
| `telefono_contacto` | VARCHAR(20) | NOT NULL |
| `estado` | VARCHAR(20) | Activo/Inactivo |
| `fecha_registro` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

Relaciones:

```text
Usuario 1 : 0..1 Negocio
Categoria 1 : N Negocio
```

La restricción:

```text
UNIQUE(id_usuario)
```

es especialmente importante.

Impide que un mismo Usuario sea propietario de varios Negocios.

Por tanto:

```text
Usuario
↓
máximo un Negocio
```

Las FK hacia Usuario y Categoria utilizan:

```text
ON DELETE RESTRICT
```

para evitar eliminar registros que todavía son necesarios para mantener la relación.

---

# 5. Producto

Tabla:

```text
producto
```

Estructura:

| Columna | Tipo | Regla |
|---|---|---|
| `id_producto` | INT | PK |
| `id_negocio` | INT | FK |
| `id_categoria` | INT | FK |
| `nombre_producto` | VARCHAR(150) | NOT NULL |
| `descripcion` | TEXT | NOT NULL |
| `precio` | DECIMAL(12,2) | > 0 |
| `imagen` | MEDIUMTEXT | Opcional |
| `stock` | INT | >= 0 |
| `visitas` | INT | >= 0 |
| `estado` | VARCHAR(20) | Activo/Inactivo |

Relaciones:

```text
Negocio 1:N Producto
Categoria 1:N Producto
```

Restricciones:

```sql
CHECK (precio > 0)
CHECK (stock >= 0)
CHECK (visitas >= 0)
CHECK (estado IN ('Activo', 'Inactivo'))
```

Un Producto agotado se determina mediante:

```text
stock = 0
```

No existe un estado independiente llamado:

```text
Agotado
```

El stock pertenece directamente a Producto.

Por esta razón el modelo no necesita una entidad adicional `Inventario` en el alcance actual.

---

# 6. Servicio

Tabla:

```text
servicio
```

Estructura:

| Columna | Tipo | Regla |
|---|---|---|
| `id_servicio` | INT | PK |
| `id_negocio` | INT | FK |
| `id_categoria` | INT | FK |
| `nombre_servicio` | VARCHAR(150) | NOT NULL |
| `descripcion` | TEXT | NOT NULL |
| `precio_referencia` | DECIMAL(12,2) | >= 0 |
| `estado` | VARCHAR(20) | Activo/Inactivo |
| `duracion_minutos` | INT | > 0 |
| `capacidad_simultanea` | INT | >= 1 |

Relaciones:

```text
Negocio 1:N Servicio
Categoria 1:N Servicio
```

Restricciones:

```sql
CHECK (precio_referencia >= 0)
CHECK (duracion_minutos > 0)
CHECK (capacidad_simultanea >= 1)
```

Un valor:

```text
precio_referencia = 0
```

puede utilizarse para representar un servicio cuyo precio debe ser consultado.

Las FK hacia Negocio y Categoria usan:

```text
ON DELETE RESTRICT
```

---

# 7. Horario_Servicio

Tabla:

```text
horario_servicio
```

Estructura:

| Columna | Tipo | Regla |
|---|---|---|
| `id_horario` | INT | PK |
| `id_servicio` | INT | FK |
| `dia_semana` | TINYINT | 1 a 7 |
| `hora_inicio` | TIME | NOT NULL |
| `hora_fin` | TIME | NOT NULL |

Los días se representan como:

```text
1 = Lunes
2 = Martes
3 = Miércoles
4 = Jueves
5 = Viernes
6 = Sábado
7 = Domingo
```

Restricciones:

```sql
CHECK (dia_semana BETWEEN 1 AND 7)

CHECK (hora_inicio < hora_fin)
```

Existe además:

```text
UNIQUE(
    id_servicio,
    dia_semana,
    hora_inicio
)
```

para evitar duplicar exactamente el mismo inicio de horario para un Servicio y día.

Relación:

```text
Servicio 1:N Horario_Servicio
```

La FK utiliza:

```text
ON DELETE CASCADE
```

En este caso sí tiene sentido CASCADE porque Horario_Servicio es información completamente dependiente de Servicio.

---

# 8. Reserva

Tabla:

```text
reserva
```

Estructura:

| Columna | Tipo | Regla |
|---|---|---|
| `id_reserva` | INT | PK |
| `id_usuario` | INT | FK |
| `id_servicio` | INT | FK |
| `fecha_hora_inicio` | DATETIME | NOT NULL |
| `estado` | VARCHAR(20) | Confirmada/Cancelada |
| `fecha_creacion` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

Relaciones:

```text
Usuario 1:N Reserva
Servicio 1:N Reserva
```

Estados:

```text
Confirmada
Cancelada
```

Restricción:

```text
UNIQUE(
    id_usuario,
    id_servicio,
    fecha_hora_inicio
)
```

Esto evita que el mismo usuario genere dos reservas idénticas para el mismo Servicio y horario.

Las FK utilizan:

```text
ON DELETE RESTRICT
```

porque las Reservas forman parte del historial del sistema.

---

# 9. Favorito

Tabla:

```text
favorito
```

Favorito funciona como entidad asociativa entre Usuario y Producto.

Conceptualmente:

```text
Usuario N:M Producto
```

La relación muchos a muchos se resuelve mediante:

```text
Favorito
```

Estructura:

| Columna | Tipo | Regla |
|---|---|---|
| `id_favorito` | INT | PK |
| `id_usuario` | INT | FK |
| `id_producto` | INT | FK |
| `fecha_agregado` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

Restricción:

```text
UNIQUE(
    id_usuario,
    id_producto
)
```

Esto impide que el mismo Usuario marque dos veces como favorito el mismo Producto.

Las FK utilizan:

```text
ON DELETE CASCADE
```

porque Favorito es una asociación dependiente.

Si desaparece físicamente el Usuario o Producto, la relación favorita deja de tener sentido.

---

# 10. Pedido

Tabla:

```text
pedido
```

Estructura:

| Columna | Tipo | Regla |
|---|---|---|
| `id_pedido` | INT | PK |
| `id_usuario` | INT | FK |
| `id_negocio` | INT | FK |
| `fecha_pedido` | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| `estado` | VARCHAR(20) | Estado del pedido |
| `observaciones` | VARCHAR(255) | Opcional |

Relaciones:

```text
Usuario 1:N Pedido
Negocio 1:N Pedido
```

Estados permitidos:

```text
Pendiente
Confirmado
Completado
Cancelado
```

Restricción:

```sql
CHECK (
    estado IN (
        'Pendiente',
        'Confirmado',
        'Completado',
        'Cancelado'
    )
)
```

Las FK hacia Usuario y Negocio utilizan:

```text
ON DELETE RESTRICT
```

porque un Pedido representa información histórica.

---

# 11. Detalle_Pedido

Tabla:

```text
detalle_pedido
```

Representa cada Producto incluido dentro de un Pedido.

Estructura:

| Columna | Tipo | Regla |
|---|---|---|
| `id_detalle` | INT | PK |
| `id_pedido` | INT | FK |
| `id_producto` | INT | FK |
| `cantidad` | INT | > 0 |
| `precio_unitario` | DECIMAL(12,2) | > 0 |

Relaciones:

```text
Pedido 1:N Detalle_Pedido
Producto 1:N Detalle_Pedido
```

Restricciones:

```sql
CHECK (cantidad > 0)
CHECK (precio_unitario > 0)
```

También existe:

```text
UNIQUE(
    id_pedido,
    id_producto
)
```

Por lo tanto, dentro de un mismo Pedido un Producto se representa mediante una sola fila con su cantidad consolidada.

---

# Precio histórico

`detalle_pedido.precio_unitario` tiene una responsabilidad importante.

Supongamos que hoy:

```text
Producto A = $25.000
```

un comprador realiza un pedido.

El detalle guarda:

```text
precio_unitario = 25000
```

Si mañana el Comerciante cambia el Producto a:

```text
Producto A = $30.000
```

el pedido antiguo debe seguir mostrando:

```text
$25.000
```

Por eso el precio histórico pertenece a:

```text
Detalle_Pedido
```

y no se calcula consultando nuevamente el precio actual del Producto.

---

# RESTRICT y CASCADE

## RESTRICT

`ON DELETE RESTRICT` significa:

```text
No permitas borrar el registro padre
si todavía existen registros que dependen de él.
```

Ejemplo:

```text
Usuario
↓
Pedido existente
```

No conviene eliminar físicamente al Usuario y dejar el Pedido sin propietario.

Por eso Pedido → Usuario utiliza RESTRICT.

---

## CASCADE

`ON DELETE CASCADE` significa:

```text
Si se elimina el padre,
elimina automáticamente la relación dependiente.
```

Se utiliza solamente donde la fila hija no tiene sentido por sí sola.

Actualmente se utiliza, entre otros casos, en:

```text
Servicio
↓
Horario_Servicio
```

y:

```text
Usuario / Producto
↓
Favorito
```

---

# Resumen de políticas de eliminación

| Relación | Política |
|---|---|
| Usuario → Rol | RESTRICT |
| Negocio → Usuario | RESTRICT |
| Negocio → Categoria | RESTRICT |
| Producto → Negocio | RESTRICT |
| Producto → Categoria | RESTRICT |
| Servicio → Negocio | RESTRICT |
| Servicio → Categoria | RESTRICT |
| Horario_Servicio → Servicio | CASCADE |
| Reserva → Usuario | RESTRICT |
| Reserva → Servicio | RESTRICT |
| Favorito → Usuario | CASCADE |
| Favorito → Producto | CASCADE |
| Pedido → Usuario | RESTRICT |
| Pedido → Negocio | RESTRICT |
| Detalle_Pedido → Pedido | RESTRICT |
| Detalle_Pedido → Producto | RESTRICT |

---

# Tablas técnicas

## repository_lock

Estructura:

```text
repository_lock
└── id
```

Actualmente contiene una fila:

```text
id = 1
```

No representa información del marketplace.

El Repository MySQL utiliza esta fila para adquirir un bloqueo durante determinadas operaciones transaccionales:

```sql
SELECT id
FROM repository_lock
WHERE id = 1
FOR UPDATE;
```

Esto permite serializar operaciones críticas que utilizan el Repository.

La tabla no debe incluirse como entidad del DER.

---

# schema_migrations

Esta tabla es creada por:

```text
backend/db/migrate.js
```

Su estructura es:

| Columna | Función |
|---|---|
| `version` | Nombre del archivo de migración |
| `checksum` | SHA-256 del contenido |
| `applied` | Indica si finalizó correctamente |
| `applied_at` | Fecha de aplicación |

Ejemplo:

```text
001_foundation.sql
002_reference_data.sql
003_services_reservations_favorites.sql
004_orders_and_details.sql
```

El objetivo es saber qué cambios estructurales ya fueron aplicados.

---

# Migraciones

Las migraciones se encuentran en:

```text
backend/db/migrations/
```

Actualmente:

```text
001_foundation.sql
002_reference_data.sql
003_services_reservations_favorites.sql
004_orders_and_details.sql
```

Se ejecutan en orden alfabético, que en este caso también corresponde al orden numérico.

---

# 001_foundation.sql

Crea:

```text
rol
categoria
usuario
negocio
producto
repository_lock
```

También inserta:

```text
repository_lock.id = 1
```

No introduce usuarios demo.

---

# 002_reference_data.sql

Inserta los catálogos requeridos por la aplicación.

Principalmente:

```text
3 roles
24 categorías
```

No crea datos ficticios de:

```text
usuarios
negocios
productos
pedidos
reservas
```

Los datos de negocio deben ser creados a través de la aplicación o de operaciones controladas.

---

# 003_services_reservations_favorites.sql

Crea:

```text
servicio
horario_servicio
reserva
favorito
```

Depende de las entidades creadas en 001.

---

# 004_orders_and_details.sql

Crea:

```text
pedido
detalle_pedido
```

Depende principalmente de:

```text
usuario
negocio
producto
```

---

# Cómo funciona migrate.js

El runner:

```text
backend/db/migrate.js
```

realiza aproximadamente este proceso:

```text
conectar
↓
preparar conexión
↓
consultar versión del servidor
↓
obtener GET_LOCK
↓
crear schema_migrations si no existe
↓
leer archivos SQL
↓
ordenarlos
↓
calcular SHA-256
↓
comprobar si ya fueron aplicados
↓
ejecutar los pendientes
↓
marcar applied = TRUE
↓
liberar lock
```

---

# Checksum

Cada migración tiene un hash SHA-256.

Conceptualmente:

```text
archivo SQL
↓
SHA-256
↓
checksum
```

Si una migración ya aplicada cambia posteriormente, el checksum deja de coincidir.

El runner lo detecta y se detiene.

Esto protege contra modificaciones silenciosas del historial del esquema.

---

# Migraciones aplicadas

Si se ejecuta:

```bash
npm run db:migrate --prefix backend
```

sobre una base actualizada, puede aparecer:

```text
001_foundation.sql ya estaba aplicada
002_reference_data.sql ya estaba aplicada
003_services_reservations_favorites.sql ya estaba aplicada
004_orders_and_details.sql ya estaba aplicada
```

Esto significa que el runner es repetible en una base correctamente registrada.

No vuelve a crear las tablas.

---

# Migración incompleta

Antes de ejecutar las sentencias de una nueva migración, el runner registra:

```text
applied = FALSE
```

Cuando termina correctamente cambia a:

```text
applied = TRUE
```

Si falla a mitad del proceso, la siguiente ejecución detectará que quedó incompleta.

Esto obliga a revisar el estado real de la base antes de continuar.

---

# Importante sobre DDL

Operaciones como:

```text
CREATE TABLE
ALTER TABLE
DROP TABLE
```

son DDL.

MySQL y MariaDB pueden realizar commits implícitos alrededor de determinadas operaciones DDL.

Por esta razón no debe asumirse que un simple `ROLLBACK` puede deshacer completamente una migración estructural fallida.

Antes de cambios importantes de esquema se debe considerar:

```text
respaldo
ventana de mantenimiento
prueba previa
procedimiento de recuperación
```

---

# Limitación actual del runner SQL

El runner divide los archivos utilizando:

```javascript
sql.split(";")
```

Esto funciona porque las migraciones actuales contienen sentencias SQL simples.

No deben introducirse sin adaptar el runner elementos complejos como:

```text
procedimientos almacenados
triggers con DELIMITER
bloques SQL con ; internos
```

Si en el futuro son necesarios, primero debe mejorarse el parser de migraciones.

---

# Configuración de conexión

La configuración se obtiene mediante:

```text
backend/config/index.js
```

Variables principales:

```env
DATA_SOURCE=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=reactiva_pereira
DB_USER=root
DB_PASSWORD=
```

En el entorno académico local con XAMPP puede utilizarse temporalmente:

```text
root
sin contraseña
```

si esa es la configuración local.

Esto no debe utilizarse como configuración de producción.

---

# Pool de conexiones

El archivo:

```text
backend/db/pool.js
```

utiliza:

```text
mysql2/promise
```

y crea un pool.

Un pool evita abrir una conexión nueva desde cero para cada Request HTTP.

Configuración actual relevante:

```text
waitForConnections = true
connectionLimit = 10
queueLimit = 100
connectTimeout = 10000
timezone = Z
charset = utf8mb4_unicode_ci
multipleStatements = false
decimalNumbers = false
```

---

# ¿Por qué usar un pool?

Sin pool:

```text
Request
↓
abrir conexión
↓
consulta
↓
cerrar conexión
```

cada vez.

Con pool:

```text
Pool
├── conexión disponible
├── conexión disponible
├── conexión disponible
└── ...
```

Las peticiones reutilizan conexiones existentes.

Esto reduce el costo de conectarse repetidamente al servidor SQL.

---

# Preparación de conexión

Cada conexión utilizada por la aplicación ejecuta:

```sql
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
```

También configura:

```text
time_zone = '+00:00'
```

y:

```text
STRICT_TRANS_TABLES
```

---

# UTC

El backend trabaja internamente con fechas utilizando UTC cuando corresponde.

Esto ayuda a evitar resultados distintos dependiendo de la zona horaria del equipo donde se ejecute Node.js.

La presentación de horarios comerciales puede adaptarse posteriormente a la zona local de Pereira.

---

# STRICT_TRANS_TABLES

Este modo obliga al motor a ser más estricto ante datos inválidos.

Sin un modo estricto, ciertos motores/configuraciones podrían intentar convertir silenciosamente algunos valores incorrectos.

Con:

```text
STRICT_TRANS_TABLES
```

se busca que esos problemas sean rechazados en lugar de ocultados.

---

# multipleStatements = false

El pool configura:

```text
multipleStatements: false
```

Esto impide enviar múltiples sentencias SQL arbitrarias dentro de una única operación del driver.

Es una medida adicional de reducción de superficie de riesgo.

No reemplaza el uso de consultas parametrizadas.

---

# Consultas parametrizadas

Los valores procedentes de la aplicación deben enviarse como parámetros.

Conceptualmente:

```javascript
connection.execute(
  "SELECT * FROM usuario WHERE id_usuario = ?",
  [id]
);
```

y no concatenarse directamente:

```javascript
"SELECT * FROM usuario WHERE id_usuario = " + id
```

La primera forma ayuda a prevenir inyección SQL.

---

# Repository MySQL

Archivo principal:

```text
backend/repositories/mysql/index.js
```

El Repository traduce los campos del dominio JavaScript al esquema académico.

Ejemplos:

| Backend | SQL |
|---|---|
| `id` | `id_usuario`, `id_producto`, etc. |
| `rolId` | `id_rol` |
| `passwordHash` | `contrasena_hash` |
| `usuarioId` | `id_usuario` |
| `negocioId` | `id_negocio` |
| `categoriaId` | `id_categoria` |
| `nombre` de Negocio | `nombre_negocio` |
| `nombre` de Producto | `nombre_producto` |
| `telefono` de Negocio | `telefono_contacto` |
| `direccion` | `direccion_comercial` |
| `precioReferencia` | `precio_referencia` |
| `duracionMinutos` | `duracion_minutos` |
| `capacidadSimultanea` | `capacidad_simultanea` |
| `fechaHoraInicio` | `fecha_hora_inicio` |
| `precioUnitario` | `precio_unitario` |

Esto permite que Services y Controllers continúen utilizando objetos JavaScript legibles sin acoplarse directamente a los nombres físicos de SQL.

---

# Ejemplo Usuario

SQL:

```text
id_usuario
id_rol
nombre
apellido
correo
telefono
contrasena_hash
estado
fecha_registro
```

Repository:

```javascript
{
  id,
  rolId,
  nombre,
  apellido,
  correo,
  telefono,
  passwordHash,
  estado,
  createdAt,
  rol
}
```

`rol` se obtiene mediante JOIN con la tabla `rol`.

---

# Ejemplo Negocio

SQL:

```text
id_negocio
id_categoria
id_usuario
nombre_negocio
direccion_comercial
telefono_contacto
```

Repository:

```javascript
{
  id,
  categoriaId,
  usuarioId,
  nombre,
  direccion,
  telefono,
  categoria,
  propietario
}
```

`categoria` y `propietario` pueden obtenerse mediante JOIN.

---

# DECIMAL y JavaScript

MySQL puede devolver valores `DECIMAL` como texto para evitar pérdida silenciosa de precisión.

El Repository convierte los campos utilizados por esta aplicación cuando corresponde:

```text
precio
precioReferencia
precioUnitario
```

a:

```text
Number
```

antes de devolverlos a otras capas.

---

# Transacciones

Una transacción permite agrupar varias operaciones como una unidad.

Ejemplo:

```text
BEGIN
↓
crear pedido
↓
crear detalles
↓
descontar stock
↓
COMMIT
```

Si ocurre un error:

```text
ROLLBACK
```

Así se evita guardar solo una parte de una operación.

---

# Ejemplo sin transacción

Supongamos:

```text
crear pedido ✅
crear detalle ✅
descontar producto 1 ✅
descontar producto 2 ❌
```

Sin transacción podríamos terminar con información inconsistente.

Con transacción:

```text
algo falla
↓
ROLLBACK
↓
se revierten las operaciones de esa transacción
```

---

# AsyncLocalStorage

El Repository MySQL utiliza:

```text
AsyncLocalStorage
```

para conservar la misma conexión durante las operaciones que pertenecen a una transacción.

Conceptualmente:

```text
repos.transaccion()
↓
connection A
↓
Service
├── repos.pedido.create()
├── repos.detallePedido.create()
└── repos.producto.update()
```

Todas esas operaciones pueden compartir la misma conexión transaccional sin obligar al Service a manejar directamente conexiones SQL.

---

# Bloqueo del Repository

Durante una transacción se utiliza:

```sql
SELECT id
FROM repository_lock
WHERE id = 1
FOR UPDATE;
```

Mientras la transacción está abierta, otro proceso que utilice el mismo mecanismo debe esperar para adquirir ese bloqueo.

Esta implementación favorece simplicidad y consistencia para el proyecto académico.

También significa que puede serializar más escrituras de las estrictamente necesarias.

En un sistema de gran escala podría evolucionarse a estrategias de locking más específicas.

---

# Bloqueo de productos

Durante determinadas operaciones de Pedido, el Repository también puede bloquear Productos mediante:

```sql
SELECT id_producto
FROM producto
WHERE id_producto = ?
FOR UPDATE;
```

Esto ayuda a evitar que dos operaciones concurrentes modifiquen simultáneamente el mismo stock sin coordinación.

---

# DATA_SOURCE

La aplicación soporta:

```text
DATA_SOURCE=memory
```

y:

```text
DATA_SOURCE=mysql
```

## memory

Los datos viven únicamente en memoria.

```text
reiniciar Node
↓
datos temporales desaparecen
```

## mysql

Los datos se guardan en MariaDB/MySQL.

```text
reiniciar Node
↓
datos permanecen
```

Incluso si se apaga completamente el computador:

```text
encender computador
↓
iniciar MySQL
↓
iniciar Node
↓
consultar base
↓
los registros siguen allí
```

---

# XAMPP

En el entorno local actual, MariaDB se ejecuta mediante XAMPP.

Iniciar MySQL:

```bash
sudo /opt/lampp/lampp startmysql
```

Iniciar Apache:

```bash
sudo /opt/lampp/lampp startapache
```

Estado:

```bash
sudo /opt/lampp/lampp status
```

Apache es necesario para acceder a:

```text
http://localhost/phpmyadmin
```

MariaDB es el servicio que realmente almacena los datos.

---

# MySQL del sistema vs XAMPP

En Linux puede existir simultáneamente otro MySQL instalado como servicio del sistema.

Por ejemplo:

```text
/usr/sbin/mysqld
```

y XAMPP:

```text
/opt/lampp/sbin/mysqld
```

Ambos no pueden escuchar simultáneamente en:

```text
3306
```

si utilizan la misma dirección.

Para verificar qué proceso utiliza el puerto:

```bash
sudo ss -ltnp | grep ':3306'
```

Para el entorno actual de Reactiva Pereira se utiliza el servidor de XAMPP cuando se trabaja con phpMyAdmin local.

---

# phpMyAdmin

phpMyAdmin no es la base de datos.

Es una interfaz web que permite administrar MySQL/MariaDB.

La relación correcta es:

```text
phpMyAdmin
↓
MariaDB / MySQL
↓
reactiva_pereira
```

La aplicación Node.js no se conecta a phpMyAdmin.

Se conecta directamente al servidor SQL:

```text
Node.js
↓
mysql2
↓
127.0.0.1:3306
↓
MariaDB / MySQL
```

---

# Verificar conexión desde Node.js

Una consulta simple como:

```sql
SELECT 1 + 1 AS resultado;
```

permite comprobar:

```text
Node
↓
mysql2
↓
servidor SQL
↓
respuesta
```

Un resultado:

```text
2
```

confirma que la conexión básica funciona.

---

# Comprobar persistencia

Una prueba completa de persistencia puede ser:

```text
1. Iniciar MySQL.
2. Iniciar backend con DATA_SOURCE=mysql.
3. Crear un Usuario.
4. Confirmarlo en phpMyAdmin.
5. Detener Node.
6. Detener XAMPP.
7. Reiniciar los servicios.
8. Iniciar nuevamente Node.
9. Consultar el Usuario.
```

Si permanece, se ha demostrado persistencia real.

La misma lógica aplica para:

```text
Negocio
Producto
Servicio
Reserva
Favorito
Pedido
Detalle_Pedido
```

---

# Pruebas MySQL

Las pruebas automatizadas que modifican datos no deben utilizar la base principal:

```text
reactiva_pereira
```

Deben utilizar una base cuyo nombre termine en:

```text
_test
```

Ejemplo:

```text
reactiva_pereira_test
```

El comando correspondiente es:

```bash
npm run test:mysql --prefix tests
```

Estas pruebas pueden crear o eliminar fixtures.

Nunca deben utilizarse sobre información que se quiera conservar.

---

# Integridad

La base utiliza varias herramientas de integridad:

```text
PRIMARY KEY
FOREIGN KEY
UNIQUE
CHECK
NOT NULL
DEFAULT
RESTRICT
CASCADE
```

Cada una protege un tipo diferente de regla.

La aplicación también valida reglas en Services.

Por tanto existen dos niveles:

```text
Aplicación
↓
validaciones y reglas de negocio

Base de datos
↓
integridad estructural
```

No se debe depender exclusivamente de uno de los dos cuando una regla puede protegerse razonablemente en ambos.

---

# ¿Qué cambia respecto al almacenamiento en memoria?

Antes:

```text
Route
↓
Service
↓
Repository Memory
↓
arreglo / Map
```

Ahora, en modo MySQL:

```text
Route
↓
Service
↓
Repository MySQL
↓
SQL
↓
MariaDB
```

La API puede mantener los mismos endpoints.

Ese desacoplamiento es precisamente una ventaja del patrón Repository.

---

# Entidades que no existen

El modelo actual no contiene:

```text
Pago
Factura
Metodo_Pago
Inventario
Disponibilidad
Sector_Comercial
Carrito
```

Esto es intencional.

## Inventario

Actualmente:

```text
Producto.stock
```

es suficiente para el alcance definido.

## Disponibilidad

Se deriva mediante:

```text
Horario
+
Duración del Servicio
+
Capacidad
+
Reservas
```

## Carrito

Permanece temporalmente en el frontend.

## Pago y Factura

El sistema no procesa pagos reales actualmente.

Si el alcance cambia, estas entidades deberán diseñarse y aprobarse antes de incorporarlas.

---

# Evolución futura

Si el modelo necesita una nueva columna o tabla, la evolución recomendada es:

```text
Requerimiento
↓
revisión del DER
↓
nueva migración
↓
adaptar Repository
↓
adaptar Service si corresponde
↓
pruebas
↓
documentación
```

Ejemplo:

```text
005_nueva_funcionalidad.sql
```

No agregar tablas directamente desde phpMyAdmin y olvidar reflejar el cambio en las migraciones.

El esquema debe poder reproducirse a partir del código versionado.

---

# Regla de conservación

Una base de datos local puede contener información que Git no conoce.

Git guarda:

```text
migraciones
Repository
configuración
código
```

MariaDB guarda:

```text
usuarios
negocios
productos
reservas
pedidos
etc.
```

Hacer:

```text
git commit
git push
git pull
```

no debería eliminar la información de MariaDB.

Sin embargo, ejecutar SQL destructivo como:

```text
DROP DATABASE
DROP TABLE
DELETE
TRUNCATE
```

sí puede modificar o eliminar datos.

Por esta razón cualquier operación destructiva sobre una base real debe revisarse antes de ejecutarse.

---

# Resumen para sustentación

## ¿Dónde se almacenan los datos?

En MariaDB/MySQL cuando:

```text
DATA_SOURCE=mysql
```

## ¿Cómo llega un dato desde el navegador?

```text
Frontend
↓
fetch()
↓
HTTP
↓
Express
↓
Controller
↓
Service
↓
Repository
↓
SQL
↓
MariaDB
```

## ¿Qué devuelve la base?

Filas SQL.

El Repository las transforma a objetos JavaScript.

Después Express devuelve JSON al frontend.

## ¿Qué es una PK?

El identificador único de una fila.

## ¿Qué es una FK?

Una referencia a otra tabla.

## ¿Qué hace UNIQUE?

Evita valores o combinaciones duplicadas.

## ¿Qué hace CHECK?

Impide guardar valores que violen una condición.

## ¿Qué hace RESTRICT?

Impide eliminar un registro padre que todavía tiene dependencias.

## ¿Qué hace CASCADE?

Elimina automáticamente relaciones dependientes cuando desaparece su padre.

## ¿Qué es una transacción?

Un conjunto de operaciones que debe completarse como una unidad.

## ¿Qué es un Repository?

La capa que abstrae cómo se almacenan y recuperan los datos.

## ¿Qué es una migración?

Un archivo versionado que modifica o crea la estructura de la base de datos de manera reproducible.

## ¿Qué aporta MySQL frente a memory?

Persistencia.

Los datos permanecen después de reiniciar el servidor o el computador.