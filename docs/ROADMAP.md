# Reactiva Pereira — Roadmap de Ejecución Final

## Estado inicial

FASE 1 COMPLETADA Y VALIDADA.

Ya se corrigieron:

- CRUD de productos.
- descripción, preview e imágenes.
- visibilidad de productos/negocios activos.
- carrito por comprador.
- stock y cantidades.
- contador y totales.
- datos del vendedor.
- detalle de producto.
- redirecciones por rol.
- responsive básico.

Existen 19 pruebas Chromium aprobadas.

NO repetir Fase 1.

---

# OBJETIVO

Evolucionar Reactiva Pereira hacia una aplicación fullstack profesional:

```text
Frontend
HTML + CSS + JS
      ↓
    fetch()
      ↓
API REST Express
      ↓
Routes
      ↓
Controllers
      ↓
Services
      ↓
Repositories
      ↓
Persistencia temporal
```

Preparada para posteriormente sustituir:

```text
Repository temporal
↓
Repository MySQL
↓
MySQL
```

NO implementar MySQL todavía.
NO usar ORM.

---

# REGLAS

Ejecutar TODAS las fases restantes consecutivamente.

NO detenerse entre fases para pedir autorización.

Solo detenerse si existe un bloqueo técnico que impida continuar.

- Revisar antes de modificar.
- Conservar funcionalidades correctas.
- No reescribir innecesariamente.
- HTML/CSS/JS nativo.
- Node.js + Express.
- No frameworks frontend.
- No frameworks CSS.
- No commit.
- No push.
- No `git reset --hard`.
- No modificar historial Git.
- No introducir secretos al repositorio.
- Mantener código entendible para sustentación universitaria.
- Ejecutar pruebas después de cambios importantes.
- Corregir regresiones antes de continuar.
- Documentar TODO al finalizar, no durante cada fase salvo notas internas necesarias.

---

# FASE 2 — UI/UX + identidad Reactiva Pereira

Realizar un rediseño visual notable.

Identidad inspirada en Pereira:

- amarillo como color de energía/reactivación.
- rojo como color de identidad/acento.
- crema/blanco para superficies.
- carbón para texto.
- verde solo para éxito/estado positivo.

No saturar la interfaz de amarillo y rojo.

Centralizar variables CSS.

Unificar:

- botones.
- inputs.
- cards.
- badges.
- tablas.
- navbar.
- modales.
- loaders.
- empty states.
- mensajes.
- focus.
- hover.
- disabled.
- sombras.
- spacing.
- responsive.

Mantener:

Serif → identidad/títulos.
Sans Serif → interfaz.

Garantizar:

- contraste.
- teclado.
- focus visible.
- responsive 360 / 768 / 1024 / 1440.
- sin overflow horizontal.

---

# FASE 3 — Landing + Scrollytelling

Transformar `index.html` en experiencia narrativa.

Usar JavaScript nativo + IntersectionObserver.

No usar librerías de animación salvo necesidad real.

Narrativa:

```text
Problema
↓
Comercios afectados
↓
Reactiva Pereira
↓
Comerciante publica
↓
Comprador descubre
↓
Compra local
↓
Reactivación
```

Crear:

## Hero
CTA:
- Explorar marketplace.
- Registrar comercio.

## Contexto
Explicar propósito del proyecto.

## Cómo funciona
Flujo visual comerciante → producto → comprador.

## Comercios
Datos reales.

## Productos destacados
Datos reales.

## Impacto
KPIs dinámicos.

## CTA final
“Comprar local también es reconstruir Pereira.”

Animaciones:

- reveal.
- contador animado.
- cambios visuales progresivos.
- sticky sections solo si mejoran narrativa.

Respetar `prefers-reduced-motion`.

---

# FASE 4 — Experiencia Comprador

Rediseñar marketplace para que parezca producto real.

Navbar:

- identidad.
- búsqueda.
- categorías.
- comercios.
- populares.
- carrito con contador.
- usuario.
- logout.

Marketplace:

- destacados.
- recientes.
- populares.
- categorías.
- comercios destacados.
- búsqueda.
- filtros.
- contador resultados.
- limpiar filtros.
- loading.
- empty state.
- errores.

Las tarjetas deben comunicar claramente:

