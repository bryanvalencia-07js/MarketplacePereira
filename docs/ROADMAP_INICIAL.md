# Reactiva Pereira — Roadmap de evolución técnica

## Objetivo

Evolucionar Reactiva Pereira desde un prototipo académico basado principalmente en LocalStorage hacia una aplicación fullstack profesional, coherente, responsive y preparada para conectar MySQL posteriormente.

La implementación debe conservar lo que funciona, corregir deuda técnica y producir cambios visibles y funcionales.

Arquitectura objetivo:

Frontend
→ fetch()
→ API REST
→ Node.js + Express
→ Repository/Data temporal
→ MySQL posteriormente

NO crear todavía tablas definitivas MySQL.
NO usar ORM.

---

# 1. Principios obligatorios

- Revisar el código actual antes de modificarlo.
- No reescribir el proyecto completo sin necesidad.
- Mantener HTML, CSS y JavaScript nativo.
- No introducir React, Vue, Angular ni frameworks CSS.
- No romper los roles existentes.
- No hacer commit ni push automáticamente.
- No usar `git reset --hard`.
- No eliminar archivos sin justificarlo.
- No dejar funcionalidades importantes únicamente simuladas.
- Los datos principales deben migrar progresivamente de LocalStorage a la API.
- LocalStorage puede conservar únicamente estado de interfaz o datos temporales cuando tenga sentido.
- No guardar contraseñas en texto plano una vez que autenticación pase al backend.
- No guardar contraseñas en LocalStorage.
- Toda acción importante debe tener estados de éxito, error, carga y recurso no encontrado.
- Mantener código entendible para sustentación universitaria.

---

# 2. Prioridad inmediata: estabilización

Antes de nuevas funcionalidades, corregir bugs actuales detectados.

## Productos

Corregir inconsistencias entre:

`mis-productos.html`
`mis-productos.js`

Especialmente:

- IDs HTML/JS inconsistentes.
- descripción del producto.
- preview de imagen.
- creación.
- edición.
- conservar imagen anterior.
- reemplazar imagen.
- eliminar.
- activar/inactivar.
- manejo de errores de LocalStorage.

## Marketplace

Un producto solo es visible si:

```js
producto.estado === "Activo"
```

Y su comercio:

```js
negocio &&
negocio.estado === "Activo"
```

Aplicar la misma regla a:

- catálogo.
- búsqueda.
- categorías.
- populares.
- detalle.
- carrito.

No mostrar productos huérfanos.

## Carrito

Corregir:

- referencias a productos eliminados.
- productos inactivos.
- negocios inactivos.
- stock modificado.
- stock cero.
- contador global.
- carrito vacío.
- totales.
- carrito separado por comprador.

---

# 3. Rediseño visual

Crear un sistema visual coherente para Reactiva Pereira.

## Identidad

Inspiración cromática principal:

- Amarillo Pereira.
- Rojo Pereira.
- Blanco.
- Tonos crema.
- Gris carbón para texto.
- Verde únicamente como color auxiliar cuando represente estados positivos.

No convertir la interfaz en rojo/amarillo saturado.

Usar los colores institucionales como acentos, gradientes, indicadores y elementos narrativos.

Crear variables CSS centralizadas:

```css
:root {
    --amarillo-rp: ...;
    --rojo-rp: ...;
    --rojo-oscuro: ...;
    --crema: ...;
    --superficie: ...;
    --texto: ...;
    --texto-secundario: ...;
    --exito: ...;
    --peligro: ...;
}
```

Mantener:

- Serif para identidad/títulos.
- Sans Serif para interfaz funcional.

Objetivos:

- limpio.
- profesional.
- cercano.
- moderno.
- accesible.
- responsive.
- buena jerarquía visual.
- microinteracciones sutiles.

---

# 4. Landing page con scrollytelling

Rediseñar `index.html`.

Debe dejar de sentirse como landing genérica.

Crear narrativa mediante scroll usando JavaScript nativo e `IntersectionObserver`.

