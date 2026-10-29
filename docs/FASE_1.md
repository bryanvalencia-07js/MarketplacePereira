> Documento histórico de la Fase 1. La arquitectura y los resultados vigentes se describen en README.md, ARCHITECTURE.md y TESTING.md.

# Entrega Fase 1 — estabilización

## Base y alcance

Base de trabajo: `1d284a11d43becb5b0575db53bf52c650e041fa9` de `main`. El checkout anterior estaba en `25f1b61`; se actualizó mediante fast-forward con árbol limpio para conservar los cambios nuevos de carrito y detalle. No se hicieron commits ni push ni se usó reset.

Se aplicó la sección 23 del [roadmap inicial](ROADMAP_INICIAL.md): comenzar únicamente por Fase 1 y detenerse antes de Fase 2. Se conserva HTML/CSS/JS nativo, identidad visual, modelo de LocalStorage y backend. No se crean tablas, ORM, pagos ni una integración API simulada.

## Cambios y justificación

| Archivos | Cambio | Justificación |
|---|---|---|
| `frontend/js/estado-local.js` (nuevo) | Lectura/escritura protegida, IDs, regla de visibilidad, reconciliación, contador y escape | Eliminar reglas divergentes y evitar sobrescribir JSON corrupto |
| `frontend/mis-productos.html` | Descripción con label, ID de preview correcto, estado accesible y límite de imagen informado | Reparar errores de `.value`/`.hidden` sobre elementos inexistentes |
| `frontend/js/mis-productos.js` | CRUD con guardado comprobado, rollback de memoria, relectura y comprobación de dueño, validación numérica | Evitar éxito falso, escrituras obsoletas y operaciones ajenas |
| Mismo script | Preview con errores/cancelación/versionado, compresión a 900 px, JPEG 0.72 y fondo blanco | Evitar quedarse procesando o aplicar una imagen anterior después de cancelar/editar |
| `frontend/js/marketplace.js` | Misma visibilidad para catálogo/búsqueda/categorías/populares, búsqueda por descripción, contador y eventos storage | No mostrar inactivos/huérfanos ni un contador desactualizado |
| `frontend/js/detalle-producto.js` | Vendedor completo, revalidación al agregar, cantidad acumulada y controles agotados deshabilitados | Mostrar información útil y bloquear compras inválidas |
| Mismo script | Popularidad solo con disponibilidad de compra y escritura fresca | Evitar contar inactivos/agotados o guardar una copia vieja del catálogo |
| `frontend/js/carrito.js` | Reconciliar referencias/stock, eliminar agotados/inactivos, preservar ajenos, sumar precios actuales | Mantener carrito y totales coherentes |
| `frontend/js/sesion.js` | Cuenta activa actual, sesión mínima, ruta por rol, carga condicional y revocación entre pestañas | Evitar bucles y ejecución del módulo después de denegar acceso |
| `frontend/js/login.js` | Sesión sin copia de contraseña | Reducir exposición sin adelantar la migración backend |
| `frontend/js/mi-negocio.js` | Relectura/guardado confirmado y enlace de productos correcto | No anunciar persistencia fallida ni mostrar acceso sin comercio |
| HTML de carrito/detalle/marketplace/mi-negocio/mis-productos/usuarios/negocios | Carga del módulo tras comprobar rol; mensajes donde hacen falta | Impedir ejecutar módulos no autorizados y dar feedback accesible |
| `frontend/dashboard.html` | Carga de utilidades antes de sesión | Compartir la validación y redirección por rol |
| `frontend/css/estilos.css` | Disabled/focus visibles, ajuste de texto y cabeceras móviles | Corregir overflow real detectado a 360 px, sin rediseñar |
| `tests/package.json`, lockfile y `tests/phase1.test.cjs` | Suite reproducible con Playwright como dependencia exclusiva de desarrollo | Verificar comportamiento real sin dependencias de ejecución nuevas |
| `README.MD`, `docs/` | Arquitectura actual, API real, roles, pruebas, roadmap y mejoras | Dejar registro revisable y diferenciar implementado de planificado |

Carrito y detalle se simplificaron en su propio ámbito: sus lecturas repetidas y validaciones divergentes se sustituyeron por reglas compartidas; se conservaron los nombres usados por handlers HTML y clases visuales. El diff elimina muchos comentarios/separadores repetidos de esos dos módulos, no funcionalidades de otros componentes.

## Evidencia y aceptación

Resultado final: **19/19 pruebas aprobadas**, sin fallos ni omisiones. También pasaron sintaxis de todos los scripts y `git diff --check`. Ver [TESTING.md](TESTING.md) para ejecución y cobertura. La validación usa navegador real, datos ficticios y contextos aislados. Las pruebas descubrieron overflow en cabeceras móvil y se corrigió el layout antes de repetirlas.

Se demuestra el recorrido comerciante → comercio → CRUD de productos y el recorrido comprador → catálogo → detalle → carrito. Se comprueba separación por comprador, propiedad por comercio, invalidación, stock, cantidades, totales, persistencia fallida y ausencia de recursos locales fallidos/excepciones en los casos probados.

## Pendientes explícitos

- Autenticación/registro siguen en LocalStorage. `usuarios` conserva passwords académicos; esta entrega no es apta para producción. Reducir la sesión no equivale a hashing.
- El backend existente sigue independiente y no autoriza peticiones. Su arquitectura, autenticación y conexión con fetch se implementan en Fases 3–4.
- El administrador todavía crea negocios sin `usuarioId`. No se asignaron propietarios inventados. Tampoco hay cascadas de eliminación; la visibilidad/carrito toleran las referencias huérfanas.
- No hay transacciones atómicas de LocalStorage entre pestañas; se reduce obsolescencia releyendo, pero escrituras simultáneas aún pueden competir.
- El escape protege las tarjetas intervenidas, no constituye auditoría completa de seguridad de toda la aplicación o del CRUD administrativo.
- El carrito no reserva ni descuenta stock: no hay pedidos ni pagos. El total no incluye envío, impuestos o descuentos.
- Las imágenes continúan dentro del almacenamiento del navegador. Fallos de cuota se informan sin borrar datos.
- El alcance responsive comprobado es el de las páginas funcionales indicadas en pruebas; no equivale a una auditoría visual completa o WCAG.
- No se implementó el sistema visual rojo/amarillo, landing con scrollytelling, nuevos KPIs ni demás trabajo de Fase 2.

## Revisión

Revisar con `git diff --stat`, `git diff` y `git status --short`. Los archivos nuevos se listan en status y no aparecen en el stat de archivos ya rastreados hasta que se incorporen al índice. No se usa `git add` como parte de esta entrega.
