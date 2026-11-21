# Seguridad y pruebas — Reactiva Pereira

## Propósito

Este documento describe los principales controles de seguridad implementados actualmente en Reactiva Pereira y la estrategia utilizada para comprobar su funcionamiento.

El proyecto es académico, pero busca aplicar prácticas razonables de seguridad en:

```text
autenticación
autorización
sesiones
contraseñas
CSRF
validación
SQL
errores
headers HTTP
concurrencia
integridad
pruebas automatizadas
```

La existencia de estos controles no convierte automáticamente al sistema en una plataforma certificada para producción.

---

# Principio de seguridad

El navegador no es una fuente confiable de autorización ni de datos críticos.

Por esta razón:

```text
Frontend
↓
envía solicitud
↓
Backend
↓
vuelve a validar
↓
autoriza
↓
consulta datos reales
↓
ejecuta operación
```

El frontend puede mejorar la experiencia ocultando botones o páginas, pero la decisión definitiva ocurre en el servidor.

---

# Contraseñas

Las contraseñas nunca se almacenan en texto plano.

El archivo:

```text
backend/utils/password.js
```

utiliza:

```text
scrypt
```

con los parámetros actuales:

```text
N = 32768
r = 8
p = 3
```

La sal tiene:

```text
16 bytes aleatorios
```

y el hash derivado:

```text
64 bytes
```

El formato almacenado incluye los parámetros:

```text
scrypt:32768:8:3:salt:hash
```

Esto permite identificar el algoritmo y sus parámetros durante la verificación.

---

# Comparación segura de contraseñas

La verificación utiliza:

```text
timingSafeEqual()
```

para comparar el hash calculado con el almacenado.

Esto reduce diferencias de tiempo derivadas de comparaciones convencionales.

---

# Longitud de contraseña

Durante creación o registro se exige:

```text
12 a 128 caracteres
```

Las contraseñas nunca se devuelven mediante la API.

Tampoco se devuelve:

```text
passwordHash
contrasena_hash
```

---

# Protección contra enumeración básica en login

Cuando el correo no existe, el sistema igualmente realiza una comprobación contra un hash ficticio.

Conceptualmente:

```text
correo existente
↓
verificar hash real


correo inexistente
↓
verificar hash ficticio
```

Esto busca reducir diferencias evidentes de tiempo entre:

```text
usuario existente
usuario inexistente
```

El mensaje de error de login permanece genérico:

```text
Correo o contraseña incorrectos.
```

---

# Sesiones

Las sesiones se almacenan actualmente en memoria del proceso Node.js.

No se almacenan en:

```text
localStorage
sessionStorage
MySQL
```

como mecanismo de autenticación.

---

# Token de sesión

Después del login se genera un token aleatorio de:

```text
32 bytes
```

representado en hexadecimal.

El navegador recibe el token mediante una cookie llamada:

```text
rp_session
```

El servidor no utiliza directamente el token como clave del Map.

Primero calcula:

```text
SHA-256(token)
```

y utiliza ese resultado para localizar la sesión.

---

# Cookie

La cookie de autenticación utiliza:

```text
HttpOnly
SameSite=Strict
Path=/
```

En producción utiliza además:

```text
Secure
```

`HttpOnly` impide que JavaScript del navegador lea directamente la cookie mediante `document.cookie`.

---

# Duración de sesión

La duración máxima actual es:

```text
8 horas
```

La expiración es absoluta.

Reiniciar el proceso Node.js elimina las sesiones existentes porque actualmente se almacenan en memoria.

Los datos persistentes de MySQL no se pierden por ese reinicio.

---

# Revocación de sesión

Las sesiones de un Usuario se revocan cuando se producen cambios sensibles como:

```text
contraseña
rol
estado
eliminación de cuenta
```

Cerrar sesión también elimina la sesión correspondiente.

---

# Límite de sesiones en memoria

El almacenamiento actual limita el número total de sesiones activas manejadas por el proceso.

El límite actual es:

```text
10000
```

Si se alcanza:

```text
503 Service Unavailable
```

