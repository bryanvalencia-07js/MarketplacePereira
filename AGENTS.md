# Instrucciones para agentes — Reactiva Pereira

## Alcance y arquitectura

Leer README y los cuatro documentos de `docs/` antes de cambios estructurales. Revisar `git status` y los archivos involucrados. Trabajar en una rama de tarea; para la fundación MySQL usar `feat/mysql-foundation-xp`, nunca `main`.

Conservar HTML/CSS/JavaScript nativo, Express REST y el flujo frontend → API → controllers → services → repositories → DB. La persistencia se elige por `DATA_SOURCE=memory|mysql`; `createRepositories(datos)` sigue creando memory aislado para fixtures. No introducir ORM ni frameworks frontend/CSS. Nunca conectar el navegador directamente a MySQL.

Mantener `list/find/create/update/delete` async y `repos.transaccion(callback)`. SQL y detalles del pool viven en `backend/db/` y `backend/repositories/mysql/`; controllers/services conservan validación, permisos y reglas. No asumir rollback de callbacks arbitrarios en memory; MySQL sí debe tener commit/rollback y liberar conexiones.

## Ciclo XP obligatorio

1. Ejecutar la suite existente y registrar su resultado; si falla, diagnosticar y restaurar el baseline sin esconder regresiones.
2. Hacer un cambio pequeño y verificable. Añadir una prueba primero cuando exprese comportamiento nuevo o una regresión; caracterizar antes de refactorizaciones riesgosas.
3. Ejecutar pruebas relacionadas, refactorizar con comportamiento comprobado y repetirlas.
4. Tras cada bloque importante, ejecutar la suite completa. Mantener CI y cambios revisables pequeños; no hacer una reescritura masiva.

Aplicar Simple Design, Small Releases, Continuous Testing, Refactoring y Collective Code Ownership a todo el código. Conservar nombres coherentes entre capas. No crear archivos o dependencias si una responsabilidad existente se puede ampliar limpiamente. No mantener código muerto comentado: Git conserva el historial.

## UI y limpieza

Conservar identidad, responsive, accesibilidad y experiencia existente; esta fundación no incluye un gran rediseño. Preservar Coverflow 3D, SVG de categorías, filtrado, hover, selección activa, teclado y storytelling.

Una clase ausente del HTML no prueba código muerto. Buscar globalmente en scripts, templates, `innerHTML`, `classList`, `className`, selectores, `data-*`, estados, media queries y tests. Antes de eliminar, explicar la evidencia y ejecutar las regresiones correspondientes. No borrar assets ni funciones exportadas solo por una búsqueda superficial. Verificar consola/CSP y vistas móviles.

## Seguridad

Conservar scrypt, sesiones HttpOnly/SameSite, CSRF, origen, CSP estricta, roles, autorización por propiedad, límites, validaciones y errores seguros. No agregar `unsafe-inline` ni `unsafe-eval`. No guardar autenticación en LocalStorage, secretos en frontend ni credenciales en Git. No crear cuentas demo en arranque. El único bootstrap es el Administrador explícito mediante entorno.

Las consultas SQL usan parámetros; los nombres de tablas/columnas proceden de listas cerradas. Cambios del esquema requieren una migración nueva: no editar una migración aplicada. La suite MySQL solo se ejecuta contra una base dedicada cuyo nombre termine en `_test`; destruye sus entidades. No ejecutar estas pruebas contra datos del usuario.

## Verificación

Usar Node 24. Instalar dependencias con `npm ci --prefix backend` y `npm ci --prefix tests`.

- Suite completa independiente de MySQL: `npm test --prefix tests`.
- Backend y adaptador simulado: `npm test --prefix backend`.
- Navegador: `npm run test:browser --prefix tests`; instalar Chromium o indicar `CHROMIUM_PATH`.
- Integración MySQL separada: `npm run test:mysql --prefix tests`, con entorno de prueba configurado.
- Dependencias: `npm audit --omit=dev --prefix backend`.
- Revisar sintaxis y `git diff --check` antes de entregar.

No afirmar pruebas no ejecutadas. Informar archivos creados/modificados/eliminados, dependencias, evidencia de limpieza, resultado y riesgos. Consolidar información vigente en README, AGENTS y los cuatro documentos de docs; no usar Markdown como diario de cada paso. Git y PR conservan la historia.

## Git

No ejecutar `git reset --hard`, modificar historial, hacer merge ni trabajar directamente sobre main. No hacer commit ni push salvo solicitud explícita del usuario. Explicar eliminaciones antes de realizarlas y dejar el diff revisable. Las instrucciones explícitas del usuario prevalecen sobre este archivo.
