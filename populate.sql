-- 1. Hub inicial
INSERT INTO hubs (name, code, address, city, latitude, longitude) 
VALUES ('Hub Principal Lima', 'HUB-001', 'Av. Argentina 123', 'Lima', -12.046374, -77.042793);

-- 2. Conductores (ID 1 y 2)
INSERT INTO drivers (external_id, first_name, last_name, license_number, phone_number, email)
VALUES 
('8b631bcf-5de3-4630-ab58-60459cd1b3c6', 'Juan', 'Pérez', 'LIC-001', '999888777', 'conductor@ecoroute.com'),
('195489f4-2aa8-4342-ae0b-88b5b5b6c73b', 'Carlos', 'Sainz', 'LIC-002', '987654321', 'carlos@ecoroute.com');

-- 3. Vehículos
INSERT INTO vehicles (plate_number, model, brand, capacity_kg, capacity_m3)
VALUES 
('ABC-123', 'N300', 'Chevrolet', 800.0, 5.0),
('XYZ-789', 'H-1', 'Hyundai', 1200.0, 8.0);

-- 4. Rutas para HOY (24 de Marzo 2026)
INSERT INTO routes (driver_id, vehicle_id, route_date, status)
VALUES 
(1, 1, '2026-03-24', 'IN_PROGRESS'),
(2, 2, '2026-03-24', 'PLANNED');

-- 5. Pedidos para la Ruta 1 (Juan Pérez) - Ubicaciones en LIMA
INSERT INTO orders (tracking_number, route_id, status, recipient_name, delivery_address, latitude, longitude)
VALUES 
('TRK-001', 1, 'IN_TRANSIT', 'Ana García', 'Calle Alcanfores 456, Miraflores', -12.1221, -77.0298),
('TRK-002', 1, 'PENDING', 'Beto Ortiz', 'Av. Javier Prado Este 1234, San Isidro', -12.0921, -77.0321),
('TRK-003', 1, 'PENDING', 'Carla Bruni', 'Jr. Batallón Callao 150, Santiago de Surco', -12.1350, -76.9850);

-- 6. Pedidos para la Ruta 2 (Carlos Sainz)
INSERT INTO orders (tracking_number, route_id, status, recipient_name, delivery_address, latitude, longitude)
VALUES 
('TRK-004', 2, 'PENDING', 'David Bisbal', 'Av. Larco 789, Miraflores', -12.1250, -77.0310);
