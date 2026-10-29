const {
  randomBytes,
  scrypt: scryptCallback,
  timingSafeEqual,
} = require("node:crypto");
const { promisify } = require("node:util");
const scrypt = promisify(scryptCallback);
// Parámetros explícitos, almacenados junto al hash para permitir evolución.
const opciones = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64, opciones);
  return `scrypt:32768:8:3:${salt}:${hash.toString("hex")}`;
}
async function verifyPassword(password, encoded) {
  const [algoritmo, n, r, p, salt, valor] = String(encoded).split(":");
  if (
    algoritmo !== "scrypt" ||
    n !== "32768" ||
    r !== "8" ||
    p !== "3" ||
    !/^[0-9a-f]{32}$/.test(salt || "") ||
    !/^[0-9a-f]{128}$/.test(valor || "")
  )
    return false;
  const calculado = await scrypt(password, salt, 64, opciones);
  return timingSafeEqual(calculado, Buffer.from(valor, "hex"));
}
module.exports = { hashPassword, verifyPassword };
