function activarNarrativa() {
  if (
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !("IntersectionObserver" in window)
  )
    return;
  document.documentElement.classList.add("reveal-listo");
  const observer = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas)
        if (entrada.isIntersecting) {
          entrada.target.classList.add("visible");
          observer.unobserve(entrada.target);
        }
    },
    { threshold: 0.12 },
  );
  document
    .querySelectorAll(".reveal")
    .forEach((nodo) => observer.observe(nodo));
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
activarNarrativa();
window.moduloListo = cargarLanding();

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