NO instalar librerías de animación salvo necesidad crítica.

Narrativa sugerida:

## Escena 1 — Hero

Mensaje principal sobre reactivación de Pereira.

CTA:

- Explorar marketplace.
- Registrar mi comercio.

Visual fuerte amarillo/rojo con composición moderna.

## Escena 2 — Problema

Explicar de forma visual la necesidad de apoyar comercios afectados.

Animaciones suaves al entrar en viewport.

## Escena 3 — Cómo Reactiva Pereira conecta

Representar flujo:

Comerciante
→ publica
→ marketplace
→ comprador
→ compra local
→ reactivación

## Escena 4 — Comercios

Mostrar negocios reales existentes en la plataforma.

## Escena 5 — Productos destacados

Consumir productos reales desde API.

## Escena 6 — Impacto

Indicadores dinámicos:

- comercios registrados.
- productos publicados.
- usuarios.
- categorías.

## Escena final

CTA fuerte:

“Comprar local también es reconstruir Pereira.”

Evitar animaciones excesivas.

Respetar `prefers-reduced-motion`.

---

# 5. Marketplace del comprador

Mejorar significativamente `marketplace.html`.

Debe sentirse como marketplace real.

Navbar:

- logo.
- buscador principal.
- categorías.
- productos.
- populares.
- comercios.
- carrito con contador.
- perfil/cerrar sesión.

Añadir:

- hero compacto.
- categorías visuales.
- sección populares.
- productos recientes.
- comercios destacados.
- tarjetas con imagen real.
- precio.
- stock.
- comercio.
- estado.
- CTA claro.

## Búsqueda

Buscar por:

- nombre producto.
- descripción.
- categoría.
- comercio.

Mostrar:

- número de resultados.
- estado vacío.
- opción para limpiar búsqueda.

## UX

Añadir:

- feedback visual.
- estados vacíos.
- loaders.
- errores comprensibles.
- botones deshabilitados cuando corresponda.
- toasts o mensajes inline en vez de `alert()` siempre que sea posible.

---

# 6. Detalle de producto

Mejorar:

`detalle-producto.html`

Mostrar:

- imagen.
- nombre.
- categoría.
- precio.
- descripción.
- stock.
- estado.
- comercio vendedor.
- dirección.
- teléfono.
- cantidad.
- agregar al carrito.

Si stock = 0:

- mostrar Agotado.
- desactivar selector.
- desactivar agregar al carrito.

Incrementar popularidad únicamente para productos disponibles.

---

# 7. Portal Comerciante

`mi-negocio.html` debe convertirse en un pequeño panel.

Mostrar:

- nombre del comercio.
- estado.
- categoría.
- perfil/completitud.
- cantidad de productos.
- productos activos.
- productos agotados.
- productos con stock bajo.
- accesos rápidos.

Acciones:

- editar comercio.
- administrar productos.
- previsualizar cómo lo ve un comprador.

El comerciante solo puede trabajar sobre recursos propios.

Relación:

```text
Usuario.id
→ Negocio.usuarioId
→ Producto.negocioId
```

---

# 8. Productos del comerciante

Mejorar `mis-productos.html`.

CRUD completo:

- crear.
- listar.
- buscar.
- filtrar.
- editar.
- activar/inactivar.
- eliminar.

Producto:

```text
id
negocioId
nombre
descripcion
categoria
precio
stock
imagen
estado
popularidad
```

UX:

- preview de imagen.
- validación.
- mensajes inline.
- stock bajo.
- badge activo/inactivo.
- confirmación de eliminación.
- tarjetas o tabla responsive.

---

# 9. Panel Administrador

El dashboard actual debe evolucionar significativamente.

Debe ser útil, no solo dos tarjetas.

## Resumen

Mostrar KPIs:

- total usuarios.
- administradores.
- comerciantes.
- compradores.
- negocios.
- negocios activos.
- productos.
- productos activos.
- productos agotados.

