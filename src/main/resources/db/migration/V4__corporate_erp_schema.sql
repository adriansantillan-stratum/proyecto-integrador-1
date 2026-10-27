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

-- =============================================================================
-- DATA SEEDING (Making it look "Real")
-- =============================================================================

INSERT INTO corp_branches (name, address, city) VALUES 
('Sede Central Lima', 'Av. Argentina 4567', 'Lima'),
('Centro de Distribución Sur', 'Panamericana Sur Km 18', 'Villa El Salvador'),
('Almacén Norte', 'Av. Gerardo Unger 120', 'Los Olivos');

INSERT INTO corp_departments (name, branch_id) VALUES 
('Operaciones', 1),
('Soporte TI', 1),
('Recursos Humanos', 1),
('Mantenimiento', 2);

INSERT INTO corp_customers (company_name, ruc, contact_person, segment) VALUES 
('Saga Falabella S.A.', '20100128056', 'Carlos Fuentes', 'RETAIL'),
('Ripley Perú S.A.C.', '20337564373', 'Ana Torres', 'RETAIL'),
('Mercado Libre Perú', '20601345678', 'Diego Diaz', 'E-COMMERCE'),
('Linio S.A.C.', '20546781234', 'Sofia Luna', 'E-COMMERCE');

INSERT INTO corp_employees (first_name, last_name, dni, dept_id, salary) VALUES 
('Admin', 'Global', '10000000', 2, 8500.00),
('Roberto', 'Gomez', '20304050', 1, 3500.00),
('Lucia', 'Ramos', '45678901', 3, 4200.00);

-- Note: Our microservice tables (orders, drivers, etc.) coexist with these.
-- In a real scenario, 'orders' might have a FK to 'corp_customers'.