puede ser devuelto durante un nuevo login.

---

# CSRF

Las operaciones sensibles autenticadas utilizan protección CSRF.

Durante el login se genera un token CSRF aleatorio de:

```text
32 bytes
```

El cliente lo envía mediante:

```http
X-CSRF-Token
```

El Middleware compara:

```text
token recibido
vs
token de la sesión
```

mediante:

```text
timingSafeEqual()
```

---

# Operaciones protegidas por CSRF

Entre ellas se encuentran operaciones como:

```text
crear
actualizar
eliminar
logout
reservar
cancelar
favoritos
pedidos
cambios de estado
```

dependiendo de la ruta correspondiente.

Un token inexistente o incorrecto produce:

```text
403 Forbidden
```

---

# Validación de origen

Para métodos distintos de:

```text
GET
HEAD
OPTIONS
```

el servidor comprueba el origen de la solicitud.

Cuando existe un `Origin`, debe coincidir con:

```text
APP_ORIGIN
```

si fue configurado, o con el origen actual del servidor.

También se rechazan Requests cuyo:

```text
Sec-Fetch-Site
```

sea:

```text
cross-site
```

---

# CORS

Reactiva Pereira está diseñada actualmente para funcionar con:

```text
Frontend
+
API
```

bajo el mismo origen.

No existe un CORS abierto global que permita cualquier dominio.

La arquitectura principal es:

```text
http://localhost:3000
├── frontend
└── /api
```

durante desarrollo local.

---

# Autorización por roles

Los roles operativos actuales son:

```text
Administrador
Comerciante
Comprador
```

El Middleware puede exigir uno o varios roles mediante:

```javascript
roles(...)
```

Una sesión válida no implica automáticamente permiso para cualquier operación.

---

# Autorización por propiedad

Además del rol se valida la propiedad del recurso.

Ejemplo:

```text
Comerciante A
↓
intenta modificar Producto
↓
Producto pertenece a Negocio B
↓
Negocio B pertenece a Comerciante B
↓
403 Forbidden
```

Por tanto:

```text
rol correcto
```

no es suficiente.

También debe cumplirse:

```text
propiedad correcta
```

cuando corresponda.

---

# IDs del cliente

El backend no confía en IDs enviados por el cliente para otorgar identidad.

Ejemplo de Reserva:

```text
usuarioId
```

no se toma libremente del body.

Se obtiene desde:

```text
sesión autenticada
```

Lo mismo ocurre con Favoritos y Pedidos cuando corresponde.

---

# Campos permitidos

La función de validación:

```text
V.objeto()
```

trabaja mediante una lista explícita de propiedades permitidas.

Ejemplo conceptual:

```text
permitidos:
nombre
precio
stock
```

Si el cliente envía:

```json
{
  "nombre": "Producto",
  "precio": 10000,
  "stock": 5,
  "administrador": true
}
```

la propiedad:

```text
administrador
```

provoca:

```text
400 Bad Request
```

Esto ayuda a prevenir asignaciones masivas de campos que el cliente no debería controlar.

---

# Validación de tipos

El backend valida, según el caso:

```text
texto
correo
contraseña
enteros
IDs
opciones
precios
stock
fechas
horarios
imágenes
estados
```

La validación frontend mejora la experiencia, pero no sustituye la validación servidor.

---

# Validación de correo

El correo:

```text
se recorta
se convierte a minúsculas
se valida
```

y MySQL además mantiene:

```text
UNIQUE(correo)
```

---

# Validación de IDs

Los parámetros de URL deben ser enteros positivos.

Ejemplos rechazados:

```text
0
-1
abc
1.5
```

Un identificador inválido produce:

```text
400 Bad Request
```

---

# Imágenes

Las imágenes de Producto se manejan actualmente mediante Data URL.

Formatos admitidos:

```text
JPEG
PNG
WEBP
```

El backend comprueba:

```text
tipo declarado
formato base64
longitud máxima
firma básica del archivo
```

El límite actual de representación es aproximadamente:

```text
1.800.000 caracteres
```

