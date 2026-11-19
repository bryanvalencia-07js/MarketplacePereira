-- =====================================================================
-- REACTIVA PEREIRA
-- MIGRACIÓN 004 - PEDIDOS Y DETALLE DE PEDIDOS
--
-- Esta migración agrega:
--
-- 1. Pedido
-- 2. Detalle_Pedido
--
-- Requiere que 001_foundation.sql ya haya creado:
-- usuario, negocio y producto.
-- =====================================================================


-- =====================================================================
-- PEDIDO
--
-- Un pedido pertenece a:
-- 1 usuario comprador
-- 1 negocio
--
-- Estados actuales:
-- Pendiente
-- Confirmado
-- Completado
-- Cancelado
-- =====================================================================

CREATE TABLE pedido (
    id_pedido INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_negocio INT NOT NULL,
    fecha_pedido DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
    observaciones VARCHAR(255),

    CONSTRAINT chk_pedido_estado
        CHECK (
            estado IN (
                'Pendiente',
                'Confirmado',
                'Completado',
                'Cancelado'
            )
        ),

    CONSTRAINT fk_pedido_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario)
        ON DELETE RESTRICT,

    CONSTRAINT fk_pedido_negocio
        FOREIGN KEY (id_negocio)
        REFERENCES negocio(id_negocio)
        ON DELETE RESTRICT
);


-- =====================================================================
-- DETALLE_PEDIDO
--
-- Representa los productos incluidos dentro de un pedido.
--
-- Cada fila guarda:
-- producto
-- cantidad
-- precio_unitario
--
-- precio_unitario conserva el precio del producto en el momento
-- en que se realizó el pedido.
-- =====================================================================

CREATE TABLE detalle_pedido (
    id_detalle INT AUTO_INCREMENT PRIMARY KEY,
    id_pedido INT NOT NULL,
    id_producto INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(12,2) NOT NULL,

    CONSTRAINT uq_detalle_pedido_producto
        UNIQUE (
            id_pedido,
            id_producto
        ),

    CONSTRAINT chk_detalle_cantidad
        CHECK (cantidad > 0),

    CONSTRAINT chk_detalle_precio
        CHECK (precio_unitario > 0),

    CONSTRAINT fk_detalle_pedido
        FOREIGN KEY (id_pedido)
        REFERENCES pedido(id_pedido)
        ON DELETE RESTRICT,

    CONSTRAINT fk_detalle_producto
        FOREIGN KEY (id_producto)
        REFERENCES producto(id_producto)
        ON DELETE RESTRICT
);