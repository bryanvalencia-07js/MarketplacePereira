-- =====================================================================
-- REACTIVA PEREIRA
-- MIGRACIÓN 003 - SERVICIOS, RESERVAS Y FAVORITOS
--
-- Esta migración agrega:
--
-- 1. Servicio
-- 2. Horario_Servicio
-- 3. Reserva
-- 4. Favorito
--
-- Requiere que 001_foundation.sql ya haya creado:
-- usuario, negocio, categoria y producto.
-- =====================================================================


-- =====================================================================
-- SERVICIO
-- =====================================================================

CREATE TABLE servicio (
    id_servicio INT AUTO_INCREMENT PRIMARY KEY,
    id_negocio INT NOT NULL,
    id_categoria INT NOT NULL,
    nombre_servicio VARCHAR(150) NOT NULL,
    descripcion TEXT NOT NULL,
    precio_referencia DECIMAL(12,2) NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'Activo',
    duracion_minutos INT NOT NULL,
    capacidad_simultanea INT NOT NULL DEFAULT 1,

    CONSTRAINT chk_servicio_precio
        CHECK (precio_referencia >= 0),

    CONSTRAINT chk_servicio_estado
        CHECK (estado IN ('Activo', 'Inactivo')),

    CONSTRAINT chk_servicio_duracion
        CHECK (duracion_minutos > 0),

    CONSTRAINT chk_servicio_capacidad
        CHECK (capacidad_simultanea >= 1),

    CONSTRAINT fk_servicio_negocio
        FOREIGN KEY (id_negocio)
        REFERENCES negocio(id_negocio)
        ON DELETE RESTRICT,

    CONSTRAINT fk_servicio_categoria
        FOREIGN KEY (id_categoria)
        REFERENCES categoria(id_categoria)
        ON DELETE RESTRICT
);


-- =====================================================================
-- HORARIO_SERVICIO
--
-- dia_semana:
-- 1 = Lunes
-- 2 = Martes
-- 3 = Miércoles
-- 4 = Jueves
-- 5 = Viernes
-- 6 = Sábado
-- 7 = Domingo
-- =====================================================================

CREATE TABLE horario_servicio (
    id_horario INT AUTO_INCREMENT PRIMARY KEY,
    id_servicio INT NOT NULL,
    dia_semana TINYINT NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,

    CONSTRAINT uq_horario_servicio
        UNIQUE (
            id_servicio,
            dia_semana,
            hora_inicio
        ),

    CONSTRAINT chk_horario_dia
        CHECK (dia_semana BETWEEN 1 AND 7),

    CONSTRAINT chk_horario_horas
        CHECK (hora_inicio < hora_fin),

    CONSTRAINT fk_horario_servicio
        FOREIGN KEY (id_servicio)
        REFERENCES servicio(id_servicio)
        ON DELETE CASCADE
);


-- =====================================================================
-- RESERVA
--
-- Una reserva pertenece a:
-- 1 usuario
-- 1 servicio
--
-- Estados actuales:
-- Confirmada
-- Cancelada
-- =====================================================================

CREATE TABLE reserva (
    id_reserva INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_servicio INT NOT NULL,
    fecha_hora_inicio DATETIME NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'Confirmada',
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_reserva_usuario_servicio
        UNIQUE (
            id_usuario,
            id_servicio,
            fecha_hora_inicio
        ),

    CONSTRAINT chk_reserva_estado
        CHECK (
            estado IN (
                'Confirmada',
                'Cancelada'
            )
        ),

    CONSTRAINT fk_reserva_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario)
        ON DELETE RESTRICT,

    CONSTRAINT fk_reserva_servicio
        FOREIGN KEY (id_servicio)
        REFERENCES servicio(id_servicio)
        ON DELETE RESTRICT
);


-- =====================================================================
-- FAVORITO
--
-- Favorito representa la relación muchos a muchos:
--
-- Usuario N:M Producto
--
-- Un usuario no puede guardar el mismo producto dos veces.
-- =====================================================================

CREATE TABLE favorito (
    id_favorito INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_producto INT NOT NULL,
    fecha_agregado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_favorito_usuario_producto
        UNIQUE (
            id_usuario,
            id_producto
        ),

    CONSTRAINT fk_favorito_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario)
        ON DELETE CASCADE,

    CONSTRAINT fk_favorito_producto
        FOREIGN KEY (id_producto)
        REFERENCES producto(id_producto)
        ON DELETE CASCADE
);