Esta validación no equivale a un antivirus ni a análisis avanzado de archivos.

---

# JSON

Express acepta cuerpos JSON con límite de:

```text
2 MiB
```

mediante:

```javascript
express.json({
  limit: "2mb",
  inflate: false
})
```

---

# Compresión de Request

La API rechaza cuerpos HTTP comprimidos cuando:

```text
Content-Encoding
```

es diferente de:

```text
identity
```

La respuesta utilizada es:

```text
415 Unsupported Media Type
```

---

# Query parser

Express utiliza:

```text
query parser = simple
```

Esto reduce complejidad innecesaria al interpretar parámetros de consulta.

---

# X-Powered-By

Express tiene deshabilitado:

```text
X-Powered-By
```

para no anunciar innecesariamente la tecnología del servidor mediante ese header.

---

# Headers de seguridad

El Middleware configura:

```text
X-Content-Type-Options: nosniff

Referrer-Policy: same-origin

X-Frame-Options: DENY

Permissions-Policy:
camera=(),
microphone=(),
geolocation=()
```

---

# Content Security Policy

La aplicación envía una:

```text
Content-Security-Policy
```

que limita las fuentes autorizadas de:

```text
scripts
styles
fonts
imágenes
conexiones
objetos
frames
base URI
formularios
```

No se habilita:

```text
unsafe-eval
```

ni:

```text
unsafe-inline
```

para scripts.

---

# Protección contra frames

Se utilizan:

```text
X-Frame-Options: DENY
```

y:

```text
frame-ancestors 'none'
```

dentro de CSP.

Esto busca evitar que Reactiva Pereira sea incrustada arbitrariamente dentro de un frame externo.

---

# HSTS

Cuando:

```text
NODE_ENV=production
```

el servidor agrega:

```text
Strict-Transport-Security
```

con una duración de:

```text
31536000 segundos
```

HSTS solo tiene sentido cuando la aplicación se despliega realmente sobre HTTPS.

---

# Rate limiting

La API implementa limitación de solicitudes en memoria.

## Límite general

Actualmente:

```text
300 solicitudes
por IP
por minuto
```

sobre `/api`.

---

## Autenticación

Registro y login comparten además un límite aproximado de:

```text
30 solicitudes
por IP
cada 15 minutos
```

---

## Login por correo

El login incorpora otro límite:

```text
12 intentos
por correo normalizado
cada 15 minutos
```

---

## Visitas de Producto

El endpoint:

```text
POST /api/productos/:id/visita
```

tiene un límite específico de:

```text
40 solicitudes
por IP
por minuto
```

---

# Limitaciones del rate limiting

Los contadores viven actualmente dentro del proceso Node.js.

Por tanto:

```text
reiniciar Node
↓
reinicia contadores
```

Además, dos instancias independientes del backend no compartirían automáticamente sus límites.

Para un despliegue distribuido sería necesaria una solución compartida.

---

# Timeouts

Cuando el backend se ejecuta como servidor principal configura:

```text
requestTimeout = 30000 ms
```

y:

```text
headersTimeout = 15000 ms
```

Esto evita mantener determinadas conexiones abiertas indefinidamente.

---

# Manejo de errores

Los errores esperados utilizan:

```text
AppError
```

con:

```text
status
mensaje
```

El Middleware final responde en formato:

```json
{
  "ok": false,
  "mensaje": "Descripción segura."
}
```

---

# Error interno

Para errores inesperados se utiliza:

```text
500 Internal Server Error
```

sin enviar al navegador:

```text
stack trace
SQL
credenciales
configuración interna
detalles del driver
```

El servidor registra únicamente información limitada para diagnóstico.

---

# Seguridad SQL

La persistencia utiliza:

```text
mysql2/promise
```

Los valores variables se envían mediante parámetros.

Ejemplo:

```javascript
connection.execute(
  "SELECT * FROM usuario WHERE id_usuario = ?",
  [id]
);
```

No deben concatenarse valores recibidos del usuario directamente dentro del SQL.

---

# Identificadores SQL

Los nombres de:

```text
tabla
columna
```

