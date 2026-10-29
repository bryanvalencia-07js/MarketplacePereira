/* Datos temporales vacíos por instancia. Sin cuentas ni credenciales predeterminadas. */
function createInitialData() {
  return { usuarios: [], negocios: [], productos: [] };
}
module.exports = { createInitialData };