## Gestión

Accesos a:

- Usuarios.
- Negocios.
- Productos.

## Actividad

Mostrar información reciente:

- usuarios registrados.
- negocios creados.
- productos recientes.

Si no existe fecha actualmente, preparar el modelo para `createdAt`.

## Alertas

Mostrar:

- negocios inactivos.
- productos agotados.
- productos con stock bajo.
- usuarios inactivos.

No instalar una librería de charts inicialmente.

Usar CSS/SVG/simple progress visuals si aporta valor.

---

# 10. API REST

El frontend debe comenzar a consumir la API mediante `fetch()`.

Eliminar progresivamente dependencia de LocalStorage para entidades principales.

Mantener temporalmente persistencia en memoria del backend hasta MySQL.

Crear/organizar API:

## Auth

```text
POST /api/auth/registro
POST /api/auth/login
GET  /api/auth/me
```

No guardar password plano.

Usar hashing adecuado.

No guardar password en LocalStorage.

## Usuarios

```text
GET    /api/usuarios
GET    /api/usuarios/:id
POST   /api/usuarios
PUT    /api/usuarios/:id
DELETE /api/usuarios/:id
```

## Negocios

```text
GET    /api/negocios
GET    /api/negocios/:id
POST   /api/negocios
PUT    /api/negocios/:id
DELETE /api/negocios/:id
```

Permitir filtros cuando sea útil:

```text
GET /api/negocios?usuarioId=3
```

## Productos

```text
GET    /api/productos
GET    /api/productos/:id
POST   /api/productos
PUT    /api/productos/:id
DELETE /api/productos/:id
```

Filtros:

```text
/api/productos?negocioId=3
/api/productos?categoria=Tecnologia
/api/productos?buscar=play
```

---

# 11. Arquitectura backend preparada para MySQL

Evitar lógica directamente acoplada al arreglo temporal.

Estructura recomendada:

```text
backend/
├── app.js
├── routes/
├── controllers/
├── services/
├── repositories/
├── data/
├── middleware/
└── utils/
```

Flujo:

```text
Route
→ Controller
→ Service
→ Repository
→ Data temporal
```

Posteriormente:

```text
Route
→ Controller
→ Service
→ Repository MySQL
→ MySQL
```

Esto permitirá cambiar persistencia sin modificar endpoints ni frontend.

No crear todavía tablas SQL definitivas.

No usar ORM.

---

# 12. Respuestas API

Crear estructura consistente.

Éxito:

```json
{
    "ok": true,
    "data": {}
}
```

Error:

```json
{
    "ok": false,
    "mensaje": "Recurso no encontrado"
}
```

Status HTTP:

- 200 OK
- 201 Created
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 500 Internal Server Error

---

# 13. Manejo de errores

Frontend:

```text
loading
success
empty
error
```

Backend:

- validación.
- try/catch.
- middleware global de errores.
- recurso inexistente.
- datos inválidos.
- errores de persistencia.

No mostrar errores técnicos internos directamente al usuario.

---

# 14. Autorización

Frontend puede ocultar opciones por UX.

Pero backend debe aplicar reglas.

## Administrador

Puede administrar:

- usuarios.
- negocios.
- productos.

## Comerciante

Puede:

- administrar su negocio.
- administrar productos de su negocio.

No puede modificar recursos de otros comerciantes.

## Comprador

Puede:

- consultar marketplace.
- consultar producto.
- usar carrito.

No puede ejecutar CRUD administrativo.

El backend debe responder `403` ante operaciones no autorizadas.

---

# 15. Carrito

Mantener inicialmente carrito del comprador separado por usuario.

Modelo conceptual:

```json
{
    "usuarioId": 4,
    "productoId": 8,
    "cantidad": 2
}
```

Debe:

- validar producto activo.
- validar negocio activo.
- validar stock.
- recalcular totales.
- limpiar referencias inválidas.

No implementar todavía pagos reales.

---

# 16. Imágenes

