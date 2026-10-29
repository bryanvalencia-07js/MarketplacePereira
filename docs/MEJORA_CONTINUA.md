# Registro de mejora continua

No había una habilidad instalada llamada “self improvement”. Se aplicó un ciclo explícito de revisión, implementación incremental, pruebas y aprendizaje, sin afirmar que se haya utilizado una herramienta inexistente.

## Método aplicado

Inspeccionar antes de editar → preservar comportamiento útil → implementar por responsabilidades → probar con casos que pueden fallar → corregir → documentar el resultado y sus límites.

Se usaron prácticas de XP proporcionales al proyecto: feedback corto, integración entre componentes y regresiones automatizadas. No se afirma TDD estricto ni programación en pareja. SOLID se aplicó como guía para separar responsabilidades y depender de contratos de persistencia, sin introducir clases o frameworks innecesarios.

## Aprendizajes y decisiones

| Hallazgo | Decisión | Evidencia |
|---|---|---|
| Diagnóstico sobre checkout antiguo | Usar el commit correcto conservando cambios locales | Base e inventario Git registrados |
| HTML/JS divergentes y guardado falso en Fase 1 | IDs coherentes y guardar antes de anunciar éxito | CRUD/imágenes y persistencia fallida |
| Disponibilidad repetida en varios módulos | Regla compartida de presentación y filtro real en servidor | Catálogo, filtros, detalle, visitas y carrito |
| LocalStorage permite falsificar roles | Sesión opaca HttpOnly, permisos y dueño en servidor | 401/403, registro sin admin, recursos ajenos |
| Copiar cuentas antiguas importaría permisos inseguros | Respaldo sin credenciales y sin importación automática | Prueba de datos legados |
| Pestañas y reinicios pueden mezclar IDs viejos | Revalidar datos/sesión y separar carrito por instancia | Stock, cierre de sesión y nueva instancia |
| Totales podían perder decimales visuales | Sumar centavos y formatear COP con decimales | Prueba de precio 10.25 × 2 |
| Inline JS exigiría CSP permisiva | Eventos externos mediante data-* y módulos protegidos | Sin unsafe-inline, consola y estructura |
| Avisos transitivos sin parche | Rechazar compresión, parser simple y registrar limitación | Gzip/trailing bytes → 415; audit sigue informado |
| Repositorios acoplados dificultarían SQL | Contrato async, copias e inyección validada | Pruebas de contrato y errores de persistencia |
| Fixtures podían navegar mientras se restablecía el servidor | Descargar el documento anterior antes de reiniciar el fixture | Suite completa estable, sin omisiones |

## Siguiente revisión

El cambio futuro de persistencia debe mantener los contratos documentados y pasar las mismas regresiones. Los avisos upstream deben revisarse al actualizar dependencias. Cualquier checkout/pago posterior necesita validación transaccional en servidor; el carrito actual no se reutiliza como autorización de cobro.
