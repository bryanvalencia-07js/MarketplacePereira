# UX y sistema visual

## Identidad

Variables centralizadas en un único `:root` de `frontend/css/estilos.css`:

| Token | Valor / uso |
|---|---|
| `--amarillo-rp` | `#f4c548`: energía, ilustración y acentos |
| `--rojo-rp` | `#aa293b`: acciones e identidad |
| `--rojo-oscuro` | `#7b1d2d`: contraste y secciones narrativas |
| `--crema` | `#faf7f1`: fondo cálido |
| `--superficie` | Blanco: formularios y tarjetas |
| `--texto` | `#252830`: texto principal |
| `--texto-secundario` | `#5b606a`: información secundaria |
| `--exito` | `#176346`: estados positivos |
| `--peligro` | `#a22535`: errores y acciones destructivas |

Serif para identidad/títulos, sans serif para interfaz, con fallbacks locales. Rojo y amarillo se concentran en CTAs, bordes, ilustración y narrativa; el verde queda para estados positivos. Se unificaron botones, tarjetas, KPIs, badges, mensajes, formularios, modal, foco y estados disabled.

## Landing y scrollytelling

Narrativa: contexto de la comunidad → comerciante publica → comprador descubre → apoyo local → comunidad activa. Hero con ilustración CSS propia, CTA a explorar y registro de comerciante. Comercios, productos e indicadores se obtienen de API; no se inventan cifras o publicaciones.

`IntersectionObserver` revela secciones y activa los contadores al entrar en viewport. No hay biblioteca de animación. Con `prefers-reduced-motion` se omiten reveal y contadores animados; sin soporte de observer el contenido sigue visible. La página incluye enlace para saltar al contenido.

## Experiencias

- Marketplace: buscador por nombre/descripción/categoría/comercio, categorías combinadas, limpiar filtros, resultados, populares, recientes, comercios y contador real del carrito. El hero móvil se compacta.
- Detalle: imagen, categoría, descripción, precio, stock, estado, datos del vendedor, selector y feedback de compra. Agotado deshabilita selector y agregar.
- Carrito: cantidades, stock actual, quitar, vaciar con confirmación, estado vacío correcto y totales actualizados. No simula pago.
- Comerciante: KPIs de catálogo, activos/inactivos, agotados, stock bajo y visitas; completitud del perfil, edición y accesos a productos/preview.
- Administrador: KPIs, alertas y actividad con `createdAt`; usuarios, negocios con dueño real y catálogo global.

## Accesibilidad y feedback

Eventos enlazados desde JavaScript externo, sin handlers inline. Formularios con labels y filtros con nombres accesibles. Foco visible, botones disabled durante tareas, estados loading/error/success/empty, mensajes con `role` y `aria-live`.

La confirmación usa `<dialog>` nativo con Cancelar inicialmente enfocado, Escape para cancelar y retorno de foco al disparador. Se sustituyeron `alert()` y `confirm()` del flujo normal.

Se comprobaron 360/768/1024/1440 px en las páginas de los tres roles y las públicas, sin overflow horizontal. Se revisaron capturas de landing escritorio y marketplace móvil. Esto no equivale a una certificación WCAG ni a una revisión completa en todos los navegadores.
