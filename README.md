# Reactiva Pereira

Reactiva Pereira es un marketplace web desarrollado como proyecto universitario de Ingeniería de Software para apoyar la reactivación económica y dar visibilidad a comercios de Pereira y su área metropolitana.

La plataforma permite registrar usuarios, publicar negocios, productos y servicios, gestionar reservas, favoritos y pedidos, y consultar la oferta comercial desde una interfaz web responsive.

El proyecto utiliza una API REST propia. El frontend nunca se conecta directamente a la base de datos.

---

## Arquitectura general

```text
Usuario
↓
Frontend
↓
fetch()
↓
HTTP Request
↓
Express
↓
Ruta
↓
Controller
↓
Service
↓
Repository
↓
MySQL / MariaDB
↓
HTTP Response
↓
JSON
↓
Frontend
↓
DOM
```

La arquitectura permite separar claramente la interfaz, las reglas de negocio y la persistencia.

El Repository actúa como intermediario entre la lógica del backend y la base de datos.

---

## Stack tecnológico

### Frontend

- HTML5
- CSS3
- JavaScript nativo
- Fetch API
- Diseño responsive

No se utilizan frameworks frontend ni frameworks CSS.

### Backend

- Node.js 24
- Express 5
- API REST
- JSON
- mysql2/promise

No se utiliza ORM.

### Base de datos

- MySQL / MariaDB
- XAMPP para el entorno local de desarrollo
phpMyAdmin para administración visual

La aplicación fue probada localmente con XAMPP y MariaDB 10.4.32.

El entorno de integración del repositorio utiliza MySQL 8.4.

---

## Persistencia

Reactiva Pereira dispone de dos modos de almacenamiento.

### Memory

```text
DATA_SOURCE=memory
```

Utiliza estructuras temporales en memoria.

Es útil para pruebas automatizadas y desarrollo aislado.

Los datos desaparecen cuando termina el proceso de Node.js.

### MySQL

```text
DATA_SOURCE=mysql
```

Utiliza la base de datos configurada mediante las variables `DB_*`.

Los usuarios, negocios, productos, servicios, reservas, favoritos y pedidos quedan almacenados de forma persistente.

Cerrar Node.js, detener XAMPP o reiniciar el computador no elimina estos registros.

Las sesiones de autenticación y los rate limits sí permanecen en memoria del proceso y no constituyen persistencia permanente.

---

## Modelo de datos

El modelo de negocio está compuesto por exactamente once entidades:

1. Rol
2. Usuario
3. Categoria
4. Negocio
5. Producto
6. Servicio
7. Horario_Servicio
8. Reserva
9. Favorito
10. Pedido
11. Detalle_Pedido

Las tablas físicas correspondientes son:

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

Además existen dos tablas técnicas:

```text
repository_lock
schema_migrations
```

Estas dos tablas no forman parte del DER del negocio.

### repository_lock

Es utilizada internamente por el Repository para coordinar determinadas operaciones transaccionales.

### schema_migrations

Registra las migraciones SQL que ya fueron aplicadas y sus checksums.

Esto permite detectar migraciones incompletas o modificaciones posteriores a una migración ya ejecutada.

---

## Migraciones de base de datos

Las migraciones se encuentran en:

```text
backend/db/migrations/
```

Actualmente existen:

```text
001_foundation.sql
002_reference_data.sql
003_services_reservations_favorites.sql
004_orders_and_details.sql
```

### 001_foundation.sql

Crea las entidades fundamentales:

```text
Rol
Categoria
Usuario
Negocio
Producto
```

También crea la tabla técnica `repository_lock`.

### 002_reference_data.sql

Carga los datos de referencia necesarios para la aplicación, principalmente roles y categorías.

Los roles operativos actuales son:

```text
Administrador
Comerciante
Comprador
```

### 003_services_reservations_favorites.sql

Agrega:

```text
Servicio
Horario_Servicio
Reserva
Favorito
```

### 004_orders_and_details.sql

Agrega:

```text
Pedido
Detalle_Pedido
```

Las migraciones se ejecutan en orden mediante:

```bash
npm run db:migrate --prefix backend
```

Ejecutarlas nuevamente no vuelve a crear las tablas si ya aparecen correctamente registradas como aplicadas.

---

## Relaciones principales

Un Usuario pertenece a un Rol.

Un Comerciante puede tener como máximo un Negocio.

Un Negocio pertenece a una Categoria.

Un Negocio puede tener muchos Productos.

Un Negocio puede ofrecer muchos Servicios.

Un Producto pertenece a un Negocio y una Categoria.

Un Servicio pertenece a un Negocio y una Categoria.

