# Roles y permisos

| Operación | Visitante | Comprador | Comerciante | Administrador |
|---|---|---|---|---|
| Landing, catálogo y comercios públicos | Sí | Sí | Sí | Sí |
| Detalle de producto público activo | Sí | Sí | Sí | Sí |
| Registrar cuenta pública | Comprador/Comerciante | Igual | Igual | Igual |
| Carrito temporal | Iniciar sesión | Propio | No | No |
| CRUD de usuarios | No | No | No | Sí |
| Crear comercio | No | No | Uno propio | Asignado a comerciante real |
| Editar/eliminar comercio | No | No | Propio | Cualquiera, con reglas de integridad |
| CRUD de productos | No | No | De su comercio | De cualquier comercio |
| Gestión de inactivos | No | No | Recursos propios | Todos |
| Dashboard global | No | No | No | Sí |

## Autorización real

Las rutas de escritura exigen sesión, rol permitido y CSRF. El servicio determina propiedad a partir del usuario de la sesión y la relación almacenada; no confía en `usuarioId` enviado por el navegador para otorgar permisos.

Un comerciante no puede asignar su comercio a otro usuario, modificar un producto ajeno o moverlo a otro negocio. El administrador puede asignar o reasignar comercios respetando el límite de uno por comerciante. No hay autorregistro de administradores.

- Falta sesión en operación protegida: 401.
- Rol o propiedad no permitidos: 403.
- Recurso privado no visible en consulta pública: 404.
- Reglas de integridad o datos inválidos: 400.

`?gestion=true` solo permite Administrador o Comerciante. Para el comerciante devuelve únicamente sus recursos, incluidos inactivos. Sin ese parámetro, los listados respetan disponibilidad pública incluso cuando quien consulta está autenticado.

## Navegación por rol

- Administrador → `dashboard.html`, `usuarios.html`, `negocios.html`, `productos.html`.
- Comerciante → `mi-negocio.html`, `mis-productos.html`, preview público de su comercio.
- Comprador → `marketplace.html`, detalle y `carrito.html`.
- Invitado → landing, marketplace y detalle; el botón de compra conduce al login.

Un rol incorrecto vuelve a su inicio, evitando el antiguo bucle hacia dashboard. El preview no convierte al comerciante en comprador ni habilita carrito. La protección del cliente no sustituye al servidor.

## Revocación e integridad

La sesión caduca a las ocho horas, al reiniciar el proceso, al cerrar sesión o cuando se revocan permisos/contraseña/estado. Usuarios inactivos no pueden iniciar sesión. Los mensajes entre pestañas no contienen identidad ni token; sirven para refrescar la sesión desde API.

No puede desaparecer el último administrador activo. No se permite eliminar la propia cuenta administradora. Un comerciante con comercio no puede cambiar a otro rol hasta resolver esa relación. Los borrados de usuario/comercio con dependencias se rechazan, sin cascadas destructivas.
