/* Firma de apertura: independiente de API, sin bloquear foco, scroll ni enlaces. */
(() => {
  const firma = document.getElementById("firmaApertura");
  const movimiento = matchMedia("(prefers-reduced-motion: reduce)");
  if (!firma || movimiento.matches || location.hash || scrollY > 0) return;
  try {
    if (sessionStorage.getItem("rp-apertura-v1")) return;
    sessionStorage.setItem("rp-apertura-v1", "vista");
  } catch {
    // Sin almacenamiento de sesión, priorizar el acceso inmediato.
    return;
  }
  const eventos = ["pointerdown", "keydown", "wheel", "touchstart", "scroll", "focusin"];
  const opciones = { passive: true, capture: true };
  let temporizador;
  function descartar() {
    firma.hidden = true;
    clearTimeout(temporizador);
    eventos.forEach((evento) => window.removeEventListener(evento, descartar, opciones));
    window.removeEventListener("pagehide", descartar);
    movimiento.removeEventListener("change", descartar);
  }
  eventos.forEach((evento) => window.addEventListener(evento, descartar, opciones));
  window.addEventListener("pagehide", descartar, { once: true });
  movimiento.addEventListener("change", descartar);
  firma.hidden = false;
  temporizador = setTimeout(descartar, 1250);
})();
