# Reactiva Pereira

Proyecto universitario de Ingeniería de Software.

## Objetivo

Reactiva Pereira es un marketplace para dar visibilidad a comercios
de Pereira y su área metropolitana afectados por el terremoto
del 10 de agosto de 2026.

## Stack

Frontend:
- HTML5
- CSS3
- JavaScript
- fetch() posteriormente

Backend:
- Node.js
- Express.js
- API REST

Base de datos:
- MySQL posteriormente
- No usar ORM salvo que se solicite

## Estado actual

El frontend académico funciona actualmente con LocalStorage.

No reemplazar LocalStorage por la API de Express ni por MySQL
sin una instrucción explícita.

El backend existente debe conservarse.

## Roles

Administrador:
- Puede administrar usuarios.
- Puede administrar todos los negocios.

Comerciante:
- Puede registrar y editar únicamente su propio comercio.
- Puede administrar únicamente los productos de su comercio.

Comprador:
- Puede navegar por el marketplace.
- Puede consultar productos y comercios.
- Puede usar su carrito.
- No puede acceder a CRUD administrativos.

## Relaciones actuales

Un comercio pertenece a un usuario Comerciante mediante:

usuarioId

Un producto pertenece a un comercio mediante:

negocioId

El carrito utiliza:

usuarioId
productoId
cantidad

## Reglas de desarrollo

- Revisar el código existente antes de modificarlo.
- No reescribir archivos completos innecesariamente.
- Mantener lo que ya funciona.
- Hacer cambios pequeños e incrementales.
- Explicar qué se modifica y por qué.
- Mantener nombres consistentes entre frontend y backend.
- No crear nuevas dependencias sin necesidad.
- No usar frameworks CSS.
- No introducir React, Vue, Angular u otros frameworks.
- Mantener diseño responsive.
- Mantener la identidad visual actual.
- No cambiar la arquitectura sin aprobación.

## Seguridad

- No guardar secretos en frontend.
- No agregar credenciales reales al repositorio.
- La autenticación actual con LocalStorage es académica y no apta para producción.
- No ejecutar git push automáticamente.
- No ejecutar git reset --hard.
- No eliminar archivos sin explicar primero por qué.
- No modificar .git o historial Git sin autorización explícita.

## Git

Antes de cambios importantes:
- ejecutar git status
- revisar los archivos involucrados

Después de cambios:
- mostrar qué archivos fueron modificados
- no hacer commit ni push salvo solicitud explícita

## Forma de trabajo

Antes de implementar una tarea:

1. Revisar los archivos relacionados.
2. Explicar brevemente qué se va a cambiar.
3. Modificar solamente lo necesario.
4. Verificar que no se haya roto funcionalidad existente.
5. Indicar cómo probar el cambio.
