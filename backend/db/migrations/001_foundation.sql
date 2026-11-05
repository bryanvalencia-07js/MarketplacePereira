CREATE TABLE usuarios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  apellido VARCHAR(80) NOT NULL,
  correo VARCHAR(254) NOT NULL,
  telefono VARCHAR(30) NOT NULL DEFAULT '',
  passwordHash VARCHAR(255) NOT NULL,
  rol VARCHAR(20) NOT NULL,
  estado VARCHAR(8) NOT NULL DEFAULT 'Activo',
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_usuario_correo UNIQUE (correo),
  CONSTRAINT uq_usuario_rol UNIQUE (id, rol),
  CONSTRAINT ck_usuario_rol CHECK (rol IN ('Administrador', 'Comerciante', 'Comprador')),
  CONSTRAINT ck_usuario_estado CHECK (estado IN ('Activo', 'Inactivo')),
  CONSTRAINT ck_usuario_correo CHECK (correo = LOWER(correo)),
  INDEX idx_usuario_rol_estado (rol, estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE negocios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuarioId INT UNSIGNED NOT NULL,
  usuarioRol VARCHAR(20) NOT NULL DEFAULT 'Comerciante',
  nombre VARCHAR(120) NOT NULL,
  categoria VARCHAR(60) NOT NULL,
  telefono VARCHAR(30) NOT NULL,
  direccion VARCHAR(200) NOT NULL,
  estado VARCHAR(8) NOT NULL DEFAULT 'Activo',
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_negocio_usuario UNIQUE (usuarioId),
  CONSTRAINT ck_negocio_rol CHECK (usuarioRol = 'Comerciante'),
  CONSTRAINT ck_negocio_estado CHECK (estado IN ('Activo', 'Inactivo')),
  CONSTRAINT fk_negocio_usuario FOREIGN KEY (usuarioId, usuarioRol)
    REFERENCES usuarios (id, rol) ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_negocio_estado_categoria (estado, categoria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE productos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  negocioId INT UNSIGNED NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  descripcion VARCHAR(2000) NOT NULL,
  categoria VARCHAR(60) NOT NULL,
  precio DECIMAL(12,2) NOT NULL,
  stock INT NOT NULL,
  imagen MEDIUMTEXT NOT NULL,
  estado VARCHAR(8) NOT NULL DEFAULT 'Activo',
  popularidad INT UNSIGNED NOT NULL DEFAULT 0,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_producto_negocio FOREIGN KEY (negocioId)
    REFERENCES negocios (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_producto_precio CHECK (precio > 0 AND precio <= 1000000000),
  CONSTRAINT ck_producto_stock CHECK (stock BETWEEN 0 AND 1000000),
  CONSTRAINT ck_producto_estado CHECK (estado IN ('Activo', 'Inactivo')),
  CONSTRAINT ck_producto_imagen CHECK (CHAR_LENGTH(imagen) <= 1800000),
  INDEX idx_producto_negocio (negocioId),
  INDEX idx_producto_estado_categoria (estado, categoria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE repository_lock (
  id TINYINT NOT NULL PRIMARY KEY,
  CONSTRAINT ck_repository_lock CHECK (id = 1)
) ENGINE=InnoDB;

INSERT INTO repository_lock (id) VALUES (1);
