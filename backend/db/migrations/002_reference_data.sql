-- =====================================================================
-- REACTIVA PEREIRA
-- MIGRACIÓN 002 - DATOS DE REFERENCIA
--
-- Esta migración carga los datos base que necesita la aplicación:
--
-- 1. Roles implementados actualmente.
-- 2. Categorías disponibles en el marketplace.
--
-- No contiene usuarios, negocios, productos ni datos de prueba.
-- =====================================================================


-- =====================================================================
-- ROLES
--
-- Estos son los tres roles implementados actualmente por el backend.
--
-- Los permisos reales NO dependen únicamente de esta tabla.
-- El backend también valida el rol antes de permitir cada operación.
-- =====================================================================

INSERT INTO rol (nombre_rol, descripcion)
VALUES

(
    'Administrador',
    'Administra usuarios y recursos de la plataforma'
),

(
    'Comerciante',
    'Gestiona su negocio, productos y servicios'
),

(
    'Comprador',
    'Consulta productos, realiza pedidos, reservas y favoritos'
);


-- =====================================================================
-- CATEGORÍAS
--
-- Catálogo inicial utilizado por negocios, productos y servicios.
--
-- Todas comienzan activas.
-- =====================================================================

INSERT INTO categoria
(nombre_categoria, descripcion, estado)
VALUES

(
    'Alimentos',
    'Productos alimenticios y de consumo',
    'Activo'
),

(
    'Bebidas',
    'Bebidas y productos relacionados',
    'Activo'
),

(
    'Restaurantes',
    'Comida preparada y establecimientos gastronómicos',
    'Activo'
),

(
    'Café y panadería',
    'Café, panadería, repostería y productos relacionados',
    'Activo'
),

(
    'Ropa',
    'Prendas de vestir',
    'Activo'
),

(
    'Calzado',
    'Zapatos y productos relacionados',
    'Activo'
),

(
    'Accesorios',
    'Accesorios personales y complementos',
    'Activo'
),

(
    'Tecnología',
    'Equipos, accesorios y productos tecnológicos',
    'Activo'
),

(
    'Hogar',
    'Productos para el hogar',
    'Activo'
),

(
    'Belleza',
    'Belleza, estética y cuidado personal',
    'Activo'
),

(
    'Salud y bienestar',
    'Productos y servicios relacionados con bienestar',
    'Activo'
),

(
    'Deportes',
    'Productos y servicios deportivos',
    'Activo'
),

(
    'Mascotas',
    'Productos y servicios para mascotas',
    'Activo'
),

(
    'Papelería',
    'Papelería, útiles y artículos de oficina',
    'Activo'
),

(
    'Artesanías',
    'Productos artesanales y hechos a mano',
    'Activo'
),

(
    'Ferretería',
    'Herramientas y productos de ferretería',
    'Activo'
),

(
    'Automotriz',
    'Productos y servicios para vehículos',
    'Activo'
),

(
    'Educación',
    'Productos y servicios educativos',
    'Activo'
),

(
    'Servicios',
    'Servicios profesionales y comerciales',
    'Activo'
),

(
    'Turismo',
    'Servicios y actividades turísticas',
    'Activo'
),

(
    'Entretenimiento',
    'Productos y servicios de entretenimiento',
    'Activo'
),

(
    'Agro',
    'Productos y servicios del sector agropecuario',
    'Activo'
),

(
    'Regalos',
    'Detalles, regalos y productos para ocasiones especiales',
    'Activo'
),

(
    'Otro',
    'Categoría para productos, servicios o negocios no clasificados',
    'Activo'
);