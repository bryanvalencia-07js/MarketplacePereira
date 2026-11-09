# Persistencia y modelo relacional

## Fundación normalizada (PR5)

`001_foundation.sql` permanece intacta, con SHA-256 `d527db03c8dfa21e30d042cd0061da30191aafb7134de071a31ace4bd1ca21ca`. Describe el esquema anterior: `usuarios.rol` textual, `negocios.categoria` y `productos.categoria` textuales, `negocios.usuarioRol` técnico y `productos.popularidad`. PR5 añade exclusivamente `002_normalize_roles_categories.sql`.

```text
Rol       1 ── N Usuario
Usuario   1 ── 0..1 Negocio
Categoria 1 ── N Negocio
Categoria 1 ── N Producto
Negocio   1 ── N Producto
```

| Entidad / tabla | Campos físicos relevantes | Integridad |
|---|---|---|
| Rol / `roles` | id, nombre, descripcion nullable | PK, nombre UNIQUE, tres roles de referencia |
| Usuario / `usuarios` | id, rolId, nombre, apellido, correo, telefono, passwordHash, estado, createdAt, updatedAt | FK rolId, correo UNIQUE, CHECK correo/estado |
| Categoria / `categorias` | id, nombre, descripcion nullable, estado | PK, nombre UNIQUE, CHECK nombre/estado |
| Negocio / `negocios` | id, usuarioId, categoriaId, nombre, descripcion nullable, direccion, municipio nullable, telefono, estado, fechas | FK usuario/categoría, UNIQUE usuarioId, CHECK estado |
| Producto / `productos` | id, negocioId, categoriaId, nombre, descripcion, precio, imagen, stock, visitas, estado, fechas | FK negocio/categoría, CHECK precio > 0, stock >= 0, visitas >= 0, estado/imagen |

Los tres roles tienen identidad persistente en `roles`; services y repositories resuelven su significado por `nombre`, sin IDs numéricos de privilegio. Los catálogos solo exponen `list/find` al backend y no hay CRUD público de roles/categorías. La API permite únicamente Comerciante/Comprador en registro, rechazando `rolId`, `idRol` e `id_rol` como campos de entrada.

`usuarioRol` se retira definitivamente. La FK simple garantiza que exista el usuario y el backend verifica `Usuario → Rol` al asignar propietario o cambiar el rol de una cuenta con negocio. Esa regla transversal se ejecuta dentro de la transacción con `repository_lock`; no se simula mediante una columna duplicada ni un CHECK entre tablas. SQL externo puede saltarse esa regla de aplicación: los operadores deben respetarla. El propietario visible sigue derivándose del usuario mediante JOIN.

### Migración de una base con datos

Detener la aplicación y escritores externos, verificar un respaldo restaurable y ejecutar el runner. El despliegue de código y 002 requiere esta ventana: el código nuevo exige 002 y el código anterior usa columnas retiradas. No es una migración online compatible con ambos binarios.

1. Una tabla temporal técnica con CHECK aborta si existen categorías vacías o `Todas`. No se inventa una categoría ni se elimina un registro para ocultar ese caso. Corregir el dato histórico con un operador y el respaldo, según la recuperación de intentos incompletos descrita abajo.
2. Se crean `roles` con Administrador, Comerciante y Comprador y `categorias` con los 24 nombres que utilizaba la interfaz. Se incorporan también las categorías históricas distintas de negocios **y** productos.
3. Solo se colapsa espacio en blanco y se recortan extremos. La comparación UNIQUE `utf8mb4_0900_ai_ci` reúne variantes de mayúsculas/acentos; el nombre del catálogo conocido prevalece. Para nombres nuevos se elige una variante determinista. No se fusionan sinónimos ni se recategoriza contenido por inferencia.
4. Se agregan FK inicialmente nullable, se rellenan mediante JOIN y se verifica que no falten roles/categorías ni haya propietarios de rol incorrecto. Después se hacen NOT NULL y se retiran los textos redundantes e índices antiguos, reconstruyendo FK e índices.
5. `popularidad` se renombra físicamente a `visitas` sin recalcular ni incrementar. El valor 37 continúa siendo 37. No se modifican hashes, IDs, relaciones, fechas, estados, precios, stock, imágenes ni textos ajenos a categorías.
6. `descripcion` y `municipio` de negocios históricos quedan en NULL. Los formularios permiten completar información real de Pereira o el área metropolitana, con límites de 2000/80 caracteres; vacío/null conserva ausencia de información. Endurecer NOT NULL requiere una migración posterior después de completar los datos.

