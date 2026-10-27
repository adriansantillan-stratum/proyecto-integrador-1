-- Limpiar data previa para evitar conflictos
DELETE FROM orders;
DELETE FROM routes;
DELETE FROM drivers;
DELETE FROM vehicles;

-- 1. Conductores
INSERT INTO drivers (id, external_id, first_name, last_name, license_number, phone_number, email)
VALUES 
(1, '8b631bcf-5de3-4630-ab58-60459cd1b3c6', 'Juan', 'Pérez', 'LIC-001', '999888777', 'conductor@ecoroute.com'),
(2, '195489f4-2aa8-4342-ae0b-88b5b5b6c73b', 'Carlos', 'Sainz', 'LIC-002', '987654321', 'carlos@ecoroute.com'),
(3, '3a5b6c7d-8e9f-4a1b-2c3d-4e5f6a7b8c9d', 'Maria', 'Lopez', 'LIC-003', '955444333', 'maria@ecoroute.com'),
(4, '4b5c6d7e-8f9a-0b1c-2d3e-4f5a6b7c8d9e', 'Pedro', 'Gomez', 'LIC-004', '922111000', 'pedro@ecoroute.com');

-- 2. Vehículos
INSERT INTO vehicles (id, plate_number, model, brand, capacity_kg, capacity_m3)
VALUES 
(1, 'ABC-123', 'N300', 'Chevrolet', 800.0, 5.0),
(2, 'XYZ-789', 'H-1', 'Hyundai', 1200.0, 8.0),
(3, 'DEF-456', 'Partner', 'Peugeot', 600.0, 4.0),
(4, 'GHI-789', 'Fiorino', 'Fiat', 500.0, 3.5);

-- 3. Rutas para HOY (fecha relativa al dia de ejecucion)
INSERT INTO routes (id, driver_id, vehicle_id, route_date, status)
VALUES 
(1, 1, 1, CURRENT_DATE, 'IN_PROGRESS'),
(2, 2, 2, CURRENT_DATE, 'PLANNED'),
(3, 3, 3, CURRENT_DATE, 'PLANNED'),
(4, 4, 4, CURRENT_DATE, 'PLANNED');

-- 4. Pedidos (3 por cada conductor en diferentes distritos)
INSERT INTO orders (tracking_number, route_id, status, recipient_name, delivery_address, latitude, longitude)
VALUES 
-- Ruta 1: Juan (Miraflores/Surco)
('TRK-J01', 1, 'IN_TRANSIT', 'Ana García', 'Calle Alcanfores 456, Miraflores', -12.1221, -77.0298),
('TRK-J02', 1, 'PENDING', 'Beto Ortiz', 'Av. Benavides 1234, Surco', -12.1290, -76.9920),
('TRK-J03', 1, 'PENDING', 'Carla Bruni', 'Jr. Batallón Callao 150, Surco', -12.1350, -76.9850),

-- Ruta 2: Carlos (San Isidro/Lince)
( 'TRK-C01', 2, 'PENDING', 'David Bisbal', 'Av. Javier Prado 1010, San Isidro', -12.0921, -77.0321),
( 'TRK-C02', 2, 'PENDING', 'Elena Rose', 'Calle Las Camelias 200, San Isidro', -12.0950, -77.0350),
( 'TRK-C03', 2, 'PENDING', 'Facundo Cabral', 'Av. Arequipa 2500, Lince', -12.0850, -77.0300),

-- Ruta 3: Maria (San Miguel/Magdalena)
( 'TRK-M01', 3, 'PENDING', 'Gaby Zambrano', 'Av. La Marina 1500, San Miguel', -12.0750, -77.0850),
( 'TRK-M02', 3, 'PENDING', 'Hugo Garcia', 'Jr. Libertad 450, Magdalena', -12.0900, -77.0700),
( 'TRK-M03', 3, 'PENDING', 'Iris Apfel', 'Av. Brasil 3800, Magdalena', -12.0880, -77.0650),

-- Ruta 4: Pedro (Los Olivos/SMP)
( 'TRK-P01', 4, 'PENDING', 'Jorge Luna', 'Av. Antúnez de Mayolo 800, Los Olivos', -11.9950, -77.0720),
( 'TRK-P02', 4, 'PENDING', 'Katia Palma', 'Av. Carlos Izaguirre 120, SMP', -12.0050, -77.0780),
( 'TRK-P03', 4, 'PENDING', 'Luis Advíncula', 'Calle Habich 300, SMP', -12.0150, -77.0550);
