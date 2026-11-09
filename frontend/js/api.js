/* Toda comunicación HTTP vive aquí. Mismo origen: la cookie nunca se expone a JS. */
const API = (() => {
  const API_URL = "/api";
  let csrfToken = "";
  let instancia = "";
  async function request(ruta, { method = "GET", body } = {}) {
    const controlador = new AbortController();
    const tiempo = setTimeout(() => controlador.abort(), 12000);
    try {
      const respuesta = await fetch(API_URL + ruta, {
        method,
        credentials: "same-origin",
        signal: controlador.signal,
        headers: {
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(method !== "GET" && csrfToken
            ? { "X-CSRF-Token": csrfToken }
            : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      let json;
      try {
        json = await respuesta.json();
      } catch {
        throw new Error("El servidor devolvió una respuesta no válida.");
      }
      if (!respuesta.ok || !json.ok) {
        const error = new Error(
          json.mensaje || "No se pudo completar la solicitud.",
        );
        error.status = respuesta.status;
        if (respuesta.status === 401 && !ruta.startsWith("/auth/login"))
          window.dispatchEvent(new Event("sesion-caducada"));
        throw error;
      }
      if (json.data?.csrfToken !== undefined) csrfToken = json.data.csrfToken;
      if (json.data?.instancia) instancia = json.data.instancia;
      return json.data;
    } catch (error) {
      if (error.name === "AbortError")
        throw new Error("La solicitud tardó demasiado. Intenta nuevamente.");
      if (error instanceof TypeError)
        throw new Error(
          "No se pudo conectar con el servidor. Revisa tu conexión e intenta nuevamente.",
        );
      throw error;
    } finally {
      clearTimeout(tiempo);
    }
  }
  return {
    get: (ruta) => request(ruta),
    post: (ruta, body) => request(ruta, { method: "POST", body }),
    patch: (ruta, body) => request(ruta, { method: "PATCH", body }),
    put: (ruta, body) => request(ruta, { method: "PUT", body }),
    delete: (ruta) => request(ruta, { method: "DELETE" }),
    get instancia() {
      return instancia;
    },
  };
})();