```text
imagen
producto
comercio
categoría
precio
stock
CTA
```

Mantener regla:

```text
Producto activo
+
Negocio existente
+
Negocio activo
=
Visible
```

Mejorar también:

- detalle de producto.
- selector cantidad.
- feedback al agregar.
- carrito.
- mensajes de stock.
- botones.
- navegación.

Evitar `alert()` para UX normal.

Crear toast/modal/mensaje inline reutilizable.

---

# FASE 5 — Portal Comerciante

Transformar `mi-negocio.html` en dashboard comercial.

Mostrar KPIs:

- productos totales.
- activos.
- inactivos.
- agotados.
- stock bajo.
- popularidad/visitas acumuladas si existen datos.

Mostrar información del comercio:

- estado.
- categoría.
- contacto.
- dirección.

Acciones rápidas:

- editar comercio.
- administrar productos.
- agregar producto.
- ver marketplace.
- previsualizar comercio como comprador.

Mejorar `mis-productos`:

- CRUD.
- búsqueda.
- filtros.
- stock.
- badges.
- imágenes.
- estados.
- confirmaciones.
- feedback visual.

Garantizar propiedad:

```text
Usuario.id
→ Negocio.usuarioId
→ Producto.negocioId
```

Un comerciante jamás debe administrar recursos de otro.

---

# FASE 6 — Dashboard Administrador

Convertir dashboard actual en panel robusto.

Mostrar KPIs:

- usuarios.
- administradores.
- comerciantes.
- compradores.
- usuarios inactivos.
- comercios.
- comercios activos/inactivos.
- productos.
- productos activos.
- productos agotados.
- productos con stock bajo.

Crear áreas:

## Resumen
KPIs y estado general.

## Gestión
Accesos a:

- usuarios.
- negocios.
- productos.

## Alertas

- usuarios inactivos.
- negocios inactivos.
- productos agotados.
- stock bajo.

## Actividad

Preparar soporte para:

```text
createdAt
updatedAt
```

si el modelo aún no dispone de ellos.

Usar gráficos ligeros con CSS/SVG si aportan valor.

No agregar librería de charts innecesariamente.

Administrador debe poder supervisar el ecosistema completo.

---

# FASE 7 — Refactor Backend

Evolucionar backend hacia:

```text
backend/
├── app.js
├── routes/
├── controllers/
├── services/
├── repositories/
├── data/
├── middleware/
├── utils/
└── config/
```

Responsabilidades:

```text
Route
→ endpoint

Controller
→ request/response

Service
→ reglas de negocio

Repository
→ persistencia

Middleware
→ validación/autorización/errores
```

La persistencia sigue temporal.

Preparar para reemplazar repository posteriormente por MySQL.

No crear tablas todavía.

---

# FASE 8 — API REST completa

Implementar/normalizar:

## Auth

```text
POST /api/auth/registro
POST /api/auth/login
GET  /api/auth/me
```

Migrar autenticación al servidor.

No guardar passwords en texto plano.

Usar hashing seguro.

No devolver password en responses.

No almacenar password en LocalStorage.

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

## Productos

```text
GET    /api/productos
GET    /api/productos/:id
POST   /api/productos
PUT    /api/productos/:id
DELETE /api/productos/:id
```

Filtros soportados cuando corresponda:

```text
?buscar=
?categoria=
?negocioId=
?estado=
```

Usar status:

```text
200
201
400
401
403
404
500
```

Respuesta consistente:

```json
{
  "ok": true,
  "data": {}
}
```

Errores:

```json
{
  "ok": false,
  "mensaje": "..."
}
```

Crear middleware global de errores.

---

# FASE 9 — Autorización real

Frontend controla visibilidad por UX.

Backend controla permisos reales.

Administrador:
- usuarios.
- negocios.
- productos.

Comerciante:
- su negocio.
- productos de su negocio.

Comprador:
- consulta marketplace.
- detalle.
- carrito.

Operación no autorizada:

```text
403 Forbidden
```

No confiar en IDs enviados por frontend para determinar propiedad.

---

# FASE 10 — Frontend conectado al Backend

Crear capa central:

```text
frontend/js/api.js
```

Centralizar:

```js
API_URL
fetch
JSON
errores
headers
sesión
```