Un Servicio puede tener varios Horarios.

Un Usuario comprador puede realizar Reservas.

Un Usuario comprador puede marcar Productos como Favoritos.

Un Usuario comprador puede realizar Pedidos.

Un Pedido pertenece a un Negocio y contiene uno o más Detalles_Pedido.

Cada Detalle_Pedido referencia un Producto.

---

## Roles de la aplicación

### Visitante

Puede consultar información pública del marketplace, negocios, productos y servicios.

### Comprador

Puede registrarse, iniciar sesión, consultar el catálogo, utilizar el carrito, realizar pedidos, reservar servicios y gestionar favoritos.

### Comerciante

Puede gestionar su negocio, productos, servicios, horarios, reservas recibidas y pedidos asociados a su comercio.

### Administrador

Puede gestionar usuarios y consultar o administrar globalmente los principales recursos de la plataforma.

Los permisos reales siempre se comprueban nuevamente en el backend.

Ocultar un botón en el frontend no constituye autorización.

---

## API REST

La API utiliza como prefijo:

```text
/api
```

### Autenticación

```text
POST /api/auth/registro
POST /api/auth/login
GET  /api/auth/me
GET  /api/auth/sesion
POST /api/auth/logout
```

### Usuarios

```text
GET    /api/usuarios
GET    /api/usuarios/:id
POST   /api/usuarios
PUT    /api/usuarios/:id
DELETE /api/usuarios/:id
```

La administración directa de usuarios está protegida por rol Administrador.

### Recursos principales

La aplicación también expone rutas REST para:

```text
/api/categorias
/api/negocios
/api/productos
/api/servicios
/api/horarios-servicio
/api/reservas
/api/favoritos
/api/pedidos
```

Los endpoints específicos y sus contratos se documentan en:

```text
docs/API.md
```

---

## Códigos HTTP principales

La API utiliza, entre otros:

```text
200 OK
201 Created
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
415 Unsupported Media Type
500 Internal Server Error
```

Los errores son procesados por middleware del backend y no se exponen detalles internos innecesarios al cliente.

---

## Seguridad

Reactiva Pereira incorpora varias medidas de seguridad en el backend.

Las contraseñas no se almacenan en texto plano.

El proyecto utiliza hashes basados en `scrypt`.

La autenticación utiliza cookies de sesión HttpOnly.

Las cookies utilizan SameSite Strict.

La API implementa protección CSRF para operaciones sensibles.

También se aplican comprobaciones de origen, rate limiting, validaciones de datos, autorización por roles y autorización por propiedad de los recursos.

Las consultas SQL utilizan parámetros para los valores recibidos.

Las credenciales de la base de datos y otros secretos no deben almacenarse dentro del código fuente.

El archivo:

```text
backend/.env
```

está excluido de Git mediante `.gitignore`.

La aplicación no guarda contraseñas ni tokens de autenticación en `localStorage`.

---

## Instalación

El proyecto utiliza Node.js 24 como versión objetivo.

El archivo:

```text
.nvmrc
```

contiene:

```text
24
```

Si se utiliza NVM:

```bash
nvm use
```

Para instalar las dependencias del backend:

```bash
npm ci --prefix backend
```

Para trabajar con las herramientas de interfaz y regeneración de assets:

```bash
npm ci
```

Para instalar las dependencias de las pruebas de navegador:

```bash
npm ci --prefix tests
```

---

## Configuración del backend

Existe un archivo de ejemplo:

```text
backend/.env.example
```

Puede copiarse como:

```bash
cp backend/.env.example backend/.env
```

El archivo `.env` real no debe subirse a GitHub.

### Ejemplo para MySQL / MariaDB

```env
PORT=3000
NODE_ENV=development

DATA_SOURCE=mysql

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=reactiva_pereira
DB_USER=root
DB_PASSWORD=
```

En instalaciones reales deben utilizarse credenciales adecuadas y una contraseña segura.

El uso de `root` sin contraseña únicamente se contempla como simplificación del entorno académico/local con XAMPP y no es una configuración apropiada para producción.

---

## XAMPP en Linux

Para el entorno local utilizado durante el desarrollo se puede iniciar únicamente Apache y MySQL.

```bash
sudo /opt/lampp/lampp startapache
sudo /opt/lampp/lampp startmysql
```

También pueden ejecutarse consecutivamente:

```bash
sudo /opt/lampp/lampp startapache && sudo /opt/lampp/lampp startmysql
```

Para verificar el estado:

```bash
sudo /opt/lampp/lampp status
```

Para detenerlos:

```bash
sudo /opt/lampp/lampp stopapache && sudo /opt/lampp/lampp stopmysql
```

