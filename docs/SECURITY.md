# Seguridad implementada y avisos conocidos

## Controles efectivos

- Scrypt con sal aleatoria de 16 bytes, clave de 64 bytes y parámetros N=32768, r=8, p=3; comparación constante. El formato guarda parámetros para evolución.
- Contraseña de 12–128 caracteres, nunca devuelta por API ni almacenada por el cliente. El respaldo legado elimina contraseña/hash y no importa permisos.
- Sesiones opacas aleatorias de 32 bytes, indexadas por SHA-256 en memoria del servidor. Expiración absoluta de ocho horas; revocación por cambio real de rol/estado/contraseña o eliminación.
- Cookie HttpOnly, SameSite Strict, Path=/, Secure en producción. No hay token bearer en LocalStorage.
- CSRF en operaciones administrativas, del comerciante y logout. Login/registro y visitas verifican origen/Fetch Metadata. Frontend y API comparten origen.
- Permisos por rol y propiedad en servidor, campos permitidos explícitos y validación de tipos/límites. No se acepta autoasignación de Administrador.
- CSP sin `unsafe-inline` ni `eval`; eventos/scripts externos. Escape de texto en tarjetas/listados y Data URLs limitadas a formatos de imagen permitidos.
- Cabeceras nosniff, denegación de frames, referrer same-origin, permisos de cámara/micrófono/geolocalización deshabilitados. HSTS en producción.
- JSON limitado a 2 MiB; imágenes limitadas y con firma básica validada. Cuerpos comprimidos rechazados antes del parser, con `inflate: false` adicional.
- Parser de query explícitamente `simple`. Rate limits: API 300/IP/minuto; auth 30/IP/15 minutos; login 12/correo/15 minutos; visitas 40/IP/minuto. Los mapas están acotados y eliminan entradas vencidas.
- Servidor principal: timeout de request 30 segundos y headers 15 segundos. Errores internos no devuelven stack, credenciales ni detalles técnicos de persistencia.

## Auditoría npm observada

Comando ejecutado:

```bash
npm audit --omit=dev --audit-level=high --prefix backend
```

El registro consultado reportó **3 hallazgos de paquetes: 2 altos y 1 moderado**, sin corrección disponible. No se ocultaron con overrides, cambios de checksum ni desactivación de verificación.

| Aviso | Dependencia/ruta | Tratamiento en esta aplicación |
|---|---|---|
| [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828), DoS con bytes posteriores a cuerpo comprimido | `body-parser`, transitivo de Express; Express también aparece afectado por dependencia | Se rechaza Content-Encoding distinto de identity antes de invocar el parser. JSON usa inflate=false. Prueba con gzip + trailing bytes devuelve 415. |
| [GHSA-6pq8-jhm2-2vcw](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw), `qs.stringify` con arrayFormat comma | `qs`, transitivo | No se llama qs.stringify; se fuerza el parser simple de Node. La aplicación no acepta objetos JS del cliente para ese serializador. |

Estas restricciones mitigan las rutas descritas usadas por esta aplicación, **no eliminan los avisos ni equivalen a una corrección upstream**. El audit sigue retornando fallo. Antes de un despliegue comercial debe revisarse disponibilidad de versiones corregidas y repetir la suite tras actualizar.

## Límites reales

Persistencia y sesiones son de un único proceso en memoria. Reiniciar borra datos y autenticaciones. No hay almacén compartido para múltiples instancias ni durabilidad de producción. El rate limit también es por proceso.

El carrito es temporal del navegador y manipulable por su usuario; no es un pedido ni un cálculo autorizado para cobrar. El servidor deberá revalidar precios/stock dentro de una transacción de checkout cuando se implemente ese flujo. No hay pagos ni reserva de inventario.

Las imágenes se validan por tipo/firma/tamaño, no por un servicio externo de análisis ni almacenamiento duradero. No hay subida multipart o alojamiento de imágenes independiente todavía.

Para exposición externa se requieren HTTPS, `NODE_ENV=production`, origen exacto en `APP_ORIGIN` y secretos de bootstrap fuera de Git. No existe contraseña inicial distribuida. La confianza en proxy/IP y el almacén duradero deben configurarse según el despliegue real.

Las pruebas verifican controles concretos; no constituyen pentest completo ni certificación de seguridad de producción.