NO repetir URLs API en cada módulo.

Migrar progresivamente:

```text
usuarios
negocios
productos
auth
```

de:

```text
LocalStorage
```

a:

```text
fetch()
→ Express
```

El flujo final debe ser:

```text
Usuario
↓
DOM
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
Response JSON
↓
DOM
```

LocalStorage solo puede conservar información de cliente apropiada, nunca contraseñas.

---

# FASE 11 — Preparación para MySQL

NO instalar ni conectar MySQL todavía.

Verificar que repositories permitan posteriormente cambiar:

```js
usuarioRepository
negocioRepository
productoRepository
```

desde persistencia temporal hacia SQL sin modificar:

- routes.
- controllers.
- services.
- frontend.
- endpoints.

Documentar mapeo conceptual futuro:

```text
Usuario
Rol
Negocio
Producto
```

NO definir todavía esquema SQL definitivo ni relaciones finales sin aprobación.

---

# FASE 12 — Calidad y depuración final

Realizar auditoría completa.

Comprobar:

- consola frontend sin errores.
- backend sin errores.
- Network correcto.
- rutas.
- roles.
- CRUD.
- formularios.
- búsqueda.
- filtros.
- carrito.
- stock.
- imágenes.
- sesión.
- responsive.
- navegación.
- enlaces.
- estados vacíos.
- loaders.
- errores HTTP.
- recursos inexistentes.
- propiedad de recursos.

Eliminar:

- código muerto.
- logs innecesarios.
- duplicación evidente.
- enlaces rotos.
- funciones abandonadas.

No realizar refactors cosméticos riesgosos al final.

Ejecutar:

```text
pruebas existentes
pruebas nuevas necesarias
syntax checks
git diff --check
```

Corregir cualquier regresión.

---

# FASE 13 — Documentación final

SOLO después de terminar implementación y pruebas.

Crear/actualizar:

```text
README.md

docs/
├── ARCHITECTURE.md
├── API.md
├── ROLES.md
├── TESTING.md
├── UX_UI.md
├── MYSQL_READY.md
└── CHANGELOG.md
```

## README

Debe explicar:

- proyecto.
- propósito.
- stack.
- instalación.
- ejecución frontend/backend.
- arquitectura.
- roles.
- estructura.
- estado actual.

## ARCHITECTURE

Documentar:

```text
Frontend
→ API
→ Route
→ Controller
→ Service
→ Repository
```

Explicar cómo migrará a MySQL.

## API

Documentar endpoints:

```text
método
ruta
body
response
status codes
permisos
```

## ROLES

Administrador / Comerciante / Comprador.

## TESTING

Pruebas ejecutadas y cómo repetirlas.

## UX_UI

Design System, responsive y scrollytelling.

## MYSQL_READY

Explicar exactamente qué deberá sustituirse para incorporar MySQL.

No diseñar tablas definitivas.

## CHANGELOG

Resumir cambios desde Fase 1 hasta estado final.

---

# INFORME FINAL

No generar reportes extensos entre fases.

Al terminar TODO entregar únicamente un resumen compacto con:

## Resultado

- fases completadas.
- principales mejoras.
- arquitectura final.

## Archivos

- creados.
- modificados.
- eliminados si aplica.

## Pruebas

- cantidad.
- resultado.
- fallos corregidos.

## Pendientes

Solo pendientes reales.

## Git

Ejecutar y mostrar:

```bash
git diff --stat
git status --short
```

NO COMMIT.
NO PUSH.

---

# CRITERIO FINAL

Reactiva Pereira debe sentirse como UNA aplicación coherente, no como varios CRUD independientes.

Cada rol debe recibir una experiencia clara:

```text
Administrador
→ supervisa y administra

Comerciante
→ gestiona su presencia comercial

Comprador
→ descubre, consulta y compra local
```

La aplicación debe comunicar visual y funcionalmente:

```text
Pereira
+
comercio local
+
reactivación
+
confianza
+
tecnología
```

Ejecuta FASE 2 → FASE 13 de forma consecutiva.

No solicites confirmación entre fases.

Documenta únicamente al finalizar.

Si encuentras un bloqueo no crítico, registra el pendiente y continúa.

Solo detente ante un bloqueo que haga técnicamente imposible continuar.