se obtienen desde configuraciones internas cerradas del Repository.

No proceden libremente del Request HTTP.

---

# multipleStatements

El pool utiliza:

```text
multipleStatements: false
```

por lo que una llamada normal del driver no permite ejecutar arbitrariamente múltiples sentencias separadas.

Esto no sustituye la parametrización.

---

# Integridad de base de datos

MySQL/MariaDB utiliza:

```text
PRIMARY KEY
FOREIGN KEY
UNIQUE
CHECK
NOT NULL
RESTRICT
CASCADE
```

según la entidad.

La integridad existe en dos niveles:

```text
Service
+
Base de datos
```

---

# Transacciones

Operaciones complejas utilizan:

```text
repos.transaccion()
```

El MySQL Repository ejecuta:

```text
BEGIN
↓
operaciones
↓
COMMIT
```

y, ante error:

```text
ROLLBACK
```

---

# Bloqueo global del Repository

Existe una tabla técnica:

```text
repository_lock
```

que permite ejecutar:

```sql
SELECT id
FROM repository_lock
WHERE id = 1
FOR UPDATE;
```

durante determinadas transacciones.

Esto serializa escrituras realizadas mediante el Repository.

---

# Bloqueo de Productos

La creación y cancelación de Pedidos puede bloquear Productos mediante:

```text
SELECT ... FOR UPDATE
```

para proteger las modificaciones de stock frente a operaciones concurrentes.

---

# Validación de stock

El cliente nunca decide el stock final.

Durante un Pedido:

```text
frontend envía cantidad
↓
backend consulta Producto
↓
backend comprueba stock real
↓
backend descuenta dentro de transacción
```

---

# Validación de precios

El cliente tampoco decide:

```text
precioUnitario
subtotal
total
```

El precio se obtiene desde Producto.

Después se almacena como:

```text
detalle_pedido.precio_unitario
```

para conservar historial.

---

# Pedidos multinegocio

Un POST puede generar varios Pedidos agrupados por Negocio.

Todo el proceso se ejecuta dentro de una transacción.

Si falla uno de los Productos:

```text
ROLLBACK
```

evita dejar:

```text
Pedidos parciales
Detalles parciales
stock parcialmente descontado
```

---

# Cancelación de Pedido

Al cancelar un Pedido permitido:

```text
cantidad histórica
↓
se devuelve al stock
```

La operación ocurre dentro de la misma transacción que modifica el estado.

Una cancelación repetida no debe restaurar stock nuevamente.

---

# Reservas concurrentes

La disponibilidad mostrada mediante GET es informativa.

Durante:

```text
POST /api/reservas
```

el backend vuelve a comprobar:

```text
Servicio
horario
fecha
capacidad
Reservas Confirmadas
```

dentro de una transacción.

Esto reduce la posibilidad de sobrepasar el cupo por Requests simultáneos.

---

# Seguridad de historial

Cuando un recurso participa en información histórica, la aplicación evita determinadas eliminaciones físicas.

Ejemplos:

```text
Usuario con Pedidos
Negocio con Pedidos
Producto presente en Detalle_Pedido
Servicio con Reservas
```

En estos casos se favorece:

```text
estado = Inactivo
```

para conservar el historial.

---

# Persistencia de sesiones vs datos

Es importante distinguir:

```text
datos del negocio
```

de:

```text
sesiones
```

Con:

```text
DATA_SOURCE=mysql
```

persisten:

```text
Usuarios
Negocios
Productos
Servicios
Horarios
Reservas
Favoritos
Pedidos
Detalles
```

pero actualmente no persisten entre reinicios:

```text
sesiones
rate limits
```

porque viven en memoria del proceso Node.js.

---

# Dependencias

Los paquetes deben revisarse mediante:

```bash
npm audit --omit=dev --prefix backend
```

Para revisar también dependencias de desarrollo:

```bash
npm audit --prefix backend
```

Y para el paquete de pruebas:

```bash
npm audit --prefix tests
```

El resultado de `npm audit` depende del estado actual del registro de vulnerabilidades.

