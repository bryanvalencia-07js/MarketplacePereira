# Preparación para MySQL, sin implementación SQL

No se instaló ni conectó MySQL. No hay ORM, migraciones, tablas ni DDL definitivo.

## Qué sustituir

El punto de composición es `createApplication({ repositories })` en `backend/app.js`. El adaptador actual se construye en `backend/repositories/index.js`, usando `memory.repository.js`.

Un futuro `createSqlRepositories(pool)` deberá devolver la misma interfaz validada por `backend/repositories/contract.js`:

```js
{
  usuario: { list, find, create, update, delete },
  negocio: { list, find, create, update, delete },
  producto: { list, find, create, update, delete },
  transaccion: async callback => { /* ... */ }
}
```

Contratos asíncronos:

| Método | Resultado |
|---|---|
| `list()` | Array de DTOs desacoplados |
| `find(id)` | DTO o `null` |
| `create(datos)` | DTO con ID y timestamps generados por persistencia |
| `update(id, datos)` | DTO actualizado o `null`; conserva ID/createdAt |
| `delete(id)` | Booleano |
| `transaccion(callback)` | Resultado de callback o error; serialización/atomicidad real |

El adaptador SQL debe usar consultas parametrizadas, normalizar IDs/números a los tipos del contrato y convertir fechas a ISO. Debe mantener monotonía/no reutilización de IDs y las invariantes de correo único, dueño válido y un comercio por comerciante. La definición física de índices/relaciones se decidirá al aprobar el esquema, no en este documento.

## Transacciones sin cambiar servicios

Los servicios ya invocan `repos.transaccion(callback)`. Un adaptador puede asociar una conexión al contexto asíncrono del callback, por ejemplo mediante `AsyncLocalStorage`; sus métodos usan esa conexión hasta commit/rollback. Así se sustituye la implementación de persistencia y su inyección sin modificar rutas, controllers, servicios, endpoints o frontend.

La exclusión en memoria actual evita carreras en un proceso, pero no sustituye transacciones SQL ni garantiza rollback de callbacks arbitrarios. El futuro adaptador deberá cumplir ese contrato explícitamente.

## Mapeo conceptual, no esquema definitivo

- **Usuario:** identidad, correo normalizado, hash, rol, estado y timestamps.
- **Rol:** hoy es un valor validado; se evaluará su representación al diseñar persistencia.
- **Negocio:** recurso comercial vinculado a Usuario mediante `usuarioId`.
- **Producto:** catálogo vinculado a Negocio mediante `negocioId`, con stock/precio/estado/popularidad.

Los servicios seguirán siendo responsables de permisos, validación y reglas. El almacenamiento se responsabilizará de durabilidad y consistencia transaccional.

## Otros cambios posteriores independientes

Las sesiones también requieren un almacén compartido/durable si se despliegan varias instancias. El carrito es temporal del cliente y no es un modelo de pedido. Las imágenes están aisladas en `imagenes.js`: el siguiente paso puede ser multipart/almacenamiento y URLs; no guardar binarios en MySQL.

Estas ampliaciones no están implementadas ni se presentan como pruebas realizadas.
