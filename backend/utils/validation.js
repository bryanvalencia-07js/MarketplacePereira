const { exigir } = require("./errors");
const ROLES = ["Administrador", "Comerciante", "Comprador"];
const ESTADOS = ["Activo", "Inactivo"];
function objeto(body, permitidos) {
  exigir(
    body && typeof body === "object" && !Array.isArray(body),
    400,
    "Envía un objeto JSON válido.",
  );
  exigir(
    Object.keys(body).every((k) => permitidos.includes(k)),
    400,
    "La solicitud contiene campos no permitidos.",
  );
}
function texto(valor, nombre, max = 120, requerido = true) {
  if (!requerido && (valor === undefined || valor === "")) return "";
  exigir(
    typeof valor === "string" &&
      valor.trim().length > 0 &&
      valor.trim().length <= max,
    400,
    `${nombre}: ingresa un texto de hasta ${max} caracteres.`,
  );
  return valor.trim();
}
function correo(valor) {
  const email = texto(valor, "Correo", 254).toLowerCase();
  exigir(
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    400,
    "Ingresa un correo válido.",
  );
  return email;
}
function password(valor) {
  exigir(
    typeof valor === "string" && valor.length >= 12 && valor.length <= 128,
    400,
    "La contraseña debe tener entre 12 y 128 caracteres.",
  );
  return valor;
}
function entero(valor, nombre, min = 1, max = Number.MAX_SAFE_INTEGER) {
  exigir(
    typeof valor === "number" &&
      Number.isSafeInteger(valor) &&
      valor >= min &&
      valor <= max,
    400,
    `${nombre}: ingresa un número entero válido.`,
  );
  return valor;
}
function id(valor) {
  exigir(
    typeof valor === "string" && /^[1-9]\d*$/.test(valor),
    400,
    "Identificador inválido.",
  );
  return entero(Number(valor), "Identificador");
}
function opcion(valor, opciones, nombre) {
  exigir(opciones.includes(valor), 400, `${nombre} inválido.`);
  return valor;
}
function imagen(valor) {
  exigir(
    typeof valor === "string" &&
      valor.length <= 1800000 &&
      /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(valor),
    400,
    "Selecciona una imagen JPEG, PNG o WEBP válida y optimizada.",
  );
  const [, tipo, contenido] = valor.match(
    /^data:image\/(jpeg|png|webp);base64,(.*)$/,
  );
  const bytes = Buffer.from(contenido, "base64");
  const correcta =
    tipo === "jpeg"
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : tipo === "png"
        ? bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes.subarray(0, 4).toString() === "RIFF" &&
          bytes.subarray(8, 12).toString() === "WEBP";
  exigir(
    correcta,
    400,
    "El contenido de la imagen no corresponde a su formato.",
  );
  return valor;
}
module.exports = {
  ROLES,
  ESTADOS,
  objeto,
  texto,
  correo,
  password,
  entero,
  id,
  opcion,
  imagen,
};
