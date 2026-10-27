-- ==========================================================
-- CONSOLIDATED ENTERPRISE SCHEMA FOR ECOROUTE LOGISTICS
-- Version: 2.0 (Consolidated February 2026)
-- ==========================================================

-- 1. INFRASTRUCTURE: Hubs/Warehouses
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

-- 2. RESOURCES: Drivers Management
CREATE TABLE drivers (
    id BIGSERIAL PRIMARY KEY,
    external_id VARCHAR(50) UNIQUE, 
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    license_number VARCHAR(50) NOT NULL UNIQUE,
    phone_number VARCHAR(20),
    email VARCHAR(100) UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. RESOURCES: Vehicles Management
CREATE TABLE vehicles (
    id BIGSERIAL PRIMARY KEY,
    plate_number VARCHAR(20) NOT NULL UNIQUE,
    model VARCHAR(100),
    brand VARCHAR(100),
    capacity_kg DECIMAL(10,2),
    capacity_m3 DECIMAL(10,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. CORE: Routes/Trips
CREATE TABLE routes (
    id BIGSERIAL PRIMARY KEY,
    driver_id BIGINT REFERENCES drivers(id),
    vehicle_id BIGINT REFERENCES vehicles(id),
    route_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'PLANNED', 
    estimated_start_time TIMESTAMP WITH TIME ZONE,
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    total_distance_km DECIMAL(10,2) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. CORE: Orders
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    tracking_number VARCHAR(100) NOT NULL UNIQUE,
    external_reference VARCHAR(100),
    route_id BIGINT REFERENCES routes(id),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    
    recipient_name VARCHAR(255) NOT NULL,
    recipient_phone VARCHAR(20),
    recipient_email VARCHAR(100),
    
    delivery_address TEXT NOT NULL,
    delivery_city VARCHAR(100),
    delivery_district VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    priority INTEGER DEFAULT 0,
    estimated_delivery_window_start TIMESTAMP WITH TIME ZONE,
    estimated_delivery_window_end TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. EVIDENCE: Delivery Proofs
CREATE TABLE delivery_proofs (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id) UNIQUE,
    image_url TEXT,
    signature_data_url TEXT,
    receiver_name VARCHAR(255),
    receiver_dni VARCHAR(20),
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8)
);

-- 7. TRACKING: GPS History
CREATE TABLE vehicle_gps_history (
    id BIGSERIAL PRIMARY KEY,
    vehicle_id BIGINT REFERENCES vehicles(id),
    driver_id BIGINT REFERENCES drivers(id),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    speed_kmh DECIMAL(10, 2),
    heading_degrees INTEGER,
    ping_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. PRODUCT MASTER DATA
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

-- 9. ORDER DETAILS
CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12, 2),
    total_price DECIMAL(12, 2)
);

-- 10. MAINTENANCE & FLEET OPS
CREATE TABLE vehicle_maintenance_logs (
    id BIGSERIAL PRIMARY KEY,
    vehicle_id BIGINT REFERENCES vehicles(id),
    service_date DATE NOT NULL,
    service_type VARCHAR(50),
    description TEXT,
    odometer_reading INTEGER,
    cost DECIMAL(12, 2),
    workshop_name VARCHAR(100),
    next_service_date DATE
);

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

-- 11. FINANCE & INCIDENTS
CREATE TABLE route_expenses (
    id BIGSERIAL PRIMARY KEY,
    route_id BIGINT REFERENCES routes(id),
    expense_type VARCHAR(50), 
    amount DECIMAL(10, 2),
    description TEXT,
    receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE incidents (
    id BIGSERIAL PRIMARY KEY,
    route_id BIGINT REFERENCES routes(id),
    incident_type VARCHAR(50), 
    severity VARCHAR(20), 
    description TEXT,
    location_lat DECIMAL(10, 8),
    location_lon DECIMAL(11, 8),
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- 12. HUMAN RESOURCES
CREATE TABLE driver_contracts (
    id BIGSERIAL PRIMARY KEY,
    driver_id BIGINT REFERENCES drivers(id) UNIQUE,
    contract_type VARCHAR(50),
    start_date DATE,
    end_date DATE,
    base_salary DECIMAL(12, 2)
);

CREATE TABLE driver_shifts (
    id BIGSERIAL PRIMARY KEY,
    driver_id BIGINT REFERENCES drivers(id),
    shift_start TIMESTAMP WITH TIME ZONE,
    shift_end TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20)
);

-- 13. AUDIT
CREATE TABLE order_status_history (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id),
    status VARCHAR(50) NOT NULL,
    reason TEXT,
    location_lat DECIMAL(10, 8),
    location_lon DECIMAL(11, 8),
    changed_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- INDEXES FOR SCALABILITY
-- ==========================================================
CREATE INDEX idx_orders_tracking ON orders(tracking_number);
CREATE INDEX idx_orders_route ON orders(route_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_gps_history_vehicle ON vehicle_gps_history(vehicle_id, ping_time DESC);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_incidents_route ON incidents(route_id);
CREATE INDEX idx_delivery_proofs_order ON delivery_proofs(order_id);

-- ==========================================================
-- COMMENTS
-- ==========================================================
COMMENT ON TABLE hubs IS 'Almacenes y centros de distribución.';
COMMENT ON TABLE fuel_logs IS 'Registro detallado de consumo de combustible por unidad.';
COMMENT ON TABLE routes IS 'Agrupación lógica de despachos diarios.';
