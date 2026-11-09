-- PR5: ejecutar con la aplicación detenida y respaldo verificado.
-- Las comprobaciones se ejecutan antes de retirar columnas históricas.
DROP TEMPORARY TABLE IF EXISTS normalization_guard;
CREATE TEMPORARY TABLE normalization_guard (
  ok TINYINT NOT NULL,
  CONSTRAINT ck_normalization_guard CHECK (ok = 1)
);
INSERT INTO normalization_guard (ok)
SELECT IF(COUNT(*) = 0, 1, 0) FROM (
  SELECT categoria FROM negocios UNION ALL SELECT categoria FROM productos
) historicas
WHERE CHAR_LENGTH(TRIM(REGEXP_REPLACE(categoria, '[[:space:]]+', ' '))) = 0
   OR TRIM(REGEXP_REPLACE(categoria, '[[:space:]]+', ' ')) COLLATE utf8mb4_0900_ai_ci = 'Todas';

CREATE TABLE roles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(20) NOT NULL,
  descripcion VARCHAR(255) NULL,
  CONSTRAINT uq_rol_nombre UNIQUE (nombre),
  CONSTRAINT ck_rol_nombre CHECK (nombre IN ('Administrador', 'Comerciante', 'Comprador'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
INSERT INTO roles (nombre, descripcion) VALUES
('Administrador', 'Administración del marketplace'),
('Comerciante', 'Gestión de su comercio y productos'),
('Comprador', 'Consulta y selección de productos');

CREATE TABLE categorias (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL COLLATE utf8mb4_0900_ai_ci,
  descripcion VARCHAR(2000) NULL,
  estado VARCHAR(8) NOT NULL DEFAULT 'Activo',
  CONSTRAINT uq_categoria_nombre UNIQUE (nombre),
  CONSTRAINT ck_categoria_nombre CHECK (
    CHAR_LENGTH(nombre) > 0 AND nombre = TRIM(nombre)
    AND nombre NOT LIKE '%  %' AND nombre <> 'Todas'
    AND nombre NOT REGEXP '[[:cntrl:]]'
  ),
  CONSTRAINT ck_categoria_estado CHECK (estado IN ('Activo', 'Inactivo'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
INSERT INTO categorias (nombre, descripcion, estado) VALUES
('Alimentos', NULL, 'Activo'),
('Bebidas', NULL, 'Activo'),
('Restaurantes', NULL, 'Activo'),
('Café y panadería', NULL, 'Activo'),
('Ropa', NULL, 'Activo'),
('Calzado', NULL, 'Activo'),
('Accesorios', NULL, 'Activo'),
('Tecnología', NULL, 'Activo'),
('Hogar', NULL, 'Activo'),
('Belleza', NULL, 'Activo'),
('Salud y bienestar', NULL, 'Activo'),
('Deportes', NULL, 'Activo'),
('Mascotas', NULL, 'Activo'),
('Papelería', NULL, 'Activo'),
('Artesanías', NULL, 'Activo'),
('Ferretería', NULL, 'Activo'),
('Automotriz', NULL, 'Activo'),
('Educación', NULL, 'Activo'),
('Servicios', NULL, 'Activo'),
('Turismo', NULL, 'Activo'),
('Entretenimiento', NULL, 'Activo'),
('Agro', NULL, 'Activo'),
('Regalos', NULL, 'Activo'),
('Otro', NULL, 'Activo');
-- Catálogo conocido primero. Variantes históricas se agrupan sin cambiar otros datos.
INSERT INTO categorias (nombre)
SELECT MIN(h.nombre COLLATE utf8mb4_0900_as_cs)
FROM (
  SELECT TRIM(REGEXP_REPLACE(categoria, '[[:space:]]+', ' ')) AS nombre FROM negocios
  UNION ALL
  SELECT TRIM(REGEXP_REPLACE(categoria, '[[:space:]]+', ' ')) AS nombre FROM productos
) h
LEFT JOIN categorias c ON c.nombre = h.nombre COLLATE utf8mb4_0900_ai_ci
WHERE c.id IS NULL
GROUP BY h.nombre COLLATE utf8mb4_0900_ai_ci
ORDER BY MIN(h.nombre COLLATE utf8mb4_0900_as_cs);

ALTER TABLE usuarios ADD COLUMN rolId INT UNSIGNED NULL;
ALTER TABLE negocios
  ADD COLUMN categoriaId INT UNSIGNED NULL,
  ADD COLUMN descripcion VARCHAR(2000) NULL,
  ADD COLUMN municipio VARCHAR(80) NULL;
ALTER TABLE productos ADD COLUMN categoriaId INT UNSIGNED NULL;
UPDATE usuarios u JOIN roles r ON r.nombre = u.rol SET u.rolId = r.id;
UPDATE negocios n JOIN categorias c
  ON c.nombre = TRIM(REGEXP_REPLACE(n.categoria, '[[:space:]]+', ' ')) COLLATE utf8mb4_0900_ai_ci
  SET n.categoriaId = c.id;
UPDATE productos p JOIN categorias c
  ON c.nombre = TRIM(REGEXP_REPLACE(p.categoria, '[[:space:]]+', ' ')) COLLATE utf8mb4_0900_ai_ci
  SET p.categoriaId = c.id;
INSERT INTO normalization_guard (ok)
SELECT IF(COUNT(*) = 0, 1, 0) FROM usuarios u LEFT JOIN roles r ON r.id = u.rolId WHERE r.id IS NULL;
INSERT INTO normalization_guard (ok)
SELECT IF(COUNT(*) = 0, 1, 0) FROM negocios n LEFT JOIN categorias c ON c.id = n.categoriaId WHERE c.id IS NULL;
INSERT INTO normalization_guard (ok)
SELECT IF(COUNT(*) = 0, 1, 0) FROM productos p LEFT JOIN categorias c ON c.id = p.categoriaId WHERE c.id IS NULL;
INSERT INTO normalization_guard (ok)
SELECT IF(COUNT(*) = 0, 1, 0) FROM negocios n
LEFT JOIN usuarios u ON u.id = n.usuarioId LEFT JOIN roles r ON r.id = u.rolId
WHERE r.nombre IS NULL OR r.nombre <> 'Comerciante';

ALTER TABLE negocios
  DROP FOREIGN KEY fk_negocio_usuario,
  DROP CHECK ck_negocio_rol,
  DROP INDEX idx_negocio_estado_categoria,
  DROP COLUMN usuarioRol,
  DROP COLUMN categoria,
  MODIFY categoriaId INT UNSIGNED NOT NULL,
  ADD CONSTRAINT fk_negocio_propietario FOREIGN KEY (usuarioId) REFERENCES usuarios (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT fk_negocio_categoria FOREIGN KEY (categoriaId) REFERENCES categorias (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD INDEX idx_negocio_estado_categoria (estado, categoriaId);
ALTER TABLE usuarios
  DROP CHECK ck_usuario_rol,
  DROP INDEX uq_usuario_rol,
  DROP INDEX idx_usuario_rol_estado,
  DROP COLUMN rol,
  MODIFY rolId INT UNSIGNED NOT NULL,
  ADD CONSTRAINT fk_usuario_rol FOREIGN KEY (rolId) REFERENCES roles (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD INDEX idx_usuario_rol_estado (rolId, estado);
ALTER TABLE productos
  DROP INDEX idx_producto_estado_categoria,
  DROP COLUMN categoria,
  MODIFY categoriaId INT UNSIGNED NOT NULL,
  CHANGE COLUMN popularidad visitas INT UNSIGNED NOT NULL DEFAULT 0,
  ADD CONSTRAINT ck_producto_visitas CHECK (visitas >= 0),
  ADD CONSTRAINT fk_producto_categoria FOREIGN KEY (categoriaId) REFERENCES categorias (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD INDEX idx_producto_estado_categoria (estado, categoriaId);
DROP TEMPORARY TABLE normalization_guard;
