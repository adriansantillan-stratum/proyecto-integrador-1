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
