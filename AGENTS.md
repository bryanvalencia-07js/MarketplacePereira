# Instrucciones para agentes — Reactiva Pereira

## Alcance y arquitectura

Leer README y los cuatro documentos de `docs/` antes de cambios estructurales. Revisar `git status` y los archivos involucrados. Trabajar en una rama de tarea; para PR7 usar exclusivamente `feat/orders-and-domain-completion`, nunca `main`.

Conservar HTML/CSS/JavaScript nativo, Express REST y el flujo frontend → API → controllers → services → repositories → DB. La persistencia se elige por `DATA_SOURCE=memory|mysql`; `createRepositories(datos)` sigue creando memory aislado para fixtures. No introducir ORM ni frameworks frontend/CSS. Nunca conectar el navegador directamente a MySQL.

Mantener `list/find/create/update/delete` async y `repos.transaccion(callback)`. SQL y detalles del pool viven en `backend/db/` y `backend/repositories/mysql/`; controllers/services conservan validación, permisos y reglas. Memory mantiene copias privadas con commit/rollback; las escrituras fuera de contexto también deben encolarse. MySQL debe conservar commit/rollback y liberar conexiones.

## Ciclo XP obligatorio

1. Ejecutar la suite existente y registrar su resultado; si falla, diagnosticar y restaurar el baseline sin esconder regresiones.
2. Hacer un cambio pequeño y verificable. Añadir una prueba primero cuando exprese comportamiento nuevo o una regresión; caracterizar antes de refactorizaciones riesgosas.
3. Ejecutar pruebas relacionadas, refactorizar con comportamiento comprobado y repetirlas.
4. Tras cada bloque importante, ejecutar la suite completa. Mantener CI y cambios revisables pequeños; no hacer una reescritura masiva.

Aplicar Simple Design, Small Releases, Continuous Testing, Refactoring y Collective Code Ownership a todo el código. Conservar nombres coherentes entre capas. No crear archivos o dependencias si una responsabilidad existente se puede ampliar limpiamente. No mantener código muerto comentado: Git conserva el historial.

## UI y limpieza

Conservar identidad, responsive y accesibilidad. La fase UI moderniza navegación, formularios, estados y catálogo sin cambiar API, roles ni persistencia. CSS fuente en seis módulos; `estilos.css` es generado: editar módulos y ejecutar `npm run assets`. No editar directamente vendor ni fuentes: regenerarlos desde dependencias fijadas de raíz. Preservar Coverflow 3D, SVG de categorías, filtrado, hover, selección activa, teclado y storytelling.

Una clase ausente del HTML no prueba código muerto. Buscar globalmente en scripts, templates, `innerHTML`, `classList`, `className`, selectores, `data-*`, estados, media queries y tests. Antes de eliminar, explicar la evidencia y ejecutar las regresiones correspondientes. No borrar assets ni funciones exportadas solo por una búsqueda superficial. Verificar consola/CSP y vistas móviles.

## Seguridad

Conservar scrypt, sesiones HttpOnly/SameSite, CSRF, origen, CSP estricta, roles, autorización por propiedad, límites, validaciones y errores seguros. No agregar `unsafe-inline` ni `unsafe-eval`. No guardar autenticación en LocalStorage, secretos en frontend ni credenciales en Git. No crear cuentas demo en arranque. El único bootstrap es el Administrador explícito mediante entorno.

Las consultas SQL usan parámetros; los nombres de tablas/columnas proceden de listas cerradas. Cambios del esquema requieren una migración nueva: no editar una migración aplicada. `001_foundation.sql`, `002_normalize_roles_categories.sql` y `003_services_reservations_favorites.sql` son inmutables; PR7 añade únicamente `004_orders_and_details.sql`. Resolver roles/categorías mediante sus relaciones, sin IDs mágicos ni usuarioRol duplicado. Mantener visitas como contador y popularidad solo como alias de respuesta. La suite MySQL solo se ejecuta contra una base dedicada cuyo nombre termine en `_test`; destruye sus entidades. No ejecutar estas pruebas contra datos del usuario.

## Reglas de agenda (PR6)

Servicio pertenece a Negocio y Categoria; crear/reasignar exige categoría Activa. Capacidad 1..100, duración 1..1440, precio de referencia >=0. Público exige servicio/negocio/categoría Activos. No crear tablas Disponibilidad, Inventario, Pago ni Factura. PR7 completa únicamente Pedido y Detalle_Pedido; no añadir más módulos o entidades.

