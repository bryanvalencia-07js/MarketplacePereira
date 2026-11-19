const mysql = require("mysql2/promise");

/*
 * Crea el pool de conexiones a MySQL.
 *
 * Un pool mantiene varias conexiones disponibles para que
 * diferentes peticiones HTTP puedan usar la base de datos
 * sin abrir una conexión nueva cada vez.
 */
function createPool(config) {
  return mysql.createPool({
    ...config,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 100,
    connectTimeout: 10000,

    // El backend trabaja las fechas en UTC.
    timezone: "Z",

    // Compatible con MySQL y MariaDB/XAMPP.
    charset: "utf8mb4_unicode_ci",

    // Evita ejecutar varias sentencias SQL dentro
    // de una sola llamada.
    multipleStatements: false,

    // DECIMAL se convierte posteriormente en el Repository.
    decimalNumbers: false,
  });
}


/*
 * Configuración que se aplica cada vez que una conexión
 * es tomada del pool.
 */
async function prepararConexion(connection) {
  /*
   * utf8mb4 permite almacenar correctamente:
   *
   * ñ
   * tildes
   * símbolos
   * emojis
   *
   * utf8mb4_unicode_ci funciona tanto en MySQL como
   * en MariaDB y es suficiente para nuestro proyecto.
   */
  await connection.query(
    "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
  );


  /*
   * Guardamos y consultamos fechas usando UTC.
   *
   * STRICT_TRANS_TABLES hace que MySQL rechace valores
   * incorrectos en lugar de corregirlos silenciosamente.
   */
  await connection.query(`
    SET
      time_zone = '+00:00',
      SESSION sql_mode =
      'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION'
  `);
}


module.exports = {
  createPool,
  prepararConexion,
};