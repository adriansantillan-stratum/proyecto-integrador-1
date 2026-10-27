-- V5: Add Routes, GPS History and Expand Orders schema

-- 1. Create Routes table
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

-- 2. Expand Orders table to match Domain and Infrastructure entities
ALTER TABLE orders ADD COLUMN external_reference VARCHAR(100);
ALTER TABLE orders ADD COLUMN route_id BIGINT REFERENCES routes(id);
ALTER TABLE orders ADD COLUMN recipient_name VARCHAR(255);
ALTER TABLE orders ADD COLUMN recipient_phone VARCHAR(20);
ALTER TABLE orders ADD COLUMN recipient_email VARCHAR(100);
ALTER TABLE orders ADD COLUMN delivery_address TEXT;
ALTER TABLE orders ADD COLUMN delivery_city VARCHAR(100);
ALTER TABLE orders ADD COLUMN delivery_district VARCHAR(100);
ALTER TABLE orders ADD COLUMN latitude DECIMAL(10, 8);
ALTER TABLE orders ADD COLUMN longitude DECIMAL(11, 8);
ALTER TABLE orders ADD COLUMN priority INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN estimated_delivery_window_start TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN estimated_delivery_window_end TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE orders ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 3. Create GPS History table
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

-- 4. Create Order Status History for audit
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
