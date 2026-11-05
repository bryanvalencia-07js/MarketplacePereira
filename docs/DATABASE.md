# Persistencia y modelo relacional

## Decisiones del modelo

El esquema parte de los DTOs que realmente consumen `usuario.service.js`, `negocio.service.js` y `producto.service.js`:

```text
Usuario 1 ── 0..1 Negocio
Negocio 1 ── 0..N Producto
```

Un negocio puede estar recién creado y no tener productos; cada producto pertenece obligatoriamente a un negocio. Un propietario debe ser Comerciante. No existen Pago, Pedido, Venta ni Factura. El carrito local no es una entidad transaccional de compra.

Los roles son tres valores estables sin CRUD propio; `rol VARCHAR(20)` con CHECK conserva el contrato y evita una tabla de catálogo innecesaria. Si aparecen permisos configurables, esta decisión se revisará en otra migración.

| Tabla | Campos y tipos principales | Restricciones |
|---|---|---|
| `usuarios` | id INT UNSIGNED, nombre/apellido VARCHAR(80), correo VARCHAR(254), telefono VARCHAR(30), passwordHash VARCHAR(255), rol, estado, fechas | PK id, UNIQUE correo, correo en minúsculas, CHECK rol/estado, NOT NULL |
| `negocios` | id, usuarioId, usuarioRol, nombre VARCHAR(120), categoria VARCHAR(60), telefono VARCHAR(30), direccion VARCHAR(200), estado, fechas | PK id, UNIQUE usuarioId, FK de propietario y rol, CHECK estado/rol, NOT NULL |
| `productos` | id, negocioId, nombre VARCHAR(120), descripcion VARCHAR(2000), categoria VARCHAR(60), precio DECIMAL(12,2), stock INT, imagen MEDIUMTEXT, estado, popularidad INT UNSIGNED, fechas | PK id, FK negocioId, CHECK precio/stock/estado/tamaño de imagen, NOT NULL |

`usuarioRol` es una columna técnica fija a `Comerciante`, con CHECK y FK compuesta `(usuarioId, usuarioRol) → usuarios(id, rol)`. El índice UNIQUE `(id, rol)` permite esa referencia. La base impide asociar un Comprador/Administrador y cambiar el rol de un dueño con negocio. La columna técnica no aparece en DTOs. `propietario` se proyecta desde nombre/apellido del usuario, sin duplicarlo en SQL.

FK con `ON DELETE RESTRICT ON UPDATE RESTRICT`, sin cascadas destructivas. El correo usa comparación sensible a acentos y mayúsculas, pero se normaliza a minúsculas en services y se refuerza con CHECK. El resto de textos usa `utf8mb4_0900_as_cs`. La API mantiene validaciones de campos, firma de imagen, permisos y mensajes; los CHECK complementan esas reglas, no sustituyen services.

IDs autoincrementales de 32 bits sin signo (representables con exactitud por JavaScript); no se reinicia AUTO_INCREMENT en operación normal. Fechas DATETIME(3) en UTC y DTO ISO 8601. `precio` permanece DECIMAL en SQL y se convierte explícitamente a Number para conservar el contrato HTTP, dentro del límite vigente de 1 000 000 000 con dos decimales. `telefono` opcional de usuario se representa como cadena vacía cuando falta.

Índices: correo único; usuario/rol; usuarioId único y FK compuesta; producto.negocioId; `(rol, estado)` de usuarios; `(estado, categoria)` de negocios y productos. Los listados existentes todavía se filtran en services, por compatibilidad: estos índices no implican paginación ni búsquedas optimizadas implementadas.

## Configurar y arrancar

Requiere **MySQL >= 8.0.16**, por aplicación efectiva de CHECK; recomendado 8.4 LTS. MariaDB no se declara compatible. Crear una base vacía UTF-8 y un usuario dedicado con contraseña privada mediante la administración habitual de MySQL; no usar root para la aplicación. No hay credenciales predeterminadas.

Completar `backend/.env` (ignorado por Git):

```dotenv
DATA_SOURCE=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=reactiva_pereira
DB_USER=reactiva_app
DB_PASSWORD=<configurar-localmente>
```

El valor entre ángulos es un marcador, no una contraseña distribuida. Las cinco variables se validan; el puerto predeterminado es 3306. `DATA_SOURCE=memory` no abre conexiones ni requiere configuración DB. No existe fallback silencioso al fallar MySQL.

```bash
npm ci --prefix backend
npm run db:migrate --prefix backend
npm start --prefix backend
```

Crear la base requiere un operador; el runner no crea bases, usuarios ni grants. Para migraciones, otorgar al usuario de migración CREATE/ALTER/INDEX/REFERENCES y DML sobre esa base. El usuario de ejecución solo necesita SELECT/INSERT/UPDATE/DELETE sobre las entidades, SELECT sobre `schema_migrations` y SELECT sobre `repository_lock`. Se pueden usar credenciales de migración distintas pasando sus variables al comando y retirar privilegios DDL después. No se necesita configuración DB en el navegador.

