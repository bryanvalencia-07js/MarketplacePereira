# Instrucciones para agentes — Reactiva Pereira

## Propósito

Este archivo contiene reglas técnicas para cualquier agente, asistente o herramienta automatizada que trabaje sobre Reactiva Pereira.

Antes de realizar cambios estructurales, revisar:

```text id="sxd8w1"
README.md
docs/ARCHITECTURE.md
docs/API.md
docs/DATABASE.md
docs/SECURITY_TESTING.md
```

También revisar el estado actual de Git antes de modificar archivos.

No asumir que un archivo está obsoleto únicamente por su nombre. Verificar primero si participa en imports, rutas, scripts, tests, assets o documentación.

---

## Arquitectura

Mantener la arquitectura principal:

```text id="k5wdd2"
Frontend
↓
fetch()
↓
API REST
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
```

El frontend nunca debe conectarse directamente a la base de datos.

El proyecto utiliza:

```text id="b6z6xy"
HTML5
CSS3
JavaScript nativo
Node.js
Express
mysql2/promise
MySQL / MariaDB
```

No introducir ORM ni frameworks frontend o CSS salvo solicitud explícita.

---

## Persistencia

El sistema conserva dos implementaciones de Repository:

```text id="8v8jkj"
memory
mysql
```

La selección se realiza mediante:

```text id="ygpldj"
DATA_SOURCE=memory
```

o:

```text id="fth857"
DATA_SOURCE=mysql
```

### Memory

Se utiliza principalmente para pruebas automatizadas y desarrollo aislado.

No proporciona persistencia después de reiniciar Node.js.

### MySQL

Es la persistencia real del proyecto.

El entorno local puede utilizar MariaDB mediante XAMPP.

El entorno de integración continua puede utilizar MySQL.

Services y Controllers no deben depender directamente de SQL.

Toda interacción con la base debe pasar por el Repository correspondiente.

---

## Repository

Mantener la abstracción existente:

```text id="8mh3of"
list()
find()
create()
update()
delete()
transaccion()
```

Cuando corresponda.

Los nombres del backend y los nombres físicos de la base pueden ser diferentes.

Ejemplo:

```text id="wpob8q"
Backend         Base de datos

id              id_usuario
rolId           id_rol
passwordHash    contrasena_hash
negocioId       id_negocio
categoriaId     id_categoria
```

El mapeo debe permanecer dentro del Repository MySQL.

No trasladar nombres SQL específicos hacia Controllers, Services o frontend.

---

## Modelo de datos

El DER aprobado contiene exactamente once entidades de negocio:

```text id="yukbg6"
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

```text id="5hw2zt"
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

Las tablas:

```text id="2t640a"
repository_lock
schema_migrations
```

son infraestructura técnica y no entidades del DER.

No agregar entidades nuevas al modelo sin revisar primero los requerimientos.

En particular, no crear automáticamente:

```text id="b8mp79"
Pago
Factura
Inventario
Disponibilidad
Sector_Comercial
Carrito
```

---

## Migraciones

Las migraciones actuales son:

```text id="vo1lcu"
001_foundation.sql
002_reference_data.sql
003_services_reservations_favorites.sql
004_orders_and_details.sql
```

Una migración ya aplicada y utilizada como parte del esquema oficial no debe modificarse sin una razón explícita y una estrategia controlada de migración.

Para cambios futuros de esquema, preferir una nueva migración numerada:

```text id="irb1hk"
005_descripcion_del_cambio.sql
006_otro_cambio.sql
```

en lugar de reescribir silenciosamente el historial.

El sistema de migraciones utiliza checksums para detectar alteraciones.

No ejecutar migraciones destructivas sobre una base con información importante sin revisar previamente:

```text id="nax5uh"
impacto
respaldo
recuperación
dependencias
```

---

## Base de datos de desarrollo

La base local principal es:

```text id="hpqg7s"
reactiva_pereira
```

El desarrollo local puede utilizar:

```text id="wmzsq9"
XAMPP
MariaDB
phpMyAdmin
```

La aplicación se conecta mediante `mysql2`.

phpMyAdmin es solamente una herramienta de administración.

No acoplar el código de la aplicación a phpMyAdmin ni a XAMPP.

La configuración de conexión debe provenir de variables de entorno.

Nunca guardar credenciales reales directamente en el código.

---

## Bases de pruebas

Las pruebas MySQL destructivas únicamente pueden ejecutarse contra una base dedicada cuyo nombre termine en:

```text id="ujg7nw"
_test
```

Ejemplo:

```text id="39fprd"
reactiva_pereira_test
```

