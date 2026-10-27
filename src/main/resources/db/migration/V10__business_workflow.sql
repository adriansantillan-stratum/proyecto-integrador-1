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
