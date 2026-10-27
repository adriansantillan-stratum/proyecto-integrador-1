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