Nunca ejecutar suites destructivas contra:

```text id="uq7lcx"
reactiva_pereira
```

si contiene información que debe conservarse.

---

## Usuarios y seguridad

No almacenar contraseñas en texto plano.

Mantener el sistema actual de hashing basado en `scrypt`.

No sustituirlo por otro algoritmo sin una decisión explícita del proyecto.

Mantener:

```text id="6rz8x4"
cookies HttpOnly
SameSite
CSRF
validación de origen
CSP
rate limiting
roles
autorización por propiedad
validación de entradas
errores seguros
```

No guardar autenticación en `localStorage`.

No exponer hashes de contraseñas al frontend.

No exponer secretos dentro de JavaScript servido al navegador.

No solicitar ni introducir credenciales reales en fixtures, ejemplos o pruebas.

---

## Roles

Los roles operativos actuales son:

```text id="vu560e"
Administrador
Comerciante
Comprador
```

No asumir permisos nuevos únicamente por el nombre del rol.

Las reglas de autorización deben comprobarse en backend.

Ocultar botones en frontend no reemplaza la autorización del servidor.

---

## Negocios

Un Comerciante puede tener como máximo un Negocio.

Esta regla debe conservarse tanto en la lógica de aplicación como en la integridad de la base cuando corresponda.

No permitir asignar un Negocio a un usuario que no cumpla las reglas del dominio.

---

## Productos

Producto pertenece a:

```text id="0zzagp"
Negocio
Categoria
```

El stock no puede ser negativo.

El precio debe ser válido según las reglas del dominio y de la base.

`visitas` es el contador físico utilizado actualmente.

`popularidad` puede mantenerse únicamente como alias de compatibilidad cuando el contrato existente lo requiera.

Un producto con stock igual a cero está agotado por condición de stock.

No crear un estado adicional `Agotado` sin revisar primero el modelo.

---

## Servicios y horarios

Servicio pertenece a:

```text id="i1zqdc"
Negocio
Categoria
```

Un Servicio puede tener varios Horarios_Servicio.

Mantener las validaciones de:

```text id="2q5ut8"
duración
capacidad
hora de inicio
hora de fin
solapamiento
categoría
estado
```

No almacenar una entidad Disponibilidad.

La disponibilidad debe derivarse de:

```text id="hynbb2"
horarios
duración
capacidad
reservas confirmadas
```

---

## Reservas

La creación de reservas debe mantener las comprobaciones de disponibilidad dentro de una operación transaccional.

No separar una comprobación crítica de cupo del INSERT correspondiente si eso permite condiciones de carrera.

Conservar el historial de reservas.

Los estados actuales son:

```text id="6ythfv"
Confirmada
Cancelada
```

---

## Favoritos

Favorito representa la relación entre Usuario y Producto.

Debe mantenerse la unicidad:

```text id="t0v8bh"
usuario + producto
```

para evitar favoritos duplicados.

Las operaciones deben usar el usuario de la sesión y no confiar en un identificador de usuario suministrado libremente por el cliente.

---

## Pedidos

Pedido pertenece a:

```text id="5tn77k"
Usuario
Negocio
```

Detalle_Pedido pertenece a:

```text id="t1jh9p"
Pedido
Producto
```

El precio unitario del detalle debe tomarse del Producto en el momento de crear el pedido.

No confiar en precios enviados por el frontend.

El carrito continúa siendo temporal en el navegador.

No crear una tabla Carrito sin revisar primero los requisitos.

---

## Stock y transacciones

Las operaciones de pedido que consultan y modifican stock deben permanecer dentro de una transacción.

El proceso general debe mantener:

```text id="rby67f"
BEGIN
↓
bloqueo necesario
↓
validación
↓
creación de pedido
↓
creación de detalles
↓
actualización de stock
↓
COMMIT
```

Si ocurre un error:

```text id="krckar"
ROLLBACK
```

No permitir que una operación multinegocio quede parcialmente aplicada.

---

## Estados de Pedido

Los estados actuales son:

```text id="81g50z"
Pendiente
Confirmado
Completado
Cancelado
```

Mantener las reglas de transición existentes.

No permitir reabrir estados terminales sin un nuevo requerimiento aprobado.

Cancelar un pedido debe restaurar stock únicamente cuando corresponda y exactamente una vez.

---

## UI

Mantener la identidad visual actual de Reactiva Pereira.

La interfaz utiliza:

```text id="q5wlpz"
rojo
amarillo
crema
Playfair Display
Inter
```

Conservar:

```text id="2wn48q"
responsive
accesibilidad
navegación por roles
Coverflow
storytelling
estados de loading
estados vacíos
manejo de errores
```

No eliminar una clase CSS únicamente porque no aparezca directamente en un HTML.

Buscar también referencias en:

```text id="hl8u8k"
JavaScript
classList
className
innerHTML
selectores
data-*
media queries
tests
```

---

## CSS y assets

Los módulos fuente están en:

```text id="ydpzlu"
frontend/css/tokens.css
frontend/css/base.css
frontend/css/layout.css
frontend/css/components.css
frontend/css/pages.css
frontend/css/animations.css
```

`frontend/css/estilos.css` es generado.

No editarlo manualmente como fuente principal.

Después de cambiar módulos CSS o assets gestionados por el script, ejecutar:

```bash id="4fz0xl"
npm run assets
```

No modificar archivos vendor generados si pueden regenerarse correctamente desde las dependencias.

---

## Node.js

La versión objetivo del repositorio es Node.js 24.

Ver:

```text id="oa6foj"
.nvmrc
backend/package.json
.github/workflows/ci.yml
```

No reducir ni cambiar la versión declarada únicamente porque una ejecución puntual funcione con otra versión.

Verificar compatibilidad antes de modificarla.

---

## Dependencias

Las dependencias del backend pertenecen a:

```text id="g1jbey"
backend/package.json
```

Las herramientas de UI y generación de assets pertenecen al:

```text id="tewuh7"
package.json
```

de la raíz.

Las dependencias específicas de pruebas de navegador pertenecen a:

```text id="s18dsx"
tests/package.json
```

Evitar instalar una dependencia en varios paquetes si solo pertenece a uno.

---

## Pruebas

Antes de afirmar que una funcionalidad está correcta, ejecutar las pruebas relevantes.

Suite principal:

```bash id="yq3avj"
npm test --prefix tests
```

Backend:

```bash id="7ml12w"
npm test --prefix backend
```

Responsive:

```bash id="bx8rq3"
npm run test:responsive --prefix tests
```

MySQL:

```bash id="ojmd11"
npm run test:mysql --prefix tests
```

La suite MySQL requiere una base dedicada `_test`.

No afirmar que una prueba pasó si no fue ejecutada.

Cuando una prueba falle debido a que representa una arquitectura antigua, actualizar la prueba para comprobar el comportamiento actual en lugar de desactivar silenciosamente la cobertura.

---

## Calidad del código

Priorizar:

```text id="wbmqh9"
claridad
legibilidad
consistencia
simplicidad
mantenibilidad
```

Evitar abstracciones innecesarias.

No duplicar lógica si existe una responsabilidad clara donde reutilizarla.

No dejar bloques grandes de código muerto comentado.

Git ya conserva el historial.

Los comentarios deben explicar decisiones o comportamiento no evidente, no repetir literalmente lo que hace cada línea.

---

## Cambios estructurales

Antes de borrar o reemplazar un archivo:

1. Buscar referencias globales.
2. Identificar quién lo importa o consume.
3. Revisar scripts y tests relacionados.
4. Explicar por qué está obsoleto.
5. Ejecutar las pruebas correspondientes después del cambio.

No realizar reescrituras masivas si un cambio pequeño y localizado resuelve el problema.

---

## Documentación

Mantener actualizados:

```text id="g1txtp"
README.md
AGENTS.md
docs/API.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/SECURITY_TESTING.md
```

La documentación debe describir el estado actual del proyecto.

No utilizar estos archivos como diario de cada Pull Request.

El historial de cambios ya pertenece a Git y GitHub.

No conservar referencias a ramas, PRs o migraciones eliminadas salvo que sean necesarias para comprender una compatibilidad vigente.

---

## Git

Antes de modificar:

```bash id="94ij8h"
git status
```

Después de un bloque de cambios:

```bash id="my7lwy"
git diff
git diff --check
```

No ejecutar comandos destructivos como:

```text id="u5qxoc"
git reset --hard
```

sin autorización explícita.

No sobrescribir trabajo existente del usuario.

No hacer push, merge, rebase ni modificar historial sin una solicitud explícita.

Los cambios deben quedar revisables y agrupados de forma coherente.

---

## Principio general

Reactiva Pereira es un proyecto académico, pero debe mantenerse con prácticas profesionales razonables.

La prioridad es:

```text id="ztwm05"
entender
↓
cambiar
↓
probar
↓
documentar
```

No agregar complejidad únicamente para hacer el proyecto parecer más avanzado.

Primero claridad.

Después arquitectura.

Después optimización.