El pool limita conexiones a 10, cola a 100 y conexión inicial a 10 segundos. Cada conexión arrendada configura UTF-8, UTC y modo SQL estricto antes de usarla. La aplicación cierra el pool al recibir SIGTERM/SIGINT y al fallar el arranque. Consultas de usuario siempre parametrizadas mediante `execute`; identificadores salen de listas cerradas. `multipleStatements` permanece deshabilitado.

## Migraciones

`backend/db/migrations/001_foundation.sql` contiene únicamente el esquema de entidades, índices y la fila de bloqueo técnico. Sin datos demo. `schema_migrations` registra nombre, SHA-256, estado aplicado y fecha. El runner ordena archivos numéricos, usa una conexión y `GET_LOCK` para excluir otros runners. Repetir el comando no altera datos de migraciones ya aplicadas.

**No editar migraciones aplicadas**. Añadir un archivo nuevo para cambios de esquema. El SQL de migraciones usa sentencias simples separadas por `;`; no admite `DELIMITER`, procedimientos ni separadores dentro de literales/comentarios. Ampliar el runner antes de introducir esos formatos.

DDL MySQL hace commit implícito: una migración fallida puede dejar tablas parciales. El runner registra primero el intento; si falla, queda `applied=false` y el siguiente intento se detiene. Una suma distinta también detiene la ejecución. No se marca éxito ni se ejecuta rollback ficticio de DDL.

Ante fallo: detener arranques concurrentes, inspeccionar el error y los objetos creados, respaldar datos si existen y resolver con un operador. En una base **vacía de pruebas** se puede recrear la base y repetir. En una base con datos no borrar tablas ni alterar `schema_migrations` a ciegas: reparar el esquema y comprobarlo contra el archivo antes de marcar el intento como aplicado. No existe down automático destructivo.

Antes de cambios de esquema o despliegues: respaldo con la herramienta de operación MySQL (por ejemplo mysqldump) y comprobación de restauración en otra base. Esta PR no convierte memory/LocalStorage en una fuente importable automáticamente ni ofrece recuperación certificada.

## Contrato y transacciones

| Método | Resultado |
|---|---|
| `list()` | Array de DTOs nuevos |
| `find(id)` | DTO o null |
| `create(datos)` | DTO con id y fechas generadas |
| `update(id, datos)` | DTO o null; preserva id/createdAt |
| `delete(id)` | Booleano |
| `transaccion(callback)` | Resultado del callback o error |

`createRepositories(datos)` conserva memory. `repositoriesFromConfig(config)` selecciona el adaptador; `createApplication` permite inyectarlo para pruebas. Los métodos MySQL de escritura abren transacción si se invocan fuera de una; dentro usan la conexión del contexto. `propietario`, IDs/fechas y campos ajenos al modelo no se escriben desde el DTO de entrada.

```text
getConnection → configurar sesión → BEGIN
→ SELECT id FROM repository_lock WHERE id=1 FOR UPDATE
→ AsyncLocalStorage.run(connection, callback)
→ COMMIT
error → ROLLBACK
finally → release (destroy si no se puede revertir)
```

El bloqueo global es deliberado: reproduce la exclusión de memory entre todos los procesos que usan este adaptador y preserva comprobaciones `list → validar → escribir` sin reescribir services. Evita carreras del último administrador y pérdida de incrementos de popularidad. Se libera por commit/rollback. Es una decisión simple para este marketplace académico; limita el rendimiento de escritura y requiere revisar bloqueos más granulares al crecer. Escritores SQL externos no respetan esa fila: UNIQUE/FK/CHECK siguen protegiendo integridad, pero deben respetar también las reglas de aplicación.

No hay transacciones anidadas: se rechazan explícitamente. El callback debe esperar todo su trabajo asincrónico; no lanzar tareas sueltas que continúen después del commit. No se hacen reintentos automáticos de callbacks con posibles efectos externos. Errores de integridad se convierten a errores seguros 400; otros errores llegan al middleware genérico sin revelar SQL. Memory serializa por proceso, pero **no** tiene rollback de callbacks arbitrarios.

## Pruebas

La suite normal no necesita MySQL. `npm run test:mysql --prefix tests` exige `DATA_SOURCE=mysql` y `DB_NAME` terminada en `_test`, aplica/verifica migraciones y borra entidades antes de cada caso. Nunca usar datos del usuario. La CI usa MySQL 8.4; validación local realizada también con MySQL 8.0.46. Detalle en [SECURITY_TESTING](SECURITY_TESTING.md).
