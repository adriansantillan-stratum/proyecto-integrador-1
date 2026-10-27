-- 1. Hub inicial
INSERT INTO hubs (name, code, address, city, latitude, longitude) 
VALUES ('Hub Principal Lima', 'HUB-001', 'Av. Argentina 123', 'Lima', -12.046374, -77.042793);

-- 2. Conductores (ID 1)
INSERT INTO drivers (external_id, first_name, last_name, license_number, phone_number, email)
VALUES ('8b631bcf-5de3-4630-ab58-60459cd1b3c6', 'Juan', 'Pérez', 'LIC-001', '999888777', 'conductor@ecoroute.com');

-- 3. Vehículos
INSERT INTO vehicles (plate_number, model, brand, capacity_kg, capacity_m3)
VALUES ('ABC-123', 'N300', 'Chevrolet', 800.0, 5.0);

-- 4. Rutas para HOY (fecha relativa: siempre el día en que se ejecuta el seed)
INSERT INTO routes (driver_id, vehicle_id, route_date, status)
VALUES (1, 1, CURRENT_DATE, 'IN_PROGRESS');

-- 5. Pedidos para la Ruta 1 (Ubicaciones en LIMA)
-- Aseguramos que tengan coordenadas correctas para que la polilínea se vea
INSERT INTO orders (tracking_number, route_id, status, recipient_name, delivery_address, latitude, longitude)
VALUES 
('TRK-001', 1, 'IN_TRANSIT', 'Ana García', 'Calle Alcanfores 456, Miraflores', -12.1221, -77.0298),
('TRK-002', 1, 'PENDING', 'Beto Ortiz', 'Av. Javier Prado Este 1234, San Isidro', -12.0921, -77.0321),
('TRK-003', 1, 'PENDING', 'Carla Bruni', 'Jr. Batallón Callao 150, Santiago de Surco', -12.1350, -76.9850);
