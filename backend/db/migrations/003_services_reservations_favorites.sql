CREATE TABLE servicios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  negocioId INT UNSIGNED NOT NULL,
  categoriaId INT UNSIGNED NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  descripcion VARCHAR(2000) NOT NULL,
  precioReferencia DECIMAL(12,2) NOT NULL,
  estado VARCHAR(8) NOT NULL DEFAULT 'Activo',
  duracionMinutos INT NOT NULL,
  capacidadSimultanea INT NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_servicio_negocio FOREIGN KEY (negocioId) REFERENCES negocios(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_servicio_categoria FOREIGN KEY (categoriaId) REFERENCES categorias(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_servicio_nombre CHECK (CHAR_LENGTH(TRIM(nombre)) > 0),
  CONSTRAINT ck_servicio_descripcion CHECK (CHAR_LENGTH(TRIM(descripcion)) > 0),
  CONSTRAINT ck_servicio_precio CHECK (precioReferencia >= 0 AND precioReferencia <= 1000000000),
  CONSTRAINT ck_servicio_estado CHECK (estado IN ('Activo','Inactivo')),
  CONSTRAINT ck_servicio_duracion CHECK (duracionMinutos BETWEEN 1 AND 1440),
  CONSTRAINT ck_servicio_capacidad CHECK (capacidadSimultanea BETWEEN 1 AND 100),
  INDEX idx_servicio_negocio (negocioId),
  INDEX idx_servicio_estado_categoria (estado,categoriaId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE horarios_servicio (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  servicioId INT UNSIGNED NOT NULL,
  diaSemana TINYINT NOT NULL,
  horaInicio TIME NOT NULL,
  horaFin TIME NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_horario_servicio FOREIGN KEY (servicioId) REFERENCES servicios(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT ck_horario_dia CHECK (diaSemana BETWEEN 1 AND 7),
  CONSTRAINT ck_horario_horas CHECK (horaInicio >= '00:00:00' AND horaFin < '24:00:00' AND horaInicio < horaFin AND SECOND(horaInicio) = 0 AND SECOND(horaFin) = 0),
  CONSTRAINT uq_horario_inicio UNIQUE (servicioId,diaSemana,horaInicio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE reservas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuarioId INT UNSIGNED NOT NULL,
  servicioId INT UNSIGNED NOT NULL,
  fechaHoraInicio DATETIME(3) NOT NULL,
  estado VARCHAR(10) NOT NULL DEFAULT 'Confirmada',
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_reserva_usuario FOREIGN KEY (usuarioId) REFERENCES usuarios(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_reserva_servicio FOREIGN KEY (servicioId) REFERENCES servicios(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_reserva_estado CHECK (estado IN ('Confirmada','Cancelada')),
  INDEX idx_reserva_servicio_estado_inicio (servicioId,estado,fechaHoraInicio),
  INDEX idx_reserva_usuario_inicio (usuarioId,fechaHoraInicio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE favoritos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuarioId INT UNSIGNED NOT NULL,
  productoId INT UNSIGNED NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_favorito_usuario FOREIGN KEY (usuarioId) REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_favorito_producto FOREIGN KEY (productoId) REFERENCES productos(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT uq_favorito_usuario_producto UNIQUE (usuarioId,productoId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