Apache permite acceder localmente a phpMyAdmin.

```text
http://localhost/phpmyadmin
```

MySQL/MariaDB es el servidor que conserva los datos de Reactiva Pereira.

---

## Crear la base de datos

Antes de ejecutar las migraciones debe existir una base vacía llamada:

```text
reactiva_pereira
```

Puede crearse desde phpMyAdmin utilizando:

```text
utf8mb4_unicode_ci
```

como cotejamiento.

Después se ejecutan las migraciones:

```bash
npm run db:migrate --prefix backend
```

Al finalizar deben existir las once tablas de negocio y las dos tablas técnicas.

---

## Ejecutar la aplicación

Con XAMPP/MySQL activo y `backend/.env` correctamente configurado:

```bash
npm start --prefix backend
```

El servidor mostrará un mensaje similar a:

```text
Reactiva Pereira disponible en puerto 3000. DATA_SOURCE=mysql.
```

La aplicación se abre en:

```text
http://localhost:3000
```

Express sirve tanto el frontend como la API.

Por este motivo, en el funcionamiento normal del proyecto frontend y backend comparten origen y el navegador no necesita conectarse directamente a MySQL.

---

## Desarrollo con Nodemon

Para reiniciar automáticamente el servidor cuando cambia código del backend:

```bash
npm run dev --prefix backend
```

Nodemon es una dependencia de desarrollo y no es necesario para ejecutar la aplicación normalmente.

---

## Recorrido de un registro de usuario

Cuando una persona se registra ocurre aproximadamente este flujo:

```text
Usuario
↓
Formulario HTML
↓
JavaScript
↓
fetch()
↓
POST /api/auth/registro
↓
Express
↓
Controller
↓
UsuarioService
↓
Repository
↓
INSERT INTO usuario
↓
MySQL / MariaDB
↓
Repository
↓
JSON
↓
Frontend
```

Con `DATA_SOURCE=mysql`, el usuario queda almacenado en la tabla `usuario`.

Si posteriormente se reinicia Node.js o el computador, el usuario continúa existiendo en la base de datos.

---

## Recorrido de un producto

La persistencia de productos funciona bajo el mismo principio:

```text
Comerciante
↓
Frontend
↓
POST /api/productos
↓
Express
↓
ProductoService
↓
Repository
↓
INSERT INTO producto
↓
MySQL / MariaDB
```

Al volver a iniciar la aplicación, los productos son recuperados nuevamente mediante consultas SQL.

---

## Pedidos y stock

El carrito se mantiene temporalmente en el navegador.

Cuando el Comprador confirma una compra, el backend valida los productos, negocios, cantidades, precios y stock.

Los pedidos se agrupan por negocio.

El servidor genera registros en:

```text
pedido
detalle_pedido
```

El precio unitario se conserva en `detalle_pedido` como información histórica del pedido.

Las operaciones que modifican stock se realizan dentro de transacciones para evitar dejar cambios parciales.

Los estados principales de un pedido son:

```text
Pendiente
Confirmado
Completado
Cancelado
```

No existe una tabla de Carrito persistente.

---

## Servicios y reservas

Los Comerciantes pueden publicar servicios asociados a su negocio.

Cada Servicio puede tener uno o varios Horarios_Servicio.

La disponibilidad no se almacena en una tabla independiente.

Se calcula utilizando:

```text
Horario del servicio
+
Duración
+
Capacidad
+
Reservas confirmadas
```

Las reservas conservan su historial y pueden pasar a estado Cancelada.

---

## Favoritos

Favorito representa la relación entre:

```text
Usuario
↕
Producto
```

Un mismo usuario no puede agregar dos veces el mismo producto como favorito debido a una restricción única en la base de datos.

---

## Interfaz

Reactiva Pereira utiliza una identidad visual basada en rojo, amarillo y crema.

La interfaz combina:

```text
Playfair Display
Inter
```

Los títulos e identidad utilizan una tipografía Serif.

Los elementos funcionales como navegación, formularios, botones y tarjetas utilizan Sans Serif.

La interfaz está diseñada para escritorio, tablet y dispositivos móviles.

El CSS fuente se encuentra organizado en:

```text
frontend/css/tokens.css
frontend/css/base.css
frontend/css/layout.css
frontend/css/components.css
frontend/css/pages.css
frontend/css/animations.css
```

El archivo:

```text
frontend/css/estilos.css
```

es generado por el proceso de assets.

Para regenerarlo:

```bash
npm run assets
```

---

## Estructura principal

