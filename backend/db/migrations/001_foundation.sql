-- =====================================================================
-- REACTIVA PEREIRA
-- MIGRACIÓN 001 - FUNDACIÓN DEL SISTEMA
--
-- Contiene las entidades principales:
-- Rol
-- Categoria
-- Usuario
-- Negocio
-- Producto
--
-- También incluye repository_lock, que es una tabla técnica utilizada
-- por el backend. No representa una entidad del modelo de negocio.
-- =====================================================================


-- =====================================================================
-- ROL
-- =====================================================================

CREATE TABLE rol (
    id_rol INT AUTO_INCREMENT PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL,
    descripcion VARCHAR(255),

    CONSTRAINT uq_rol_nombre
        UNIQUE (nombre_rol)
);


-- =====================================================================
-- CATEGORIA
-- =====================================================================

CREATE TABLE categoria (
    id_categoria INT AUTO_INCREMENT PRIMARY KEY,
    nombre_categoria VARCHAR(80) NOT NULL,
    descripcion VARCHAR(255),
    estado VARCHAR(20) NOT NULL DEFAULT 'Activo',

    CONSTRAINT uq_categoria_nombre
        UNIQUE (nombre_categoria),

    CONSTRAINT chk_categoria_estado
        CHECK (estado IN ('Activo', 'Inactivo'))
);


-- =====================================================================
-- USUARIO
-- =====================================================================

CREATE TABLE usuario (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    id_rol INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    correo VARCHAR(150) NOT NULL,
    telefono VARCHAR(20),
    contrasena_hash VARCHAR(255) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'Activo',
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_usuario_correo
        UNIQUE (correo),

    CONSTRAINT chk_usuario_estado
        CHECK (estado IN ('Activo', 'Inactivo')),

    CONSTRAINT fk_usuario_rol
        FOREIGN KEY (id_rol)
        REFERENCES rol(id_rol)
        ON DELETE RESTRICT
);


-- =====================================================================
-- NEGOCIO
-- =====================================================================

CREATE TABLE negocio (
    id_negocio INT AUTO_INCREMENT PRIMARY KEY,
    id_categoria INT NOT NULL,
    id_usuario INT NOT NULL,
    nombre_negocio VARCHAR(120) NOT NULL,
    descripcion TEXT,
    direccion_comercial VARCHAR(200) NOT NULL,
    municipio VARCHAR(80),
    telefono_contacto VARCHAR(20) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'Activo',
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_negocio_usuario
        UNIQUE (id_usuario),

    CONSTRAINT chk_negocio_estado
        CHECK (estado IN ('Activo', 'Inactivo')),

    CONSTRAINT fk_negocio_categoria
        FOREIGN KEY (id_categoria)
        REFERENCES categoria(id_categoria)
        ON DELETE RESTRICT,

    CONSTRAINT fk_negocio_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario)
        ON DELETE RESTRICT
);


-- =====================================================================
-- PRODUCTO
-- =====================================================================

CREATE TABLE producto (
    id_producto INT AUTO_INCREMENT PRIMARY KEY,
    id_negocio INT NOT NULL,
    id_categoria INT NOT NULL,
    nombre_producto VARCHAR(150) NOT NULL,
    descripcion TEXT NOT NULL,
    precio DECIMAL(12,2) NOT NULL,
    imagen MEDIUMTEXT,
    stock INT NOT NULL DEFAULT 0,
    visitas INT NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'Activo',

    CONSTRAINT chk_producto_precio
        CHECK (precio > 0),

    CONSTRAINT chk_producto_stock
        CHECK (stock >= 0),

    CONSTRAINT chk_producto_visitas
        CHECK (visitas >= 0),

    CONSTRAINT chk_producto_estado
        CHECK (estado IN ('Activo', 'Inactivo')),

    CONSTRAINT fk_producto_negocio
        FOREIGN KEY (id_negocio)
        REFERENCES negocio(id_negocio)
        ON DELETE RESTRICT,

    CONSTRAINT fk_producto_categoria
        FOREIGN KEY (id_categoria)
        REFERENCES categoria(id_categoria)
        ON DELETE RESTRICT
);


-- =====================================================================
-- REPOSITORY_LOCK
--
-- Tabla técnica.
--
-- No pertenece al DER.
-- El backend la utiliza actualmente para coordinar operaciones
-- transaccionales y evitar escrituras simultáneas problemáticas.
-- =====================================================================

CREATE TABLE repository_lock (
    id TINYINT PRIMARY KEY
);

INSERT INTO repository_lock (id)
VALUES (1);