Actualmente Base64 puede seguir funcionando temporalmente.

Aislar esta responsabilidad para que después pueda reemplazarse por:

```text
Frontend
→ multipart/FormData
→ Express
→ almacenamiento
→ URL
→ Producto.imagenUrl
```

No almacenar archivos binarios directamente en MySQL.

---

# 17. Código frontend

Reducir duplicación.

Crear utilidades reutilizables solo donde aporte claridad:

```text
api.js
session.js
ui.js
formatters.js
```

Ejemplo `api.js`:

```js
const API_URL = "http://localhost:3000/api";
```

Centralizar `fetch()` allí.

No repetir URL de servidor en muchos archivos.

---

# 18. UX

Eliminar `alert()` cuando sea razonable.

Preferir:

- mensajes inline.
- toast.
- modal de confirmación.
- estados visuales.

Botones deben tener:

- hover.
- focus.
- disabled.
- loading.

Todos los formularios:

- labels.
- mensajes de validación.
- feedback de éxito/error.
- navegación por teclado.

---

# 19. Responsive

Verificar como mínimo:

```text
360px
768px
1024px
1440px
```

No debe existir overflow horizontal accidental.

Navbar debe adaptarse a móvil.

Tablas deben poder transformarse o desplazarse correctamente.

---

# 20. Documentación

Crear:

```text
docs/
├── ARCHITECTURE.md
├── API.md
├── ROLES.md
└── TESTING.md
```

Actualizar README.

Documentar:

- arquitectura actual.
- flujo frontend/backend.
- endpoints.
- roles.
- estructura.
- instrucciones para ejecutar.
- limitaciones académicas.
- transición futura a MySQL.

Evitar documentación redundante.

---

# 21. Implementación por fases

No realizar todo como un único cambio gigante.

## Fase 1

- corregir bugs actuales.
- estabilizar productos.
- estabilizar marketplace.
- estabilizar carrito.
- autorización/redirecciones.

## Fase 2

- diseño system.
- landing/scrollytelling.
- marketplace UX.
- detalle UX.
- portal comerciante.
- dashboard administrador.

## Fase 3

- refactor backend.
- repositories.
- services.
- endpoints negocios/productos/auth.
- manejo global errores.

## Fase 4

- crear `api.js`.
- conectar frontend vía fetch.
- reemplazar progresivamente LocalStorage.

## Fase 5

- pruebas.
- responsive.
- accesibilidad.
- limpieza.
- documentación.

Después de cada fase:

1. Ejecutar pruebas.
2. Revisar consola.
3. Revisar Network.
4. Mostrar archivos modificados.
5. Mostrar `git diff --stat`.
6. Mostrar `git status`.
7. NO commit.
8. NO push.
9. Esperar revisión antes de continuar a la siguiente fase.

---

# 22. Criterios de aceptación

El proyecto debe demostrar:

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
Route
↓
Controller
↓
Service
↓
Repository
↓
datos temporales
↓
HTTP Response
↓
JSON
↓
Frontend
↓
DOM
```

El usuario debe percibir una aplicación coherente y no varios CRUD independientes.

Administrador, Comerciante y Comprador deben tener experiencias claramente diferentes.

La interfaz debe comunicar:

- confianza.
- compra local.
- reactivación.
- pertenencia a Pereira.

El sistema debe quedar preparado para que posteriormente:

```text
Repository temporal
```

sea reemplazado por:

```text
Repository MySQL
```

sin cambiar la API pública.

---

# 23. Primera ejecución

Empieza únicamente por FASE 1.

Antes de editar:

- inspecciona los archivos actuales.
- confirma qué problemas siguen existiendo.
- crea un plan corto.

Después implementa FASE 1 completa.

No continúes automáticamente a FASE 2.

Al terminar entrega:

- resumen de cambios.
- archivos modificados.
- bugs corregidos.
- pruebas realizadas.
- problemas pendientes.
- `git diff --stat`.
- `git status`.

No hagas commit ni push.