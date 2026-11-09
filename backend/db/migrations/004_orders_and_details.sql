CREATE TABLE pedidos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuarioId INT UNSIGNED NOT NULL,
  negocioId INT UNSIGNED NOT NULL,
  estado VARCHAR(10) NOT NULL DEFAULT 'Pendiente',
  observaciones VARCHAR(2000) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_pedido_usuario FOREIGN KEY (usuarioId) REFERENCES usuarios(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_pedido_negocio FOREIGN KEY (negocioId) REFERENCES negocios(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_pedido_estado CHECK (estado IN ('Pendiente','Confirmado','Completado','Cancelado')),
  INDEX idx_pedido_usuario_fecha (usuarioId,createdAt),
  INDEX idx_pedido_negocio_estado_fecha (negocioId,estado,createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE detalles_pedido (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  pedidoId INT UNSIGNED NOT NULL,
  productoId INT UNSIGNED NOT NULL,
  cantidad INT NOT NULL,
  precioUnitario DECIMAL(12,2) NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_detalle_pedido FOREIGN KEY (pedidoId) REFERENCES pedidos(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_detalle_producto FOREIGN KEY (productoId) REFERENCES productos(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_detalle_cantidad CHECK (cantidad BETWEEN 1 AND 1000),
  CONSTRAINT ck_detalle_precio CHECK (precioUnitario > 0 AND precioUnitario <= 1000000000),
  CONSTRAINT uq_detalle_pedido_producto UNIQUE (pedidoId,productoId),
  INDEX idx_detalle_producto (productoId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
