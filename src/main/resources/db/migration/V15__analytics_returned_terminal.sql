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
