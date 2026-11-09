// Datos de referencia. Los IDs se resuelven por relación, nunca conceden permisos.
const ROLES = ["Administrador", "Comerciante", "Comprador"];
const CATEGORIAS = [
  "Alimentos",
  "Bebidas",
  "Restaurantes",
  "Café y panadería",
  "Ropa",
  "Calzado",
  "Accesorios",
  "Tecnología",
  "Hogar",
  "Belleza",
  "Salud y bienestar",
  "Deportes",
  "Mascotas",
  "Papelería",
  "Artesanías",
  "Ferretería",
  "Automotriz",
  "Educación",
  "Servicios",
  "Turismo",
  "Entretenimiento",
  "Agro",
  "Regalos",
  "Otro",
];
const limpiarNombre = (valor) =>
  String(valor).normalize("NFC").trim().replace(/\s+/gu, " ");
const claveNombre = (valor) =>
  limpiarNombre(valor).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
module.exports = { ROLES, CATEGORIAS, limpiarNombre, claveNombre };