Por tanto, no debe documentarse permanentemente una afirmación como:

```text
0 vulnerabilidades para siempre
```

Debe reportarse el resultado de cada ejecución concreta.

---

# Node.js

La versión objetivo del proyecto es:

```text
Node.js 24
```

Está declarada mediante:

```text
.nvmrc
backend/package.json
.github/workflows/ci.yml
```

Las pruebas finales deben ejecutarse preferentemente con esa versión.

---

# Instalación reproducible

Dependencias de UI:

```bash
npm ci
```

Dependencias backend:

```bash
npm ci --prefix backend
```

Dependencias de pruebas:

```bash
npm ci --prefix tests
```

Para Playwright:

```bash
npx --prefix tests playwright install chromium
```

En CI se utiliza:

```bash
npx --prefix tests playwright install --with-deps chromium
```

---

# Suite general

Comando:

```bash
npm test --prefix tests
```

Esta suite agrupa pruebas de:

```text
API
Repository simulado
dominio
frontend
estructura
navegador
```

según los archivos configurados actualmente en:

```text
tests/package.json
```

La suite principal utiliza principalmente Memory Repository y no requiere una base MySQL real.

---

# Pruebas del backend

Comando:

```bash
npm test --prefix backend
```

Ejecuta un subconjunto orientado principalmente a:

```text
API
Services
Repository
reglas de dominio
```

El conjunto exacto de archivos se define en:

```text
backend/package.json
```

---

# Pruebas API

Comando:

```bash
npm run test:api --prefix tests
```

Comprueban Requests reales contra aplicaciones Express levantadas en puertos locales de prueba.

Entre otras cosas pueden validar:

```text
status codes
JSON
sesiones
roles
CSRF
ownership
validaciones
Pedidos
Reservas
```

---

# Pruebas de navegador

Comando:

```bash
npm run test:browser --prefix tests
```

Utilizan:

```text
Playwright
Chromium
```

para probar flujos reales del frontend.

Pueden comprobar:

```text
navegación
formularios
roles
carrito
Reservas
Favoritos
Pedidos
manejo de errores
accesibilidad
```

---

# Navegador existente

También puede configurarse:

```bash
CHROMIUM_PATH=/ruta/al/chromium npm test --prefix tests
```

cuando las pruebas admitan un navegador instalado en el sistema.

---

# Responsive

Comando:

```bash
npm run test:responsive --prefix tests
```

Comprueba la interfaz en diferentes dimensiones de viewport.

Su objetivo es detectar problemas como:

```text
overflow
elementos superpuestos
navegación móvil incorrecta
layout roto
```

Estas pruebas no sustituyen una revisión manual en dispositivos físicos.

---

# Accesibilidad

Las dependencias de pruebas incluyen:

```text
@axe-core/playwright
```

para realizar comprobaciones automáticas de accesibilidad en determinadas vistas.

Un resultado limpio de axe no significa:

```text
certificación WCAG
```

La accesibilidad requiere también revisión humana.

---

# Pruebas de estructura

Existen pruebas que comprueban aspectos como:

```text
rutas locales válidas
assets existentes
labels relacionados
compatibilidad con CSP
CSS válido
preferencias de movimiento
```

Estas pruebas ayudan a detectar errores que no requieren abrir un navegador completo.

---

# Pruebas MySQL reales

Comando:

```bash
npm run test:mysql --prefix tests
```

Estas pruebas utilizan un servidor SQL real.

Deben ejecutarse únicamente con:

```text
DATA_SOURCE=mysql
```

y una base cuyo nombre termine en:

```text
_test
```

Ejemplo:

```text
reactiva_pereira_test
```

---

# Regla crítica de seguridad para tests MySQL

Nunca ejecutar la suite destructiva contra:

```text
reactiva_pereira
```

si contiene información que debe conservarse.

Las pruebas pueden:

```text
INSERT
UPDATE
DELETE
DROP
crear fixtures
limpiar tablas
```

según el escenario que están comprobando.

Por eso requieren una base separada.

---

# Variables para pruebas MySQL

Ejemplo:

