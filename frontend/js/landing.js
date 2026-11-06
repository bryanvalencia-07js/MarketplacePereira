/* Narrativa progresiva: el contenido permanece legible sin efectos. */
function activarNarrativa() {
  if (
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !("IntersectionObserver" in window)
  )
    return;
  document.documentElement.classList.add("reveal-listo");
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
    },
    { threshold: 0.12 },
  );
  document.querySelectorAll(".reveal").forEach((n) => observer.observe(n));
}

let contextoNarrativa;
let versionMovimiento = 0;
const movimientoNarrativa = matchMedia(
  "(min-width: 901px) and (prefers-reduced-motion: no-preference)",
);
async function actualizarMovimiento() {
  const version = ++versionMovimiento;
  contextoNarrativa?.revert();
  contextoNarrativa = null;
  document.documentElement.classList.remove("narrativa-animada");
  if (!movimientoNarrativa.matches) return;
  try {
    // Solo la landing y solo en escritorio con movimiento permitido.
    if (!window.gsap) await cargarScript("js/vendor/gsap.min.js");
    if (!window.ScrollTrigger)
      await cargarScript("js/vendor/ScrollTrigger.min.js");
    if (version !== versionMovimiento || !movimientoNarrativa.matches) return;
    gsap.registerPlugin(ScrollTrigger);
    contextoNarrativa = gsap.context(() => {
      document.documentElement.classList.add("narrativa-animada");
      const escena = (selector, update) => {
        const node = document.querySelector(selector);
        if (!node) return;
        ScrollTrigger.create({
          trigger: node,
          start: "top top",
          end: () => "+=" + Math.max(1, node.offsetHeight - innerHeight),
          invalidateOnRefresh: true,
          onUpdate: (self) => update(self.progress),
          onRefresh: (self) => update(self.progress),
        });
      };
      const transformar = (selector, vars) => {
        if (document.querySelector(selector)) gsap.set(selector, vars);
      };
      escena(".story-impacto", (p) =>
        transformar("#imagenImpactoPereira", {
          scale: 1.02 + p * 0.08,
          y: p * 18,
        }),
      );
      escena("#storyHumana", (p) => {
        transformar("#imagenStoryHumana", {
          scale: 1.06 - p * 0.04,
          x: (p - 0.5) * 20,
        });
        document.querySelectorAll(".story-fragmento").forEach((n) => {
          gsap.set(n, {
            opacity: p >= Number(n.dataset.inicio || 0) ? 1 : 0,
            y: p >= Number(n.dataset.inicio || 0) ? 0 : 18,
          });
        });
      });
      escena("#storyVisibilidad", (p) => {
        const mensajes = [...document.querySelectorAll(".story-problema")];
        mensajes.forEach((n, i) =>
          n.classList.toggle(
            "activo",
            i ===
              Math.min(mensajes.length - 1, Math.floor(p * mensajes.length)),
          ),
        );
        transformar("#progresoVisibilidad", { scaleY: p });
        transformar("#imagenStoryVisibilidad", { scale: 1.04 + p * 0.06 });
        document
          .querySelector("#storyNaceReactiva")
          ?.classList.toggle("visible", p > 0.82);
      });
      escena("#storyDigital", (p) => {
        const digital = Math.min(1, Math.max(0, (p - 0.22) / 0.48));
        transformar("#storyNegocioFisico", {
          opacity: 1 - digital,
          x: -p * 25,
        });
        transformar("#storyMarketplaceUI", {
          opacity: digital,
          y: 50 * (1 - digital),
          scale: 0.85 + digital * 0.15,
        });
        transformar("#progresoDigital", { scaleX: p });
        transformar("#storyTransformacionLuz", { opacity: 0 });
        document
          .querySelectorAll(".story-digital-mensaje")
          .forEach((n, i) =>
            n.classList.toggle(
              "activo",
              i === (p < 0.32 ? 0 : p < 0.68 ? 1 : 2),
            ),
          );
        document
          .querySelector("#storyDigitalSello")
          ?.classList.toggle("visible", p > 0.78);
      });
    });
  } catch {
    contextoNarrativa?.revert();
    document.documentElement.classList.remove("narrativa-animada");
  }
}
movimientoNarrativa.addEventListener("change", actualizarMovimiento);

function cargarProductoStory(productos, negocios) {
  const producto = productos.find((p) => RP.visible(p, negocios));

  if (!producto) return;

  const negocio = negocios.find((n) => RP.mismoId(n.id, producto.negocioId));

  const imagenContenedor = document.getElementById("storyProductoImagen");

  const imagen = RP.imagenSegura(producto.imagen);

  if (imagenContenedor) {
    if (imagen) {
      imagenContenedor.innerHTML = `<img
          src="${imagen}"
          alt="${UI.e(producto.nombre)}"
        >`;
    } else {
      imagenContenedor.textContent = String(producto.nombre || "R")
        .charAt(0)
        .toUpperCase();
    }
  }

  const datos = {
    storyProductoCategoria: producto.categoria,

    storyProductoNombre: producto.nombre,

    storyProductoNegocio: negocio?.nombre || "Comercio local",

    storyProductoPrecio: RP.dinero(producto.precio),

    storyProductoStock:
      RP.stock(producto) > 0 ? `${RP.stock(producto)} disponibles` : "Agotado",
  };

  for (const [id, valor] of Object.entries(datos)) {
    const nodo = document.getElementById(id);

    if (nodo) {
      nodo.textContent = valor;
    }
  }
}

async function cargarLanding() {
  try {
    const [negocios, productos, resumen] = await Promise.all([
      API.get("/negocios"),
      API.get("/productos"),
      API.get("/publico/resumen"),
    ]);
    document.getElementById("landingComercios").innerHTML =
      negocios.slice(0, 3).map(UI.tarjetaNegocio).join("") ||
      '<p class="estado-vacio">La comunidad está comenzando. Registra tu comercio y forma parte.</p>';
    document.getElementById("landingProductos").innerHTML =
      productos
        .slice(0, 4)
        .map((p) => UI.tarjetaProducto(p, negocios))
        .join("") ||
      '<p class="estado-vacio">Pronto descubrirás aquí los primeros productos publicados.</p>';
    cargarProductoStory(productos, negocios);
    UI.kpis(document.getElementById("landingImpacto"), [
      ["Comercios activos", negocios.length],
      ["Productos publicados", productos.length],
      ["Personas registradas", resumen.usuarios],
      ["Categorías", resumen.categorias],
    ]);
    animarIndicadores();
  } catch (error) {
    UI.estado(error.message, "error");
    for (const id of ["landingProductos", "landingComercios"])
      document.getElementById(id).innerHTML =
        '<p class="estado-vacio">No pudimos cargar esta sección. Recarga para intentar nuevamente.</p>';
  }
}
function animarIndicadores() {
  if (
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !("IntersectionObserver" in window)
  )
    return;
  const observador = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const nodo = entry.target;
        const final = Number(nodo.textContent);
        const inicio = performance.now();
        function paso(t) {
          const avance = Math.min(1, (t - inicio) / 700);
          nodo.textContent = Math.round(final * avance);
          if (avance < 1) requestAnimationFrame(paso);
        }
        requestAnimationFrame(paso);
        observador.unobserve(nodo);
      }
    },
    { threshold: 0.4 },
  );
  document
    .querySelectorAll("#landingImpacto strong")
    .forEach((n) => observador.observe(n));
}

activarNarrativa();
window.moduloListo = Promise.all([cargarLanding(), actualizarMovimiento()]);
