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