```bash
export DATA_SOURCE=mysql
export DB_HOST=127.0.0.1
export DB_PORT=3306
export DB_NAME=reactiva_pereira_test
export DB_USER=root
export DB_PASSWORD=""
```

Después:

```bash
npm run test:mysql --prefix tests
```

En un entorno no local deben usarse credenciales adecuadas.

---

# Qué deben comprobar las pruebas MySQL

Entre otros comportamientos:

```text
conexión real
migraciones
Repository
PK
FK
UNIQUE
CHECK
persistencia
transacciones
rollback
concurrencia
stock
Reservas
Pedidos
errores seguros
```

---

# Migraciones en pruebas

La suite SQL debe validar las migraciones actuales:

```text
001_foundation.sql
002_reference_data.sql
003_services_reservations_favorites.sql
004_orders_and_details.sql
```

No debe depender de migraciones eliminadas o de versiones antiguas del esquema.

---

# Integración continua

Workflow:

```text
.github/workflows/ci.yml
```

Actualmente existen dos grupos principales:

```text
memory
mysql
```

---

# Job memory

Utiliza:

```text
Ubuntu
Node.js 24
```

y ejecuta aproximadamente:

```text
checkout
↓
npm ci
↓
regenerar assets
↓
comprobar drift de assets
↓
instalar backend
↓
instalar tests
↓
instalar Chromium
↓
suite general
↓
responsive
↓
audit producción backend
↓
sintaxis JavaScript
↓
git diff --check
```

---

# Job MySQL

Utiliza un servicio temporal:

```text
MySQL 8.4
```

con una base exclusiva llamada:

```text
reactiva_ci_test
```

y credenciales ficticias exclusivas del job.

Después ejecuta:

```bash
npm run test:mysql --prefix tests
```

---

# Sintaxis JavaScript

CI revisa archivos:

```text
.js
.cjs
```

mediante:

```bash
node --check
```

Esto detecta errores sintácticos antes de fusionar cambios.

---

# Assets

El comando:

```bash
npm run assets
```

regenera determinados archivos de UI.

CI comprueba que esa generación no produzca diferencias inesperadas en archivos versionados.

Esto ayuda a detectar que alguien haya modificado manualmente un archivo generado sin actualizar su fuente.

---

# git diff --check

Se utiliza:

```bash
git diff --check
```

para detectar problemas como:

```text
espacios innecesarios al final
errores de whitespace
```

antes de entregar cambios.

---

# Tests y nombres históricos

Algunos archivos de pruebas pueden conservar temporalmente nombres heredados de fases anteriores del desarrollo.

El nombre del archivo no determina si una prueba sigue siendo útil.

Antes de eliminar o renombrar una prueba se debe comprobar:

```text
qué comportamiento valida
si sigue representando el sistema actual
si utiliza el esquema SQL vigente
si está incluida en package.json o CI
```

El objetivo de la limpieza es conservar cobertura útil y eliminar únicamente expectativas obsoletas.

---

# Regla al corregir tests

Si una prueba falla porque comprueba un comportamiento legítimo:

```text
corregir implementación
```

Si falla porque todavía representa una arquitectura eliminada:

```text
actualizar prueba
```

No debe hacerse:

```text
borrar o comentar la prueba
```

únicamente para conseguir un resultado verde.

---

# Datos ficticios

Los tests deben utilizar:

```text
correos .invalid
contraseñas ficticias
Negocios ficticios
Productos ficticios
datos de prueba
```

Nunca:

```text
contraseñas reales
correos privados reales
credenciales MySQL de producción
datos personales reales
```

---

# Evidencia de pruebas

Cuando se cierre un bloque importante de desarrollo se debe registrar:

```text
comando ejecutado
resultado
fallos encontrados
cambios realizados
riesgos pendientes
```

pero estos resultados corresponden a esa ejecución concreta.

No deben convertirse en cifras permanentes dentro de la documentación si cambian frecuentemente.

GitHub Actions proporciona evidencia reproducible adicional para cada commit o Pull Request.

---

# No afirmar pruebas no ejecutadas

