const mysql = require("mysql2/promise");

function createPool(config) {
  return mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 100,
    connectTimeout: 10000,
    timezone: "Z",
    // El handshake usa un ID de collation de un byte; 0900_as_cs se fija después.
    charset: "utf8mb4_unicode_ci",
    multipleStatements: false,
    // DECIMAL se convierte explícitamente en el DTO; nunca redondear en el driver.
    decimalNumbers: false,
  });
}

async function prepararConexion(connection) {
  await connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_0900_as_cs");
  await connection.query(
    "SET time_zone = '+00:00', SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION'",
  );
}

module.exports = { createPool, prepararConexion };
