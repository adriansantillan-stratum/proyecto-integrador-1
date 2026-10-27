-- V6: Enterprise Logistics Expansion
-- Este script añade robustez al sistema simulando una operación real completa.

-- 1. Gestión de Almacenes (Hubs/Warehouses)
CREATE TABLE hubs (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    address TEXT,
    city VARCHAR(50),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Catálogo de Productos (Master Data)
CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    unit_weight_kg DECIMAL(10, 2),
    unit_volume_m3 DECIMAL(10, 4),
    price DECIMAL(12, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Detalle de Pedidos (Order Line Items)
-- Permite saber qué productos componen cada orden
CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12, 2),
    total_price DECIMAL(12, 2)
);

-- 4. Gestión de Mantenimiento de Vehículos
CREATE TABLE vehicle_maintenance_logs (
    id BIGSERIAL PRIMARY KEY,
    vehicle_id BIGINT REFERENCES vehicles(id),
    service_date DATE NOT NULL,
    service_type VARCHAR(50), -- PREVENTIVE, CORRECTIVE, EMERGENCY
    description TEXT,
    odometer_reading INTEGER,
    cost DECIMAL(12, 2),
    workshop_name VARCHAR(100),
    next_service_date DATE
);

-- 5. Control de Combustible
CREATE TABLE fuel_logs (
    id BIGSERIAL PRIMARY KEY,
    vehicle_id BIGINT REFERENCES vehicles(id),
    driver_id BIGINT REFERENCES drivers(id),
    fuel_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    liters DECIMAL(10, 2),
    total_cost DECIMAL(12, 2),
    odometer_reading INTEGER,
    gas_station VARCHAR(100)
);

-- 6. Gastos de Ruta (Expenses)
-- Peajes, viáticos, multas, etc.
CREATE TABLE route_expenses (
    id BIGSERIAL PRIMARY KEY,
    route_id BIGINT REFERENCES routes(id),
    expense_type VARCHAR(50), -- TOLL, MEAL, FINE, PARKING
    amount DECIMAL(10, 2),
    description TEXT,
    receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Gestión de Incidentes
-- Accidentes, robos, retrasos mecánicos
CREATE TABLE incidents (
    id BIGSERIAL PRIMARY KEY,
    route_id BIGINT REFERENCES routes(id),
    incident_type VARCHAR(50), -- ACCIDENT, THEFT, BREAKDOWN, TRAFFIC
    severity VARCHAR(20), -- LOW, MEDIUM, HIGH, CRITICAL
    description TEXT,
    location_lat DECIMAL(10, 8),
    location_lon DECIMAL(11, 8),
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- 8. Recursos Humanos: Turnos y Contratos
CREATE TABLE driver_contracts (
    id BIGSERIAL PRIMARY KEY,
    driver_id BIGINT REFERENCES drivers(id) UNIQUE,
    contract_type VARCHAR(50), -- PERMANENT, TEMPORARY, OUTSOURCED
    start_date DATE,
    end_date DATE,
    base_salary DECIMAL(12, 2)
);

CREATE TABLE driver_shifts (
    id BIGSERIAL PRIMARY KEY,
    driver_id BIGINT REFERENCES drivers(id),
    shift_start TIMESTAMP WITH TIME ZONE,
    shift_end TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) -- CLOCKED_IN, CLOCKED_OUT, ON_BREAK
);

-- Índices para optimizar búsquedas masivas (Escalabilidad)
CREATE INDEX idx_orders_route ON orders(route_id);
CREATE INDEX idx_gps_history_vehicle ON vehicle_gps_history(vehicle_id, ping_time);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_incidents_route ON incidents(route_id);

COMMENT ON TABLE hubs IS 'Almacenes y centros de distribución.';
COMMENT ON TABLE fuel_logs IS 'Registro detallado de consumo de combustible por unidad y conductor.';