Una regla importante es:

```text
No afirmar que una prueba pasó
si no fue ejecutada.
```

Si solo se realizó:

```text
node --check
```

se puede afirmar:

```text
sintaxis válida
```

pero no:

```text
funcionalidad completa verificada
```

---

# Diferencia entre pruebas

## Unitarias o de dominio

Comprueban funciones o reglas aisladas.

---

## API

Comprueban el sistema a través de HTTP.

---

## Navegador

Comprueban la interacción desde una página real.

---

## Integración MySQL

Comprueban la interacción contra un servidor SQL real.

---

## Responsive

Comprueban comportamiento visual en diferentes tamaños.

---

## Auditoría de dependencias

Comprueba vulnerabilidades conocidas reportadas por el ecosistema npm.

Ninguna categoría sustituye completamente a las demás.

---

# Limitaciones conocidas

## Sesiones en memoria

Las sesiones no son compartidas entre varias instancias del backend.

Reiniciar Node.js las invalida.

---

## Rate limiting en memoria

Los límites tampoco son distribuidos.

Varias instancias independientes tendrían contadores separados.

---

## Bloqueo global

`repository_lock` simplifica la consistencia, pero serializa escrituras.

Esto puede reducir rendimiento bajo alta concurrencia.

Para el alcance académico actual se prioriza simplicidad y corrección.

---

## Escritores externos

Las reglas del Service y el bloqueo del Repository solo protegen operaciones que utilizan la aplicación.

Una persona con acceso directo a MySQL podría ejecutar SQL fuera de esas reglas.

Por eso los permisos de base deben restringirse en producción.

---

## Carrito

El carrito es manipulable desde el navegador y no reserva stock.

Esto es aceptable porque antes de crear un Pedido el servidor vuelve a consultar:

```text
Producto
precio
stock
Negocio
Categoria
```

---

## Idempotencia del POST de Pedido

Actualmente la creación de Pedido no utiliza una clave de idempotencia distribuida.

Si el servidor confirma la operación pero el cliente pierde la respuesta, el frontend no debe reintentar automáticamente sin comprobar primero los Pedidos existentes.

---

## Imágenes

Las imágenes se almacenan actualmente como Data URL / MEDIUMTEXT.

Esto simplifica el proyecto académico, pero no es necesariamente la estrategia óptima para un marketplace de gran escala.

---

## Paginación

Algunos listados todavía trabajan obteniendo colecciones completas.

Un sistema con grandes volúmenes debería implementar:

```text
paginación
consultas SQL específicas
índices revisados
```

---

## MySQL remoto

El pool actual está orientado principalmente a un servidor local o una red controlada.

Una base remota de producción debería revisar:

```text
TLS
certificados
firewall
usuario de mínimo privilegio
backups
monitoreo
```

---

## Memory Repository

Memory es útil para pruebas, pero:

```text
no es persistente
no es distribuido
no reemplaza MySQL
```

---

# Lo que las pruebas no garantizan

La suite automatizada no constituye por sí sola:

```text
pentest profesional
certificación de seguridad
certificación WCAG
prueba de alta disponibilidad
prueba de recuperación ante desastre
prueba completa de carga
certificación de producción
```

---

# Requisitos mínimos antes de exposición pública

Un despliegue real debería revisar al menos:

```text
HTTPS
NODE_ENV=production
APP_ORIGIN exacto
secretos fuera de Git
usuario DB de mínimo privilegio
contraseña DB segura
backups
procedimiento de restauración
logs
monitoreo
actualización de dependencias
proxy seguro
configuración correcta de IP real
TLS hacia DB remota si corresponde
```

---

# Flujo recomendado de validación

Antes de entregar un cambio:

```text
1. Revisar git status
2. Ejecutar pruebas relacionadas
3. Ejecutar suite general
4. Ejecutar pruebas MySQL si el cambio afecta persistencia
5. Ejecutar responsive si afecta UI
6. Ejecutar npm audit cuando corresponda
7. Ejecutar node --check o CI de sintaxis
8. Ejecutar git diff --check
9. Revisar git diff
10. Documentar únicamente el comportamiento vigente
```