La tabla temporal no es una entidad de negocio. El esquema de negocio implementado contiene exactamente cinco tablas; `schema_migrations` y `repository_lock` siguen siendo infraestructura. Todas las tablas de negocio son InnoDB/utf8mb4, FK RESTRICT sin cascadas destructivas. Se preservan los CHECK previos de estado, precio, stock, imagen y correo. Los índices `(estado,categoriaId)` y `(rolId,estado)` reemplazan sus variantes textuales.

### DER académico y contratos existentes

| DER | MySQL / objeto interno / API |
|---|---|
| id_rol / nombre_rol | roles.id / roles.nombre; usuarios.rolId; API rol textual por JOIN |
| id_categoria / nombre_categoria | categorias.id / categorias.nombre; categoriaId; API categoria textual por JOIN |
| id_usuario / id_negocio / id_producto | id en cada entidad; FK usuarioId / negocioId |
| nombre_negocio / nombre_producto | nombre |
| direccion_comercial / telefono_contacto | negocios.direccion / negocios.telefono |
| contraseña_hash | passwordHash, exclusivamente interno, eliminado del DTO público |
| fecha_registro | createdAt, UTC e ISO 8601 en API |
| visitas | productos.visitas; alias de respuesta popularidad por compatibilidad |

La API mantiene `rol` y `categoria` textuales, agrega `rolId`, `categoriaId` y `visitas` sin renombrar masivamente contratos. `popularidad` es un alias calculado de `visitas` en ambos adaptadores, sin almacenamiento duplicado; el frontend nuevo usa `visitas`. Ninguno de los dos contadores se admite como entrada HTTP de creación/edición. La visita al detalle sigue incrementando una sola vez el mismo valor bajo bloqueo transaccional.

IDs INT UNSIGNED, fechas DATETIME(3) UTC, precio DECIMAL(12,2) convertido a Number en DTO; se mantienen los límites vigentes. El correo se normaliza a minúsculas en services y CHECK. Los demás textos conservan `utf8mb4_0900_as_cs`, salvo el nombre de categoría indicado arriba.

`DATA_SOURCE=memory` guarda FK y visitas en su almacén por instancia y proyecta los mismos DTOs, con roles/categorías de referencia. Acepta fixtures antiguos importando sus categorías una vez al construir el adaptador; eso no ofrece importación de datos de producción ni permite crear categorías por HTTP. El repositorio genérico memory conserva el soporte de fixtures parciales; los services son la frontera obligatoria de validación de entradas HTTP.

Asignar explícitamente una categoría inexistente/inactiva produce 400. Un recurso histórico con categoría desactivada puede conservar su relación al editar otros atributos omitiendo `categoria`; una nueva asignación debe ser activa. El endpoint público y los selects solo ofrecen categorías activas. No se añade administración visual de categorías.

### Alcance futuro del DER

El DER global aprobado tiene exactamente once entidades. PR6 añadirá Servicio, Horario_Servicio, Reserva y Favorito; `Categoria 1:N Servicio` queda documentada para esa fase. PR7 añadirá Pedido y Detalle_Pedido. Estas seis entidades no tienen tablas, repositories, pantallas ni endpoints en PR5. No existe Inventario: stock pertenece al producto. No existe Sector_Comercial: Categoria clasifica negocios y productos (y posteriormente servicios). Pago y Factura quedan fuera del DER aprobado y del alcance.

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