Mantener validación de horarios y creación de reservas dentro de `repos.transaccion`: el bloqueo MySQL se obtiene antes de las lecturas y se conserva hasta commit/rollback. No separar comprobación de cupo e INSERT. Reutilizar el cálculo de slots/pico en `utils/agenda.js`, America/Bogota explícita y UTC en persistencia/HTTP. No almacenar fin de reserva. Mantener reservas al editar horarios/desactivar servicios; no borrar servicio/usuario con reservas. Favorito usa sesión, UNIQUE usuario/producto y CASCADE dependiente. Solo Comprador crea reservas/favoritos; Comerciante gestiona sus servicios y reservas; Admin gestiona globalmente. Conservar las pruebas reales entre dos pools, capacidad 1 y 3, y TZ diferente de Bogotá.

## Verificación

Usar Node 24. Instalar dependencias con `npm ci`, `npm ci --prefix backend` y `npm ci --prefix tests`. `npm run assets` regenera CSS, fuentes, Lucide y GSAP locales; comprobar que no haya drift en el resultado versionado.

- Suite completa independiente de MySQL: `npm test --prefix tests`.
- Backend y adaptador simulado: `npm test --prefix backend`.
- Navegador: `npm run test:browser --prefix tests`; instalar Chromium o indicar `CHROMIUM_PATH`. Incluye axe A/AA en veinte páginas a 360/1440 y una revisión adicional del carrito PR7; `UI_SCREENSHOTS=../test-artifacts` guarda 84 capturas (72 anteriores + 12 PR7). Revisar también los estados de menú, loading, error y teclado.
- Integración MySQL separada: `npm run test:mysql --prefix tests`, con entorno de prueba configurado.
- Dependencias: `npm audit --omit=dev --prefix backend`.
- Revisar sintaxis y `git diff --check` antes de entregar.

No afirmar pruebas no ejecutadas. Informar archivos creados/modificados/eliminados, dependencias, evidencia de limpieza, resultado y riesgos. Consolidar información vigente en README, AGENTS y los cuatro documentos de docs; no usar Markdown como diario de cada paso. Git y PR conservan la historia.

## Git

No ejecutar `git reset --hard`, modificar historial, hacer merge ni trabajar directamente sobre main. No hacer commit ni push salvo solicitud explícita del usuario. Explicar eliminaciones antes de realizarlas y dejar el diff revisable. Las instrucciones explícitas del usuario prevalecen sobre este archivo.

## Reglas de pedidos (PR7)

Conservar las once entidades exactas del DER. No persistir Carrito, total/subtotal ni nombre histórico adicional. createdAt representa fecha_pedido; precioUnitario del detalle se copia del Producto dentro de la transacción, nunca del cliente. Cada pedido corresponde a un negocio; un único POST multinegocio se confirma o revierte entero. Consolidar cantidades y bloquear Producto en ID ascendente, después del bloqueo global existente y antes de leer precio/stock; misma conexión hasta commit/rollback. Mantener pruebas HTTP reales con dos pools MySQL (stock 1 y 3), rollback después de escrituras y cancelación concurrente.

Solo Comprador crea Pendiente desde sesión. Comerciante propietario/Admin confirman, completan o cancelan respetando transiciones; Comprador solo cancela Pendiente propio. Terminales no se reabren; cancelar restaura stock exactamente una vez. No añadir DELETE de Pedido, ni borrar Producto/Negocio/Usuario referenciados: ofrecer Inactivo. No trasladar un producto con detalles a otro negocio. Límites: 100 líneas, 1000 unidades consolidadas por producto, observaciones 2000, total en centavos entero seguro. Conservar límite previo de stock 1e6 y error 409 si restock lo superaría.

Carrito limpia únicamente después de 201 y preserva cantidades/notas en error. No hay historial en LocalStorage ni reintentos de POST automáticos; ante respuesta perdida consultar Mis pedidos. Reutilizar `pedido-vista.js`, tokens y navegación existentes. No modificar fotografías/storytelling ni generar CSS global ajeno a las nuevas vistas. No hacer merge automático ni iniciar otro módulo.