---

# Método incremental

El proyecto sigue una estrategia similar a:

```text
baseline
↓
cambio pequeño
↓
prueba relacionada
↓
corrección
↓
refactor
↓
suite completa
```

Los cambios grandes deben dividirse cuando sea razonable.

Esto facilita identificar regresiones.

---

# Qué probar según el tipo de cambio

## Cambio frontend

Ejecutar principalmente:

```text
suite general
browser
responsive
structure
```

---

## Cambio Service

Ejecutar:

```text
tests de dominio
API
suite general
```

---

## Cambio Repository

Ejecutar:

```text
Repository simulado
suite general
MySQL real
```

---

## Cambio de migraciones

Ejecutar:

```text
MySQL real
migraciones sobre base _test limpia
migraciones repetidas
verificación de checksum
integridad PK/FK/UNIQUE/CHECK
```

---

## Cambio de autenticación o seguridad

Ejecutar pruebas relacionadas con:

```text
login
sesión
cookies
CSRF
roles
ownership
origen
rate limits
errores
```

y después la suite general.

---

# Protección de la base principal

La regla más importante para las pruebas SQL es:

```text
reactiva_pereira
=
datos de desarrollo que queremos conservar
```

y:

```text
reactiva_pereira_test
=
base descartable para pruebas
```

Nunca deben confundirse.

Antes de una suite destructiva se debe verificar:

```bash
echo "$DB_NAME"
```

y confirmar que termina en:

```text
_test
```

---

# Resumen para sustentación

## ¿Cómo se protegen las contraseñas?

Con:

```text
scrypt
+
salt aleatoria
```

No se guardan en texto plano.

---

## ¿Cómo se autentica un Usuario?

Mediante una sesión opaca asociada a una cookie:

```text
HttpOnly
SameSite=Strict
```

---

## ¿Qué diferencia hay entre autenticación y autorización?

Autenticación:

```text
¿Quién eres?
```

Autorización:

```text
¿Tienes permiso para esta operación?
```

---

## ¿Cómo se protege una escritura?

Según la operación:

```text
sesión
+
rol
+
propiedad
+
CSRF
+
origen
+
validación
```

---

## ¿Cómo se protege MySQL?

Mediante:

```text
consultas parametrizadas
FK
UNIQUE
CHECK
transacciones
bloqueos
variables de entorno
Repository
```

---

## ¿Cómo se evita que el cliente cambie el precio de un Pedido?

El backend ignora precios enviados por cliente.

Consulta:

```text
producto.precio
```

y genera internamente:

```text
detalle_pedido.precio_unitario
```

---

## ¿Cómo se evita vender más stock del disponible?

El backend:

```text
inicia transacción
↓
bloquea Productos
↓
consulta stock real
↓
valida
↓
descuenta
↓
COMMIT
```

---

## ¿Cómo se evita superar cupos de una Reserva?

Durante POST:

```text
transacción
↓
recalcular disponibilidad
↓
comprobar cupo
↓
crear Reserva
```

---

## ¿Dónde deben ejecutarse las pruebas MySQL?

Exclusivamente en una base dedicada terminada en:

```text
_test
```

---

## ¿Las pruebas garantizan que el sistema es completamente seguro?

No.

Proporcionan evidencia automatizada sobre comportamientos concretos, pero no sustituyen:

```text
pentesting
revisión profesional
pruebas de carga
auditoría de infraestructura
```

---

# Regla final

La seguridad de Reactiva Pereira debe conservarse como parte de la arquitectura, no agregarse únicamente al final.

Cada nueva funcionalidad debe revisar:

```text
¿Qué datos recibe?

¿Quién puede ejecutarla?

¿A qué recurso puede acceder?

¿Qué debe validar el servidor?

¿Qué ocurre si dos usuarios lo hacen al mismo tiempo?

¿Qué información se devuelve?

¿Qué error se expone?

¿Qué prueba demuestra el comportamiento?
```

Estas preguntas forman parte del desarrollo normal del proyecto.