Crear la base requiere un operador; el runner no crea bases, usuarios ni grants. Para migraciones, otorgar al usuario de migración CREATE/ALTER/INDEX/REFERENCES/CREATE TEMPORARY TABLES y DML sobre esa base. El usuario de ejecución solo necesita SELECT/INSERT/UPDATE/DELETE sobre las entidades, SELECT sobre `schema_migrations` y SELECT sobre `repository_lock`. Se pueden usar credenciales de migración distintas pasando sus variables al comando y retirar privilegios DDL después. No se necesita configuración DB en el navegador.

El pool limita conexiones a 10, cola a 100 y conexión inicial a 10 segundos. Cada conexión arrendada configura UTF-8, UTC y modo SQL estricto antes de usarla. La aplicación cierra el pool al recibir SIGTERM/SIGINT y al fallar el arranque. Consultas de usuario siempre parametrizadas mediante `execute`; identificadores salen de listas cerradas. `multipleStatements` permanece deshabilitado.

## Migraciones

`backend/db/migrations/001_foundation.sql` contiene únicamente el esquema de entidades, índices y la fila de bloqueo técnico. Sin datos demo. `002_normalize_roles_categories.sql` evoluciona esa base con datos de referencia y backfill verificado. `schema_migrations` registra nombre, SHA-256, estado aplicado y fecha. El runner ordena archivos numéricos, usa una conexión y `GET_LOCK` para excluir otros runners. Repetir el comando no altera datos de migraciones ya aplicadas.

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

`createRepositories(datos)` conserva memory. `repositoriesFromConfig(config)` selecciona el adaptador; `createApplication` permite inyectarlo para pruebas. Los métodos MySQL de escritura abren transacción si se invocan fuera de una; dentro usan la conexión del contexto. `propietario`, IDs/fechas y campos ajenos al modelo no se escriben desde el DTO de entrada. `rol` y `categoria` se resuelven contra catálogos antes de escribir sus FK; los SELECT usan JOIN. `ready()` exige 002 aplicada.

```text
getConnection → configurar sesión → BEGIN
→ SELECT id FROM repository_lock WHERE id=1 FOR UPDATE
→ AsyncLocalStorage.run(connection, callback)
→ COMMIT
error → ROLLBACK
finally → release (destroy si no se puede revertir)
```

El bloqueo global es deliberado: reproduce la exclusión de memory entre todos los procesos que usan este adaptador y preserva comprobaciones `list → validar → escribir` sin reescribir services. Evita carreras del último administrador y pérdida de incrementos de visitas. Se libera por commit/rollback. Es una decisión simple para este marketplace académico; limita el rendimiento de escritura y requiere revisar bloqueos más granulares al crecer. Escritores SQL externos no respetan esa fila: UNIQUE/FK/CHECK siguen protegiendo integridad, pero deben respetar también las reglas de aplicación.

No hay transacciones anidadas: se rechazan explícitamente. El callback debe esperar todo su trabajo asincrónico; no lanzar tareas sueltas que continúen después del commit. No se hacen reintentos automáticos de callbacks con posibles efectos externos. Errores de integridad se convierten a errores seguros 400; otros errores llegan al middleware genérico sin revelar SQL. Memory serializa por proceso, pero **no** tiene rollback de callbacks arbitrarios.

## Pruebas

La suite normal no necesita MySQL. `npm run test:mysql --prefix tests` exige `DATA_SOURCE=mysql` y `DB_NAME` terminada en `_test`, ejecuta secuencialmente la integración existente y la regresión de 001 → 002. Esta última reconstruye únicamente la base dedicada y comprueba todos los atributos históricos, checksums y fallo parcial. Nunca usar datos del usuario. La CI usa MySQL 8.4; validación local realizada también con MySQL 8.0.46. Detalle en [SECURITY_TESTING](SECURITY_TESTING.md).