```text
MarketplacePereira/
│
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── db/
│   │   └── migrations/
│   ├── middleware/
│   ├── repositories/
│   │   ├── memory.repository.js
│   │   └── mysql/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── app.js
│   └── package.json
│
├── frontend/
│   ├── assets/
│   ├── css/
│   ├── js/
│   └── *.html
│
├── docs/
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   └── SECURITY_TESTING.md
│
├── tests/
│
├── scripts/
│
├── .github/
│   └── workflows/
│
├── .gitignore
├── .nvmrc
├── AGENTS.md
├── package.json
└── README.md
```

---

## Responsabilidad de las capas

### Routes

Definen los endpoints y métodos HTTP.

### Controllers

Reciben las peticiones HTTP y generan las respuestas.

### Services

Contienen las reglas de negocio, permisos y validaciones principales.

### Repositories

Abstraen el almacenamiento.

Permiten que los Services trabajen sin depender directamente de SQL.

### DB

Contiene la configuración del pool, ejecución de migraciones y archivos SQL.

### Frontend

Consume la API mediante `fetch()` y transforma las respuestas JSON en elementos visibles del DOM.

---

## Repository Pattern

El backend dispone de dos implementaciones principales:

```text
Memory Repository
MySQL Repository
```

Los Services utilizan una interfaz común y no necesitan saber cómo se almacenan físicamente los datos.

Por ejemplo:

```text
UsuarioService
↓
repos.usuario.create()
```

En modo memory termina en una estructura JavaScript.

En modo mysql termina en una operación SQL sobre la tabla `usuario`.

El Repository MySQL también traduce nombres del modelo académico.

Por ejemplo:

```text
id_usuario       → id
id_rol           → rolId
nombre_rol       → nombre
contrasena_hash  → passwordHash
id_negocio       → negocioId
id_categoria     → categoriaId
```

Esto permite conservar nombres SQL claros y académicos sin obligar al resto del backend a trabajar directamente con esos nombres.

---

## Pruebas

La aplicación dispone de pruebas para backend, API, interfaz, responsive y persistencia.

La suite principal puede ejecutarse con:

```bash
npm test --prefix tests
```

Las pruebas del backend pueden ejecutarse con:

```bash
npm test --prefix backend
```

Las pruebas responsive utilizan:

```bash
npm run test:responsive --prefix tests
```

Las pruebas reales contra MySQL utilizan:

```bash
npm run test:mysql --prefix tests
```

Estas últimas deben utilizar exclusivamente una base de datos dedicada cuyo nombre termine en:

```text
_test
```

Nunca deben ejecutarse contra `reactiva_pereira` si contiene datos que se desean conservar, porque las pruebas de integración pueden eliminar sus fixtures y registros.

---

## Integración continua

GitHub Actions se encuentra configurado en:

```text
.github/workflows/ci.yml
```

El workflow utiliza Node.js 24.

La integración de base de datos utiliza un servidor MySQL 8.4 temporal exclusivo para las pruebas.

---

## Documentación

La documentación complementaria se encuentra en:

```text
docs/API.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/SECURITY_TESTING.md
```

Estos documentos describen respectivamente:

```text
Contratos HTTP y endpoints
Arquitectura del sistema
Modelo y operación de la base de datos
Seguridad y estrategia de pruebas
```

---

## Lo que no forma parte del modelo

Actualmente Reactiva Pereira no implementa entidades independientes para:

```text
Pago
Factura
Método de pago
Inventario
Disponibilidad
Sector_Comercial
Carrito
```

El proyecto tampoco procesa pagos reales.

Cualquier futura integración financiera deberá diseñarse como un módulo independiente y revisar requisitos de seguridad adicionales.

---

## Alcance académico

Reactiva Pereira es un proyecto universitario orientado al aprendizaje y aplicación de conceptos de Ingeniería de Software:

```text
API REST
HTTP
CRUD
Node.js
Express
JavaScript
Fetch
JSON
Arquitectura por capas
Persistencia
SQL
MySQL
Claves primarias
Claves foráneas
Relaciones
Transacciones
Seguridad web
Pruebas automatizadas
Git y GitHub
```

Aunque incorpora varias prácticas de seguridad y arquitectura, no debe asumirse automáticamente como una plataforma preparada para producción pública.

Un despliegue real requeriría, entre otros aspectos, configuración HTTPS, credenciales de base de datos dedicadas, backups, monitoreo, endurecimiento del servidor, gestión segura de secretos y revisión de seguridad previa a producción.

---

## Autores

- Bryan Alejandro Valencia
- Juan Betancur Arana
- Angel Gabriel Gutierrez

Proyecto universitario de Ingeniería de Software.

**Reactiva Pereira – Marketplace de comercios afectados**