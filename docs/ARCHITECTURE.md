# Arquitectura actual

## Recorrido completo

```text
Acción del usuario
→ evento DOM (sin handlers inline)
→ módulo frontend
→ api.js / fetch, cookie del mismo origen y CSRF
→ ruta Express
→ controller (HTTP / JSON)
→ service (validación, permisos y reglas)
→ repository async (datos temporales)
→ DTO / JSON { ok, data }
→ estado y render del DOM
```

`backend/app.js` es la raíz de composición. `createApplication({ repositories, ...config })` permite inyectar adaptadores y crear aplicaciones aisladas en pruebas. Solo abre el puerto cuando se ejecuta como programa principal. Sirve `frontend/` y `/api`; evita un despliegue CORS separado y centraliza cabeceras, límites y errores.

## Backend

| Carpeta | Responsabilidad |
|---|---|
| `config` | Puerto, origen, modo y bootstrap opcional de administrador |
| `routes` | Endpoints, autenticación, roles, CSRF y límites de intentos |
| `controllers` | Traducir request/response; no manipulan arreglos |
| `services` | Reglas de usuario, comercio, producto, autenticación y propiedad |
| `repositories` | Contrato async y adaptador temporal en memoria |
| `data` | Estado inicial vacío, sin cuentas predeterminadas |
| `middleware` | Sesión, políticas HTTP, origen, CSRF, rate limits y errores |
| `utils` | Validación, errores de dominio y hashing |

Los servicios acceden a `usuario`, `negocio` y `producto` mediante `list/find/create/update/delete`. Los repositorios devuelven copias, generan IDs monotónicos y preservan `createdAt`; `updatedAt` cambia al actualizar. No exponen la colección interna. `transaccion(callback)` serializa escrituras y comprobaciones de unicidad en este proceso.

El adaptador de memoria no es almacenamiento duradero ni una implementación distribuida. Un error no transforma automáticamente un callback arbitrario en un rollback; los servicios actuales realizan una única escritura de entidad por mutación. La implementación SQL deberá proporcionar transacciones y rollback reales.

## Frontend

- `api.js`: única ubicación de `fetch`, prefijo `/api`, JSON, timeout, credenciales, CSRF y errores HTTP.
- `sesion.js`: identidad obtenida del servidor, destinos por rol y logout. No decide los permisos reales del backend.
- `app-init.js`: enlaza eventos mediante atributos `data-*`, espera la sesión y carga solo el módulo permitido. Sin `eval`, scripts inline ni frameworks.
- `ui.js`: tareas con loading, mensajes accesibles, confirmación con `<dialog>`, KPIs y tarjetas escapadas.
- `estado-local.js`: IDs, precios, texto/imagen segura y reconciliación del carrito temporal con datos actuales de API.
- `imagenes.js`: lectura, preview, redimensionado y compresión local. Aislado del CRUD para reemplazarlo después por upload.
- `legado.js`: respaldo local de la etapa anterior, sin credenciales y sin importación de identidades.
- Módulos por página: landing, marketplace, detalle, carrito, comercio, productos, usuarios, negocios y dashboard.

Las páginas públicas no requieren sesión. Las páginas administrativas y de comerciante esperan la identidad del servidor antes de cargar su lógica. Las comprobaciones de rol del cliente solo mejoran la navegación; cada escritura HTTP se autoriza nuevamente en Express.

## Modelo y consistencia

`Usuario.id → Negocio.usuarioId`; `Negocio.id → Producto.negocioId`.

Un comerciante tiene como máximo un comercio. El administrador asigna un comerciante real mediante un selector, no un nombre suelto. El nombre del propietario se proyecta desde su cuenta vigente. No se elimina un usuario con comercio ni un negocio con productos; la API responde 400 y explica la acción previa necesaria. No se crean huérfanos mediante los endpoints.

Un producto público exige producto activo y comercio existente activo. Los agotados pueden verse, pero no comprarse ni generar visita. La gestión privada permite consultar inactivos al propietario/administrador. Popularidad aumenta por carga válida del detalle, no por renderizar tarjetas; no representa visitantes únicos ni ventas.

## Sesiones y carrito

Sesiones absolutas de ocho horas en memoria; cookie opaca HttpOnly. El token se indexa por su hash en servidor y la identidad se vuelve a leer para cada request. Cambiar contraseña/rol/estado o eliminar una cuenta revoca sus sesiones.

El carrito conserva referencias `{ usuarioId, productoId, cantidad }`. Su clave incluye un identificador aleatorio de instancia del backend: un reinicio no vuelve a asociar IDs nuevos con carritos antiguos. Antes de operar se verifica la sesión y se consulta el catálogo público. Solo se ajustan entradas del comprador actual; otros compradores se preservan.

Se eliminan referencias no disponibles y cantidades inválidas, se combinan duplicados y se limita al stock. Los importes se suman en centavos y se formatean como COP con decimales cuando corresponda. Un fallo de red no se interpreta como catálogo vacío ni borra el carrito. No hay reserva de stock, checkout ni pedidos.

## Evolución

La sustitución de repositorios por SQL está descrita en [MYSQL_READY](MYSQL_READY.md). No se instaló MySQL ni se definió DDL. La persistencia temporal, sesiones de un único proceso y el respaldo legado son límites actuales explícitos; ver también [SECURITY](SECURITY.md).
