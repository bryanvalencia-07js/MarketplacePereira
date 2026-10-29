class AppError extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}
const exigir = (condicion, status, mensaje) => {
  if (!condicion) throw new AppError(status, mensaje);
};
module.exports = { AppError, exigir };
