-- ECOROUTE complete application schema V1 to V16. PostgreSQL 14+.
-- ONLY for an EMPTY public schema. Prefer Flyway for the existing application.
-- Fifteen existing migration files: V1-V10,V12-V16. No V11 source exists.
-- Preserves original DDL and technical RBAC configuration; V4 synthetic business seeds omitted.
-- No business rows, operational exports, Keycloak, passwords or Flyway migration history.
-- V16 adds a GPS-quality FUNCTION, its permissions/comments and a replacement read VIEW only.
-- Business tables, columns and FKs are unchanged by V16; no business ERD redesign is required.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public')
       OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public')
       OR EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public') THEN
        RAISE EXCEPTION 'Database must be empty; public schema contains objects; use Flyway on existing database';
    END IF;
END $$;

-- V1__create_orders_table.sql
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    tracking_number VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    driver_id BIGINT
);

-- V2__create_additional_tables.sql
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

CREATE TABLE delivery_proofs (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE,
    image_url TEXT,
    signature_data_url TEXT,
    receiver_name VARCHAR(255),
    receiver_dni VARCHAR(20),
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    FOREIGN KEY (order_id) REFERENCES orders(id)
);


-- V3__create_rbac_tables.sql
-- V3: RBAC Schema and Data Seeding

-- 1. Modules
CREATE TABLE auth_module (
    module_id BIGSERIAL PRIMARY KEY,
    module_name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Resources
CREATE TABLE auth_resource (
    resource_id BIGSERIAL PRIMARY KEY,
    resource_name VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    module_id BIGINT NOT NULL REFERENCES auth_module(module_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(module_id, resource_name)
);

-- 3. Actions
CREATE TABLE auth_action (
    action_id BIGSERIAL PRIMARY KEY,
    action_name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Roles
CREATE TABLE auth_role (
    role_id BIGSERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    country_code VARCHAR(5) DEFAULT 'PE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(country_code, role_name)
);

-- 5. Permissions (Association Table)
CREATE TABLE auth_permission (
    permission_id BIGSERIAL PRIMARY KEY,
    role_id BIGINT NOT NULL REFERENCES auth_role(role_id),
    resource_id BIGINT NOT NULL REFERENCES auth_resource(resource_id),
    action_id BIGINT NOT NULL REFERENCES auth_action(action_id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, resource_id, action_id)
);

-- 6. User-Role Assignment (Linking Keycloak Users to Local Roles)
CREATE TABLE auth_user_role (
    id BIGSERIAL PRIMARY KEY,
    user_external_id VARCHAR(50) NOT NULL, -- Keycloak UUID
    role_id BIGINT NOT NULL REFERENCES auth_role(role_id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_external_id, role_id)
);

-- =============================================================================
-- SEED DATA (Initial Configuration)
-- =============================================================================

-- Modules
INSERT INTO auth_module (module_name, description) VALUES 
('SEGURIDAD', 'Gestión de Identidad y Accesos'),
('OPERACIONES', 'Gestión Logística y Despacho'),
('REPORTES', 'Inteligencia de Negocios');

-- Resources
INSERT INTO auth_resource (resource_name, description, module_id) VALUES 
('USERS', 'Gestión de Usuarios', (SELECT module_id FROM auth_module WHERE module_name = 'SEGURIDAD')),
('ROLES', 'Gestión de Roles', (SELECT module_id FROM auth_module WHERE module_name = 'SEGURIDAD')),
('ORDERS', 'Gestión de Pedidos', (SELECT module_id FROM auth_module WHERE module_name = 'OPERACIONES')),
('ROUTES', 'Gestión de Rutas', (SELECT module_id FROM auth_module WHERE module_name = 'OPERACIONES')),
('DASHBOARD', 'Visualización de Métricas', (SELECT module_id FROM auth_module WHERE module_name = 'REPORTES'));

-- Actions
INSERT INTO auth_action (action_name, description) VALUES 
('CREATE', 'Crear registros'),
('READ', 'Consultar información'),
('UPDATE', 'Modificar registros'),
('DELETE', 'Eliminar registros'),
('EXPORT', 'Exportar datos'),
('APPROVE', 'Aprobar transacciones');

-- Roles
INSERT INTO auth_role (role_name, description) VALUES 
('ADMIN', 'Administrador del Sistema'),
('DRIVER', 'Conductor'),
('DISPATCHER', 'Despachador/Operador Logístico');

-- Permissions Seeding (Example: Admin has full access)
INSERT INTO auth_permission (role_id, resource_id, action_id)
SELECT r.role_id, res.resource_id, a.action_id
FROM auth_role r
CROSS JOIN auth_resource res
CROSS JOIN auth_action a
WHERE r.role_name = 'ADMIN';

-- Permissions for Driver (Read Routes, Update Orders status)
INSERT INTO auth_permission (role_id, resource_id, action_id)
SELECT r.role_id, res.resource_id, a.action_id
FROM auth_role r
JOIN auth_resource res ON res.resource_name IN ('ROUTES', 'ORDERS')
JOIN auth_action a ON a.action_name IN ('READ', 'UPDATE')
WHERE r.role_name = 'DRIVER';


-- V4__corporate_erp_schema.sql
-- =============================================================================
-- CORPORATE LOGISTICS DATABASE SCHEMA (ERP-LEVEL)
-- This schema represents the broader enterprise context of "TransLogística Express S.A.C."
-- Our microservice (EcoRoute) focus is on 'Last Mile Delivery' and 'Real-time Tracking'.
-- =============================================================================

-- 1. ORGANIZATIONAL STRUCTURE
CREATE TABLE IF NOT EXISTS corp_branches (
    branch_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address TEXT,
    city VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS corp_departments (
    dept_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    branch_id BIGINT REFERENCES corp_branches(branch_id)
);

-- 2. HUMAN RESOURCES (Broader than just Drivers)
CREATE TABLE IF NOT EXISTS corp_employees (
    emp_id BIGSERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    dni VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    hire_date DATE,
    dept_id BIGINT REFERENCES corp_departments(dept_id),
    salary DECIMAL(12,2),
    status VARCHAR(20) DEFAULT 'ACTIVE' -- ACTIVE, ON_LEAVE, TERMINATED
);

-- 3. FLEET ASSET MANAGEMENT (Broader than just active vehicles)
CREATE TABLE IF NOT EXISTS corp_fleet_types (
    type_id BIGSERIAL PRIMARY KEY,
    category VARCHAR(50), -- TRUCK, VAN, MOTORCYCLE
    description TEXT
);

CREATE TABLE IF NOT EXISTS corp_maintenance_logs (
    log_id BIGSERIAL PRIMARY KEY,
    vehicle_id BIGINT, -- Linked to our 'vehicles' table via ID
    maintenance_date DATE NOT NULL,
    description TEXT,
    cost DECIMAL(10,2),
    provider_name VARCHAR(100)
);

-- 4. CUSTOMER RELATIONSHIP MANAGEMENT (CRM)
CREATE TABLE IF NOT EXISTS corp_customers (
    customer_id BIGSERIAL PRIMARY KEY,
    company_name VARCHAR(200) NOT NULL,
    ruc VARCHAR(20) UNIQUE NOT NULL,
    contact_person VARCHAR(100),
    contact_email VARCHAR(100),
    billing_address TEXT,
    segment VARCHAR(50), -- RETAIL, INDUSTRIAL, E-COMMERCE
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. CONTRACTS AND PRICING
CREATE TABLE IF NOT EXISTS corp_contracts (
    contract_id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT REFERENCES corp_customers(customer_id),
    start_date DATE,
    end_date DATE,
    pricing_model VARCHAR(50), -- PER_KG, PER_KM, FIXED_FEE
    is_active BOOLEAN DEFAULT TRUE
);

-- 6. WAREHOUSE AND INVENTORY (Supporting Transit)
CREATE TABLE IF NOT EXISTS corp_warehouses (
    warehouse_id BIGSERIAL PRIMARY KEY,
    branch_id BIGINT REFERENCES corp_branches(branch_id),
    total_capacity_m3 DECIMAL(12,2),
    security_level INTEGER
);

-- 7. FINANCE AND BILLING
CREATE TABLE IF NOT EXISTS corp_invoices (
    invoice_id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT REFERENCES corp_customers(customer_id),
    invoice_number VARCHAR(50) UNIQUE,
    amount DECIMAL(15,2),
    tax DECIMAL(15,2),
    issue_date DATE,
    due_date DATE,
    payment_status VARCHAR(20) DEFAULT 'PENDING'
);

-- Original V4 corporate business sample INSERTs intentionally omitted from this installer.


-- V5__fix_schema_and_add_routes.sql
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


-- V6__enterprise_logistics_expansion.sql
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


-- V7__feature_expansion.sql
-- Purchases table for procurement tracking
CREATE TABLE IF NOT EXISTS purchases (
    id BIGSERIAL PRIMARY KEY,
    description VARCHAR(500) NOT NULL,
    supplier VARCHAR(255) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    category VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table for in-app notifications
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    order_id BIGINT REFERENCES orders(id),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for pagination performance
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status, created_at DESC);


-- V8__route_geometry_and_stop_sequence.sql
-- Camino real por calles (WS3): geometría del recorrido, duración estimada
-- y orden de visita de cada pedido calculados por el motor de ruteo (OSRM).

ALTER TABLE routes ADD COLUMN IF NOT EXISTS geometry TEXT;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS total_duration_min DOUBLE PRECISION;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS stop_sequence INT;


-- V9__operational_integrity.sql
-- Concurrency guarantees for resource reservations. Existing records are preserved.
CREATE UNIQUE INDEX uq_routes_active_driver_day ON routes(driver_id,route_date)
    WHERE status IN ('PLANNED','IN_PROGRESS');
CREATE UNIQUE INDEX uq_routes_active_vehicle_day ON routes(vehicle_id,route_date)
    WHERE status IN ('PLANNED','IN_PROGRESS');
ALTER TABLE delivery_proofs ADD COLUMN image_sha256 VARCHAR(64);
ALTER TABLE delivery_proofs ADD COLUMN signature_sha256 VARCHAR(64);
ALTER TABLE delivery_proofs ADD COLUMN received_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE delivery_proofs ADD COLUMN captured_at TIMESTAMPTZ;
CREATE TABLE delivery_outbox (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    event_type VARCHAR(50) NOT NULL DEFAULT 'DELIVERY_CONFIRMED',
    payload TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error VARCHAR(300),
    UNIQUE(order_id,event_type)
);
CREATE UNIQUE INDEX uq_delivery_notification ON notifications(order_id,type)
    WHERE type='DELIVERY_CONFIRMED';
CREATE INDEX idx_outbox_pending ON delivery_outbox(created_at) WHERE sent_at IS NULL;
COMMENT ON TABLE delivery_outbox IS 'Eventos de entrega escritos en la misma transacción que la prueba y publicados con reintento.';


-- V10__business_workflow.sql
CREATE TABLE order_business_data (
 order_id BIGINT PRIMARY KEY REFERENCES orders(id),
 recipient_ruc VARCHAR(11) CHECK(recipient_ruc IS NULL OR recipient_ruc ~ '^[0-9]{11}$'),
 customer_accepted BOOLEAN NOT NULL DEFAULT FALSE,
 address_verified BOOLEAN NOT NULL DEFAULT FALSE,
 coverage_verified BOOLEAN NOT NULL DEFAULT FALSE,
 agreement_note TEXT NOT NULL,
 confirmed_by VARCHAR(100) NOT NULL,
 confirmed_at TIMESTAMPTZ
);
CREATE TABLE route_dispatch_reviews (
 route_id BIGINT PRIMARY KEY REFERENCES routes(id),
 load_weight_kg NUMERIC(12,2) NOT NULL CHECK(load_weight_kg>0),
 approved_by VARCHAR(100) NOT NULL,
 approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 accepted_by VARCHAR(100),accepted_at TIMESTAMPTZ,note TEXT NOT NULL
);
ALTER TABLE incidents ADD COLUMN order_id BIGINT REFERENCES orders(id);
ALTER TABLE incidents ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'OPEN';
ALTER TABLE incidents ADD COLUMN outcome VARCHAR(30);
ALTER TABLE incidents ADD COLUMN resolution_reason TEXT;
ALTER TABLE incidents ADD COLUMN resolved_by VARCHAR(100);
ALTER TABLE incidents ADD COLUMN reported_by VARCHAR(100);
CREATE UNIQUE INDEX uq_open_incident_order ON incidents(order_id) WHERE order_id IS NOT NULL AND status='OPEN';
CREATE TABLE order_attempts (
 id BIGSERIAL PRIMARY KEY,
 original_order_id BIGINT NOT NULL REFERENCES orders(id),
 retry_order_id BIGINT NOT NULL UNIQUE REFERENCES orders(id),
 incident_id BIGINT NOT NULL UNIQUE REFERENCES incidents(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE improvement_actions (
 id BIGSERIAL PRIMARY KEY,title VARCHAR(255) NOT NULL,cause TEXT NOT NULL,
 owner_name VARCHAR(150) NOT NULL,due_date DATE NOT NULL,metric_code VARCHAR(30) NOT NULL,
 baseline_value NUMERIC(14,4),target_value NUMERIC(14,4),result_value NUMERIC(14,4),
 status VARCHAR(30) NOT NULL DEFAULT 'OPEN',note TEXT,
 created_by VARCHAR(100) NOT NULL,verified_by VARCHAR(100),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE business_audit_events (
 id BIGSERIAL PRIMARY KEY,process_id VARCHAR(10) NOT NULL,entity_type VARCHAR(40) NOT NULL,
 entity_id BIGINT NOT NULL,action VARCHAR(80) NOT NULL,actor VARCHAR(100) NOT NULL,
 details TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_business_audit_entity ON business_audit_events(entity_type,entity_id,created_at);
COMMENT ON COLUMN order_business_data.customer_accepted IS 'Declaración del operador sobre la aceptación del cliente; no es firma certificada del cliente.';
COMMENT ON TABLE order_attempts IS 'Un reintento crea un pedido nuevo vinculado; nunca modifica el resultado histórico original.';


-- V12__analytics_views.sql
-- H08/H09/H18. Depends on V9 POD metadata and V10 order_business_data / incidents.
-- Read models preserve operational dates; no UTC day truncation or synthetic targets.
CREATE VIEW analytics_order_facts AS
WITH facts AS (
    SELECT o.id AS order_id, o.tracking_number, o.external_reference, o.status,
           o.route_id, COALESCE(r.driver_id, o.driver_id) AS driver_id,
           COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', d.first_name, d.last_name)), ''), 'Sin conductor') AS driver_name,
           COALESCE(r.route_date, (o.created_at AT TIME ZONE 'America/Lima')::date) AS operation_date,
           COALESCE(NULLIF(BTRIM(o.delivery_district), ''), 'Sin distrito') AS district,
           o.recipient_name, o.delivery_address, o.latitude, o.longitude,
           o.created_at, o.updated_at, o.estimated_delivery_window_start, o.estimated_delivery_window_end,
           b.recipient_ruc, b.customer_accepted, b.address_verified, b.coverage_verified,
           b.agreement_note, b.confirmed_by, b.confirmed_at,
           dp.id AS proof_id, dp.image_url, dp.signature_data_url,
           dp.receiver_name, dp.receiver_dni, dp.latitude AS proof_latitude, dp.longitude AS proof_longitude,
           dp.verified_at, dp.captured_at, dp.received_at, dp.image_sha256, dp.signature_sha256,
           COALESCE(b.recipient_ruc ~ '^[0-9]{11}$', FALSE) AS valid_ruc,
           COALESCE(o.latitude BETWEEN -90 AND 90 AND o.latitude <> 0
                    AND o.longitude BETWEEN -180 AND 180 AND o.longitude <> 0, FALSE) AS valid_gps,
           (NULLIF(BTRIM(dp.image_url), '') IS NOT NULL) AS has_photo,
           (NULLIF(BTRIM(dp.signature_data_url), '') IS NOT NULL) AS has_signature,
           (o.route_id IS NOT NULL) AS scheduled,
           (o.status = 'DELIVERED') AS delivered
    FROM orders o
    LEFT JOIN routes r ON r.id = o.route_id
    LEFT JOIN drivers d ON d.id = COALESCE(r.driver_id, o.driver_id)
    LEFT JOIN order_business_data b ON b.order_id = o.id
    LEFT JOIN delivery_proofs dp ON dp.order_id = o.id
)
SELECT facts.*,
       (valid_ruc AND valid_gps AND NULLIF(BTRIM(recipient_name), '') IS NOT NULL
        AND NULLIF(BTRIM(delivery_address), '') IS NOT NULL) AS iid_valid,
       (has_photo OR has_signature) AS digital_evidence,
       (delivered AND verified_at IS NOT NULL AND estimated_delivery_window_end IS NOT NULL) AS ontime_evaluable,
       COALESCE(delivered AND verified_at <= estimated_delivery_window_end, FALSE) AS on_time,
       COALESCE(delivered AND verified_at > estimated_delivery_window_end, FALSE) AS delayed,
       COALESCE(has_photo AND has_signature AND NULLIF(BTRIM(receiver_name), '') IS NOT NULL
          AND receiver_dni ~ '^[0-9]{8}$'
          AND proof_latitude BETWEEN -90 AND 90 AND proof_latitude <> 0
          AND proof_longitude BETWEEN -180 AND 180 AND proof_longitude <> 0
          AND image_sha256 ~ '^[0-9a-fA-F]{64}$' AND signature_sha256 ~ '^[0-9a-fA-F]{64}$'
          AND captured_at IS NOT NULL AND received_at IS NOT NULL, FALSE) AS complete_pod
FROM facts;

CREATE VIEW analytics_route_facts AS
WITH route_orders AS (
    SELECT route_id, COUNT(*) AS order_count,
           COUNT(*) FILTER (WHERE status = 'DELIVERED') AS delivered_count,
           COUNT(*) FILTER (WHERE status IN ('DELIVERED', 'FAILED')) AS terminal_stop_count
    FROM orders WHERE route_id IS NOT NULL GROUP BY route_id
), gps_points AS (
    SELECT r.id AS route_id, g.vehicle_id, g.latitude::double precision AS lat,
           g.longitude::double precision AS lon, g.ping_time,
           LAG(g.latitude::double precision) OVER w AS prev_lat,
           LAG(g.longitude::double precision) OVER w AS prev_lon
    FROM routes r JOIN vehicle_gps_history g ON g.vehicle_id = r.vehicle_id
       AND r.actual_start_time IS NOT NULL
       AND g.ping_time >= r.actual_start_time
       AND g.ping_time <= COALESCE(r.actual_end_time, CURRENT_TIMESTAMP)
       AND (r.actual_end_time IS NOT NULL OR r.status = 'IN_PROGRESS')
    WHERE g.latitude BETWEEN -90 AND 90 AND g.latitude <> 0
      AND g.longitude BETWEEN -180 AND 180 AND g.longitude <> 0
    WINDOW w AS (PARTITION BY r.id, g.vehicle_id ORDER BY g.ping_time, g.id)
), gps_distance AS (
    SELECT route_id, COUNT(*) AS gps_sample_count, MIN(ping_time) AS first_gps_at, MAX(ping_time) AS last_gps_at,
           CASE WHEN COUNT(*) >= 2 THEN SUM(
               CASE WHEN prev_lat IS NOT NULL THEN 2 * 6371.0088 * ASIN(SQRT(LEAST(1.0, GREATEST(0.0,
                 POWER(SIN(RADIANS(lat-prev_lat)/2),2)
                 + COS(RADIANS(prev_lat))*COS(RADIANS(lat))*POWER(SIN(RADIANS(lon-prev_lon)/2),2)
               )))) ELSE 0 END) END AS actual_gps_distance_km
    FROM gps_points GROUP BY route_id
), route_facts AS (
    SELECT r.id AS route_id, 'Ruta ' || r.id AS label, r.driver_id, r.vehicle_id,
           r.route_date AS operation_date, r.status, r.actual_start_time, r.actual_end_time,
           r.total_distance_km::double precision AS planned_distance_km,
           r.total_duration_min AS planned_duration_min,
           COALESCE(o.order_count, 0)::bigint AS order_count,
           COALESCE(o.delivered_count, 0)::bigint AS delivered_count,
           COALESCE(o.terminal_stop_count, 0)::bigint AS terminal_stop_count,
           COALESCE(g.gps_sample_count, 0)::bigint AS gps_sample_count,
           g.first_gps_at, g.last_gps_at, g.actual_gps_distance_km,
           CASE WHEN r.actual_start_time IS NOT NULL AND r.actual_end_time >= r.actual_start_time
                THEN EXTRACT(EPOCH FROM (r.actual_end_time-r.actual_start_time))::double precision/60 END AS operation_minutes
    FROM routes r LEFT JOIN route_orders o ON o.route_id = r.id LEFT JOIN gps_distance g ON g.route_id = r.id
)
SELECT route_facts.*,
       actual_gps_distance_km / NULLIF(delivered_count, 0) AS km_per_delivery,
       operation_minutes / NULLIF(terminal_stop_count, 0) AS time_per_stop_min,
       CASE WHEN actual_gps_distance_km IS NULL THEN 'UNAVAILABLE' ELSE 'GPS_HAVERSINE' END AS distance_source
FROM route_facts;

CREATE TABLE analytics_goals (
    code VARCHAR(10) PRIMARY KEY CHECK (code IN ('IID','CHR','TDE','SUCCESS','ONTIME')),
    target NUMERIC CHECK (target >= 0 AND target <= 100),
    updated_by VARCHAR(100) NOT NULL CHECK (BTRIM(updated_by) <> ''),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE analytics_goal_history (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(10) NOT NULL REFERENCES analytics_goals(code),
    previous_target NUMERIC,
    target NUMERIC,
    changed_by VARCHAR(100) NOT NULL,
    effective_at TIMESTAMPTZ NOT NULL
);
CREATE FUNCTION analytics_stamp_goal() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := clock_timestamp();
    RETURN NEW;
END;
$$;
CREATE TRIGGER analytics_goal_stamp_trigger BEFORE INSERT OR UPDATE ON analytics_goals
FOR EACH ROW EXECUTE FUNCTION analytics_stamp_goal();
-- AFTER permits the history FK to reference a newly inserted goal.
CREATE FUNCTION analytics_record_goal() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO analytics_goal_history(code, previous_target, target, changed_by, effective_at)
    VALUES (NEW.code, CASE WHEN TG_OP = 'UPDATE' THEN OLD.target ELSE NULL END,
            NEW.target, NEW.updated_by, NEW.updated_at);
    RETURN NEW;
END;
$$;
CREATE TRIGGER analytics_goal_history_trigger AFTER INSERT OR UPDATE ON analytics_goals
FOR EACH ROW EXECUTE FUNCTION analytics_record_goal();
CREATE FUNCTION analytics_protect_goal_history() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'El historial de metas es inmutable';
END;
$$;
CREATE TRIGGER analytics_goal_history_immutable BEFORE UPDATE OR DELETE ON analytics_goal_history
FOR EACH ROW EXECUTE FUNCTION analytics_protect_goal_history();

CREATE VIEW analytics_goal_facts AS
SELECT c.code, g.target, g.updated_by, g.updated_at
FROM (VALUES ('IID'),('CHR'),('TDE'),('SUCCESS'),('ONTIME')) AS c(code)
LEFT JOIN analytics_goals g ON g.code = c.code;
CREATE VIEW analytics_goal_history_facts AS SELECT * FROM analytics_goal_history;

COMMENT ON VIEW analytics_order_facts IS 'RF81: datos verificables de pedido, operación Lima, RUC P01, evidencia digital y metadatos de integridad. No verifica objetos remotos.';
COMMENT ON VIEW analytics_route_facts IS 'Distancia GPS Haversine dentro de la ruta; mínimo 2 muestras. Minutos de operación por parada terminal DELIVERED/FAILED, no tiempo de servicio.';
COMMENT ON TABLE analytics_goal_history IS 'Historial de metas efectivas, actor autenticado y fecha. Sin metas precargadas.';

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ecoroute_bi_reader') THEN
        CREATE ROLE ecoroute_bi_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
    END IF;
END $$;
GRANT USAGE ON SCHEMA public TO ecoroute_bi_reader;
GRANT SELECT ON analytics_order_facts, analytics_route_facts, analytics_goal_facts,
                analytics_goal_history_facts TO ecoroute_bi_reader;


-- V13__incident_resolution.sql
ALTER TABLE incidents ADD COLUMN next_route_id BIGINT REFERENCES routes(id);
ALTER TABLE incidents ADD COLUMN retry_order_id BIGINT REFERENCES orders(id);
-- Preserve legacy closures without attributing them to a fictitious current user.
UPDATE incidents SET status='RESOLVED',outcome='CLOSE_CASE',
    resolution_reason='Cierre histórico anterior a la auditoría de resolución',resolved_by='LEGACY_UNATTRIBUTED'
    WHERE resolved_at IS NOT NULL;
ALTER TABLE incidents ADD CONSTRAINT ck_incident_resolution CHECK (
    (status='OPEN' AND resolved_at IS NULL) OR
    (status='RESOLVED' AND outcome IN ('RETRY','REPLAN','CLOSE_FAILED','CLOSE_CASE')
        AND resolution_reason IS NOT NULL AND resolved_at IS NOT NULL AND resolved_by IS NOT NULL)
);
ALTER TABLE improvement_actions ADD CONSTRAINT ck_improvement_status
    CHECK(status IN ('OPEN','IN_PROGRESS','VERIFIED','DISCARDED'));
ALTER TABLE improvement_actions ADD CONSTRAINT ck_improvement_verification
    CHECK(status<>'VERIFIED' OR (result_value IS NOT NULL AND verified_by IS NOT NULL AND note IS NOT NULL));
COMMENT ON COLUMN incidents.retry_order_id IS 'New linked attempt. Original terminal order and POD are never rewritten.';


-- V14__local_evidence_durability.sql
-- Only used when aws.s3.local-durable-backup=true (local Docker profile).
-- Keeps test evidence durable even if the S3 emulator loses its in-memory catalogue.
CREATE TABLE local_evidence_backups (
    object_key VARCHAR(300) PRIMARY KEY,
    content BYTEA NOT NULL,
    media_type VARCHAR(40) NOT NULL CHECK(media_type IN ('image/png','image/jpeg')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK(octet_length(content)<=10485760)
);
COMMENT ON TABLE local_evidence_backups IS 'Local emulator recovery only. Not enabled for production. Contains original evidence bytes, not generated replacements.';


-- V15__analytics_returned_terminal.sql
-- Align terminal stops with OrderLifecycle without changing the applied V12 migration.
-- Preserve the view's columns, names, types and order; only RETURNED joins the divisor.
CREATE OR REPLACE VIEW analytics_route_facts AS
WITH route_orders AS (
    SELECT route_id, COUNT(*) AS order_count,
           COUNT(*) FILTER (WHERE status = 'DELIVERED') AS delivered_count,
           COUNT(*) FILTER (WHERE status IN ('DELIVERED', 'FAILED', 'RETURNED')) AS terminal_stop_count
    FROM orders WHERE route_id IS NOT NULL GROUP BY route_id
), gps_points AS (
    SELECT r.id AS route_id, g.vehicle_id, g.latitude::double precision AS lat,
           g.longitude::double precision AS lon, g.ping_time,
           LAG(g.latitude::double precision) OVER w AS prev_lat,
           LAG(g.longitude::double precision) OVER w AS prev_lon
    FROM routes r JOIN vehicle_gps_history g ON g.vehicle_id = r.vehicle_id
       AND r.actual_start_time IS NOT NULL
       AND g.ping_time >= r.actual_start_time
       AND g.ping_time <= COALESCE(r.actual_end_time, CURRENT_TIMESTAMP)
       AND (r.actual_end_time IS NOT NULL OR r.status = 'IN_PROGRESS')
    WHERE g.latitude BETWEEN -90 AND 90 AND g.latitude <> 0
      AND g.longitude BETWEEN -180 AND 180 AND g.longitude <> 0
    WINDOW w AS (PARTITION BY r.id, g.vehicle_id ORDER BY g.ping_time, g.id)
), gps_distance AS (
    SELECT route_id, COUNT(*) AS gps_sample_count, MIN(ping_time) AS first_gps_at, MAX(ping_time) AS last_gps_at,
           CASE WHEN COUNT(*) >= 2 THEN SUM(
               CASE WHEN prev_lat IS NOT NULL THEN 2 * 6371.0088 * ASIN(SQRT(LEAST(1.0, GREATEST(0.0,
                 POWER(SIN(RADIANS(lat-prev_lat)/2),2)
                 + COS(RADIANS(prev_lat))*COS(RADIANS(lat))*POWER(SIN(RADIANS(lon-prev_lon)/2),2)
               )))) ELSE 0 END) END AS actual_gps_distance_km
    FROM gps_points GROUP BY route_id
), route_facts AS (
    SELECT r.id AS route_id, 'Ruta ' || r.id AS label, r.driver_id, r.vehicle_id,
           r.route_date AS operation_date, r.status, r.actual_start_time, r.actual_end_time,
           r.total_distance_km::double precision AS planned_distance_km,
           r.total_duration_min AS planned_duration_min,
           COALESCE(o.order_count, 0)::bigint AS order_count,
           COALESCE(o.delivered_count, 0)::bigint AS delivered_count,
           COALESCE(o.terminal_stop_count, 0)::bigint AS terminal_stop_count,
           COALESCE(g.gps_sample_count, 0)::bigint AS gps_sample_count,
           g.first_gps_at, g.last_gps_at, g.actual_gps_distance_km,
           CASE WHEN r.actual_start_time IS NOT NULL AND r.actual_end_time >= r.actual_start_time
                THEN EXTRACT(EPOCH FROM (r.actual_end_time-r.actual_start_time))::double precision/60 END AS operation_minutes
    FROM routes r LEFT JOIN route_orders o ON o.route_id = r.id LEFT JOIN gps_distance g ON g.route_id = r.id
)
SELECT route_facts.*,
       actual_gps_distance_km / NULLIF(delivered_count, 0) AS km_per_delivery,
       operation_minutes / NULLIF(terminal_stop_count, 0) AS time_per_stop_min,
       CASE WHEN actual_gps_distance_km IS NULL THEN 'UNAVAILABLE' ELSE 'GPS_HAVERSINE' END AS distance_source
FROM route_facts;

COMMENT ON VIEW analytics_route_facts IS 'Distancia GPS Haversine dentro de la ruta; mínimo 2 muestras. Minutos de operación por parada terminal DELIVERED/FAILED/RETURNED, no tiempo de servicio.';


-- V16__analytics_gps_quality.sql
-- Read models only: retain every historical route, order and telemetry row.
-- 160 km/h and 900 s are conservative local reporting policy defaults, not a transport standard.
-- The function accepts policy parameters; the view uses defaults for standalone SQL readers.
CREATE FUNCTION analytics_route_gps_quality(
    max_speed_kmh double precision DEFAULT 160,
    max_gap_seconds double precision DEFAULT 900
) RETURNS TABLE (
    route_id bigint, gps_sample_count bigint, valid_gps_sample_count bigint,
    invalid_gps_sample_count bigint, gps_segment_count bigint, rejected_gps_segment_count bigint,
    implausible_speed_segment_count bigint, nonpositive_time_segment_count bigint,
    excessive_gap_segment_count bigint, first_gps_at timestamptz, last_gps_at timestamptz,
    observed_distance_km double precision, actual_gps_distance_km double precision, gps_quality text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
WITH samples AS (
    SELECT r.id AS route_id, g.id, g.latitude::double precision AS lat,
           g.longitude::double precision AS lon, g.ping_time,
           COALESCE(g.latitude BETWEEN -90 AND 90 AND g.longitude BETWEEN -180 AND 180
               AND NOT (g.latitude = 0 AND g.longitude = 0), FALSE) AS valid
    FROM public.routes r JOIN public.vehicle_gps_history g ON g.vehicle_id = r.vehicle_id
        AND r.actual_start_time IS NOT NULL
        AND g.ping_time >= r.actual_start_time
        AND g.ping_time <= COALESCE(r.actual_end_time, CURRENT_TIMESTAMP)
        AND (r.actual_end_time IS NOT NULL OR r.status = 'IN_PROGRESS')
), points AS (
    SELECT samples.*, LAG(id) OVER w AS prev_id, LAG(lat) OVER w AS prev_lat,
           LAG(lon) OVER w AS prev_lon, LAG(ping_time) OVER w AS prev_time, LAG(valid) OVER w AS prev_valid
    FROM samples WINDOW w AS (PARTITION BY route_id ORDER BY ping_time,id)
), segments AS (
    SELECT points.*, EXTRACT(EPOCH FROM (ping_time-prev_time))::double precision AS elapsed_seconds,
           CASE WHEN valid AND prev_valid THEN 2 * 6371.0088 * ASIN(SQRT(LEAST(1.0, GREATEST(0.0,
               POWER(SIN(RADIANS(lat-prev_lat)/2),2)
               + COS(RADIANS(prev_lat))*COS(RADIANS(lat))*POWER(SIN(RADIANS(lon-prev_lon)/2),2)
           )))) END AS segment_km
    FROM points
), assessed AS (
    SELECT segments.*,
           (prev_id IS NOT NULL AND (NOT valid OR NOT prev_valid OR elapsed_seconds <= 0
               OR elapsed_seconds > max_gap_seconds
               OR segment_km / NULLIF(elapsed_seconds,0) * 3600 > max_speed_kmh)) AS rejected
    FROM segments
), totals AS (
    SELECT route_id, COUNT(*) AS sample_count, COUNT(*) FILTER(WHERE valid) AS valid_count,
           COUNT(*) FILTER(WHERE NOT valid) AS invalid_count,
           COUNT(*) FILTER(WHERE prev_id IS NOT NULL) AS segment_count,
           COUNT(*) FILTER(WHERE rejected) AS rejected_count,
           COUNT(*) FILTER(WHERE elapsed_seconds > 0 AND segment_km / NULLIF(elapsed_seconds,0) * 3600 > max_speed_kmh) AS speed_count,
           COUNT(*) FILTER(WHERE elapsed_seconds <= 0) AS time_count,
           COUNT(*) FILTER(WHERE elapsed_seconds > max_gap_seconds) AS gap_count,
           MIN(ping_time) AS first_at, MAX(ping_time) AS last_at, SUM(segment_km) AS observed
    FROM assessed GROUP BY route_id
), quality AS (
    SELECT totals.*, CASE
        WHEN NOT COALESCE(max_speed_kmh > 0 AND max_speed_kmh < 'Infinity'::double precision
            AND max_gap_seconds > 0 AND max_gap_seconds < 'Infinity'::double precision, FALSE) THEN 'INVALID_CONFIGURATION'
        WHEN sample_count < 2 THEN 'INSUFFICIENT_SAMPLES'
        WHEN invalid_count > 0 THEN 'INVALID_COORDINATES'
        WHEN time_count > 0 THEN 'NON_POSITIVE_TIME'
        WHEN speed_count > 0 THEN 'IMPLAUSIBLE_SPEED'
        WHEN gap_count > 0 THEN 'EXCESSIVE_GAP'
        ELSE 'AVAILABLE' END AS quality
    FROM totals
)
SELECT route_id, sample_count, valid_count, invalid_count, segment_count, rejected_count,
       speed_count, time_count, gap_count, first_at, last_at, observed,
       CASE WHEN quality = 'AVAILABLE' THEN observed END, quality
FROM quality;
$$;

-- Keep BI readers on aggregate read models; no SELECT grants on base telemetry/routes.
-- Static SQL, qualified base relations and a fixed path avoid caller-controlled object lookup.
REVOKE ALL ON FUNCTION analytics_route_gps_quality(double precision,double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION analytics_route_gps_quality(double precision,double precision) TO ecoroute_bi_reader;

-- Preserve V15 column order/types; append explicit quality and observed-distance metadata.
CREATE OR REPLACE VIEW analytics_route_facts AS
WITH route_orders AS (
    SELECT route_id, COUNT(*) AS order_count,
           COUNT(*) FILTER(WHERE status = 'DELIVERED') AS delivered_count,
           COUNT(*) FILTER(WHERE status IN ('DELIVERED','FAILED','RETURNED')) AS terminal_stop_count
    FROM orders WHERE route_id IS NOT NULL GROUP BY route_id
), facts AS (
    SELECT r.id AS route_id, 'Ruta ' || r.id AS label, r.driver_id, r.vehicle_id,
           r.route_date AS operation_date, r.status, r.actual_start_time, r.actual_end_time,
           r.total_distance_km::double precision AS planned_distance_km,
           r.total_duration_min AS planned_duration_min,
           COALESCE(o.order_count,0)::bigint AS order_count,
           COALESCE(o.delivered_count,0)::bigint AS delivered_count,
           COALESCE(o.terminal_stop_count,0)::bigint AS terminal_stop_count,
           COALESCE(g.gps_sample_count,0)::bigint AS gps_sample_count,
           g.first_gps_at, g.last_gps_at, g.actual_gps_distance_km,
           CASE WHEN r.actual_start_time IS NOT NULL AND r.actual_end_time >= r.actual_start_time
                THEN EXTRACT(EPOCH FROM (r.actual_end_time-r.actual_start_time))::double precision/60 END AS operation_minutes,
           COALESCE(g.gps_quality,'INSUFFICIENT_SAMPLES') AS gps_quality,
           g.observed_distance_km,
           COALESCE(g.valid_gps_sample_count,0)::bigint AS valid_gps_sample_count,
           COALESCE(g.invalid_gps_sample_count,0)::bigint AS invalid_gps_sample_count,
           COALESCE(g.gps_segment_count,0)::bigint AS gps_segment_count,
           COALESCE(g.rejected_gps_segment_count,0)::bigint AS rejected_gps_segment_count,
           COALESCE(g.implausible_speed_segment_count,0)::bigint AS implausible_speed_segment_count,
           COALESCE(g.nonpositive_time_segment_count,0)::bigint AS nonpositive_time_segment_count,
           COALESCE(g.excessive_gap_segment_count,0)::bigint AS excessive_gap_segment_count
    FROM routes r LEFT JOIN route_orders o ON o.route_id = r.id
    LEFT JOIN analytics_route_gps_quality() g ON g.route_id = r.id
)
SELECT route_id,label,driver_id,vehicle_id,operation_date,status,actual_start_time,actual_end_time,
       planned_distance_km,planned_duration_min,order_count,delivered_count,terminal_stop_count,
       gps_sample_count,first_gps_at,last_gps_at,actual_gps_distance_km,operation_minutes,
       actual_gps_distance_km / NULLIF(delivered_count,0) AS km_per_delivery,
       operation_minutes / NULLIF(terminal_stop_count,0) AS time_per_stop_min,
       CASE WHEN actual_gps_distance_km IS NULL THEN 'UNAVAILABLE' ELSE 'GPS_HAVERSINE' END AS distance_source,
       gps_quality,observed_distance_km,valid_gps_sample_count,invalid_gps_sample_count,gps_segment_count,
       rejected_gps_segment_count,implausible_speed_segment_count,nonpositive_time_segment_count,excessive_gap_segment_count
FROM facts;

COMMENT ON FUNCTION analytics_route_gps_quality(double precision,double precision) IS
    'Consecutive telemetry within route window; no bridging across invalid samples. Actual distance NULL if any invalid point/time, speed>policy or gap>policy. Observed sum is unvalidated, not travelled distance. Defaults 160 km/h,900 s are local policy, not standards. (0,0) treated as local missing-position sentinel; equator/meridian otherwise valid.';
COMMENT ON VIEW analytics_route_facts IS
    'GPS Haversine qualified using defaults 160 km/h and 900 s; insufficient or rejected trace => actual distance/km per delivery NULL, never planned/zero fallback. Raw adjacent-point sum exposed as observed_distance_km. Terminal stops include DELIVERED/FAILED/RETURNED.';


COMMIT;
