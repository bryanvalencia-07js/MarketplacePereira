/* Procesamiento local sustituible por upload multipart en una etapa posterior. */
const ImagenProducto = (() => {
  let imagenVersion = 0;
  let imagenProcesandose = false;
  let imagenProductoBase64 = "";
  const mostrarMensajeProducto = (texto, tipo) =>
    UI.estado(texto, tipo, "mensajeProducto");

  function procesandoImagen(valor) {
    imagenProcesandose = valor;
    document.querySelector('#formProducto button[type="submit"]').disabled =
      valor;
  }

  function previsualizarImagen(event) {
    const archivo = event.target.files[0];
    if (!archivo) return;
    const version = ++imagenVersion;
    procesandoImagen(false);
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(archivo.type) ||
      archivo.size > 10 * 1024 * 1024
    ) {
      mostrarMensajeProducto(
        "Selecciona una imagen JPG, PNG o WEBP de hasta 10 MB.",
        "error",
      );
      event.target.value = "";
      return;
    }
    procesandoImagen(true);
    mostrarMensajeProducto("Procesando imagen…", "exito");
    const fallar = () => {
      if (version !== imagenVersion) return;
      procesandoImagen(false);
      event.target.value = "";
      mostrarMensajeProducto(
        "No se pudo procesar la imagen. Selecciona otro archivo.",
        "error",
      );
    };
    const lector = new FileReader();
    lector.onerror = fallar;
    lector.onabort = fallar;
    lector.onload = () => {
      if (version !== imagenVersion) return;
      const imagen = new Image();
      imagen.onerror = fallar;
      imagen.onload = () => {
        if (version !== imagenVersion) return;
        try {
          const escala = Math.min(
            1,
            900 / Math.max(imagen.width, imagen.height),
          );
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(imagen.width * escala));
          canvas.height = Math.max(1, Math.round(imagen.height * escala));
          const contexto = canvas.getContext("2d");
          if (!contexto) throw new Error();
          // JPEG no tiene canal alfa: fondo blanco para PNG/WEBP transparentes.
          contexto.fillStyle = "#fff";
          contexto.fillRect(0, 0, canvas.width, canvas.height);
          contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);
          const resultado = canvas.toDataURL("image/jpeg", 0.72);
          if (!RP.imagenSegura(resultado)) throw new Error();
          imagenProductoBase64 = resultado;
          document.getElementById("previewProducto").src = resultado;
          document.getElementById("contenedorPreview").hidden = false;
          procesandoImagen(false);
          mostrarMensajeProducto("Imagen lista para guardar.", "exito");
        } catch {
          fallar();
        }
      };
      imagen.src = lector.result;
    };
    try {
      lector.readAsDataURL(archivo);
    } catch {
      fallar();
    }
  }

  function cargar(valor) {
    imagenVersion++;
    procesandoImagen(false);
    imagenProductoBase64 = RP.imagenSegura(valor);
    const preview = document.getElementById("previewProducto");
    if (imagenProductoBase64) preview.src = imagenProductoBase64;
    else preview.removeAttribute("src");
    document.getElementById("contenedorPreview").hidden = !imagenProductoBase64;
    document.getElementById("imagenProducto").value = "";
  }
  return {
    seleccionar: previsualizarImagen,
    cargar,
    get valor() {
      return imagenProductoBase64;
    },
    get procesando() {
      return imagenProcesandose;
    },
  };
})();
