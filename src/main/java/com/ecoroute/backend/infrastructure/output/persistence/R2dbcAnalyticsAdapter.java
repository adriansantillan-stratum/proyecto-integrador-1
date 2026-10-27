package com.ecoroute.backend.infrastructure.output.persistence;

import com.ecoroute.backend.domain.model.analytics.AnalyticsFilter;
import com.ecoroute.backend.domain.model.analytics.GpsQualityPolicy;
import com.ecoroute.backend.domain.model.analytics.AnalyticsModels.*;
import com.ecoroute.backend.domain.ports.out.AnalyticsQueryPort;
import io.r2dbc.spi.Row;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Repository
public class R2dbcAnalyticsAdapter implements AnalyticsQueryPort {
    private final DatabaseClient database;
    private final GpsQualityPolicy gpsPolicy;

    @Autowired
    public R2dbcAnalyticsAdapter(DatabaseClient database,
            @Value("${analytics.gps.max-speed-kmh:160}") double maxSpeedKmh,
            @Value("${analytics.gps.max-gap-seconds:900}") double maxGapSeconds) {
        this.database = database;
        this.gpsPolicy = new GpsQualityPolicy(maxSpeedKmh,maxGapSeconds);
    }

    public R2dbcAnalyticsAdapter(DatabaseClient database) {
        this(database,GpsQualityPolicy.DEFAULT_MAX_SPEED_KMH,GpsQualityPolicy.DEFAULT_MAX_GAP_SECONDS);
    }

    private static final String FILTER = """
        WHERE (CAST(:driverId AS bigint) IS NULL OR driver_id = :driverId)
          AND (CAST(:startDate AS date) IS NULL OR operation_date >= :startDate)
          AND (CAST(:endDate AS date) IS NULL OR operation_date <= :endDate)
        """;
    private static final String AGGREGATES = """
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE iid_valid) AS valid,
        COUNT(*) FILTER (WHERE scheduled) AS scheduled,
        COUNT(*) FILTER (WHERE scheduled AND delivered) AS delivered_scheduled,
        COUNT(*) FILTER (WHERE scheduled AND digital_evidence) AS evidence_scheduled,
        COUNT(*) FILTER (WHERE delivered) AS delivered,
        COUNT(*) FILTER (WHERE on_time) AS on_time,
        COUNT(*) FILTER (WHERE delayed) AS delayed,
        COUNT(*) FILTER (WHERE ontime_evaluable) AS evaluable,
        COUNT(*) FILTER (WHERE complete_pod) AS complete_pod,
        COUNT(*) FILTER (WHERE NOT valid_ruc) AS missing_ruc,
        COUNT(*) FILTER (WHERE NOT valid_gps) AS invalid_gps,
        COUNT(*) FILTER (WHERE estimated_delivery_window_end IS NULL) AS missing_window,
        COUNT(*) FILTER (WHERE customer_accepted IS DISTINCT FROM TRUE OR confirmed_at IS NULL) AS unconfirmed,
        COUNT(*) FILTER (WHERE address_verified IS DISTINCT FROM TRUE) AS unverified_address,
        COUNT(*) FILTER (WHERE coverage_verified IS DISTINCT FROM TRUE) AS unverified_coverage
        """;

    private DatabaseClient.GenericExecuteSpec query(String sql, AnalyticsFilter f) {
        var spec = database.sql(sql);
        spec = f.driverId() == null ? spec.bindNull("driverId", Long.class) : spec.bind("driverId", f.driverId());
        spec = f.startDate() == null ? spec.bindNull("startDate", LocalDate.class) : spec.bind("startDate", f.startDate());
        return f.endDate() == null ? spec.bindNull("endDate", LocalDate.class) : spec.bind("endDate", f.endDate());
    }
    @Override
    public Flux<StatusCount> ordersByStatus(AnalyticsFilter f) {
        return query("SELECT status, COUNT(*) AS count FROM analytics_order_facts " + FILTER + " GROUP BY status ORDER BY status", f)
                .map((r,m) -> new StatusCount(r.get("status", String.class), n(r,"count"))).all();
    }
    @Override
    public Mono<Totals> totals(AnalyticsFilter f) {
        return query("SELECT " + AGGREGATES + " FROM analytics_order_facts " + FILTER, f)
                .map((r,m) -> totals(r)).one();
    }
    @Override
    public Flux<DailyTotals> daily(AnalyticsFilter f) {
        return query("SELECT operation_date, " + AGGREGATES + " FROM analytics_order_facts " + FILTER
                + " GROUP BY operation_date ORDER BY operation_date", f)
                .map((r,m) -> new DailyTotals(r.get("operation_date", LocalDate.class), totals(r))).all();
    }
    @Override
    public Flux<DriverCount> byDriver(AnalyticsFilter f) {
        return query("""
                SELECT driver_id, driver_name, COUNT(*) FILTER (WHERE delivered) AS count,
                       COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'FAILED') AS failed
                FROM analytics_order_facts
                """ + FILTER + " GROUP BY driver_id, driver_name ORDER BY driver_id NULLS LAST", f)
                .map((r,m) -> new DriverCount(r.get("driver_id", Long.class), r.get("driver_name", String.class),
                        n(r,"count"), n(r,"total"), n(r,"failed"))).all();
    }
    @Override
    public Flux<NameCount> byDistrict(AnalyticsFilter f) {
        return query("SELECT district, COUNT(*) AS count FROM analytics_order_facts " + FILTER
                + " GROUP BY district ORDER BY district", f)
                .map((r,m) -> new NameCount(r.get("district", String.class), n(r,"count"))).all();
    }
    @Override
    public Flux<Cause> causes(AnalyticsFilter f) {
        return query("""
            WITH scoped_orders AS (SELECT * FROM analytics_order_facts
            """ + FILTER + "), scoped_routes AS (SELECT route_id FROM analytics_route_facts " + FILTER + """
            ), events AS (
              SELECT 'STATUS_HISTORY' AS source,
                     COALESCE(NULLIF(BTRIM(h.reason), ''), 'Sin motivo registrado') AS reason
              FROM order_status_history h JOIN scoped_orders o ON o.order_id = h.order_id
              WHERE h.status IN ('FAILED','RETURNED','CANCELLED')
              UNION ALL
              SELECT 'INCIDENT', COALESCE(NULLIF(BTRIM(i.resolution_reason), ''),
                     NULLIF(BTRIM(i.description), ''), NULLIF(BTRIM(i.incident_type), ''), 'Sin motivo registrado')
              FROM incidents i
              WHERE (i.order_id IS NOT NULL AND EXISTS (SELECT 1 FROM scoped_orders o WHERE o.order_id = i.order_id))
                 OR (i.order_id IS NULL AND EXISTS (SELECT 1 FROM scoped_routes r WHERE r.route_id = i.route_id))
            ) SELECT source, reason, COUNT(*) AS count FROM events
              GROUP BY source, reason ORDER BY count DESC, source, reason
            """, f).map((r,m) -> new Cause(r.get("source", String.class), r.get("reason", String.class), n(r,"count"))).all();
    }
    @Override
    public Flux<RouteEfficiency> efficiency(AnalyticsFilter f) {
        // Explicit projection prevents default-policy view values from leaking into configured API values.
        return query("""
                WITH scoped_routes AS (SELECT * FROM analytics_route_facts
                """ + FILTER + """
                ) SELECT r.route_id,r.label,r.order_count,r.planned_distance_km,r.operation_minutes,r.time_per_stop_min,
                    g.actual_gps_distance_km,g.actual_gps_distance_km / NULLIF(r.delivered_count,0) AS km_per_delivery,
                    CASE WHEN g.actual_gps_distance_km IS NULL THEN 'UNAVAILABLE' ELSE 'GPS_HAVERSINE' END AS distance_source,
                    COALESCE(g.gps_quality,'INSUFFICIENT_SAMPLES') AS gps_quality,
                    COALESCE(g.gps_sample_count,0)::bigint AS gps_sample_count,
                    COALESCE(g.valid_gps_sample_count,0)::bigint AS valid_gps_sample_count,
                    COALESCE(g.invalid_gps_sample_count,0)::bigint AS invalid_gps_sample_count,
                    COALESCE(g.gps_segment_count,0)::bigint AS gps_segment_count,
                    COALESCE(g.rejected_gps_segment_count,0)::bigint AS rejected_gps_segment_count,
                    COALESCE(g.implausible_speed_segment_count,0)::bigint AS implausible_speed_segment_count,
                    COALESCE(g.nonpositive_time_segment_count,0)::bigint AS nonpositive_time_segment_count,
                    COALESCE(g.excessive_gap_segment_count,0)::bigint AS excessive_gap_segment_count,g.observed_distance_km
                FROM scoped_routes r LEFT JOIN analytics_route_gps_quality(:maxSpeedKmh,:maxGapSeconds) g
                    ON g.route_id=r.route_id ORDER BY r.route_id
                """, f).bind("maxSpeedKmh",gpsPolicy.maxSpeedKmh()).bind("maxGapSeconds",gpsPolicy.maxGapSeconds())
                .map((r,m) -> new RouteEfficiency(r.get("route_id", Long.class), r.get("label", String.class),
                        n(r,"order_count"), r.get("planned_distance_km", Double.class),
                        r.get("actual_gps_distance_km", Double.class), r.get("operation_minutes", Double.class),
                        r.get("km_per_delivery", Double.class), r.get("time_per_stop_min", Double.class),
                        r.get("distance_source", String.class),
                        new GpsQuality(r.get("gps_quality",String.class),n(r,"gps_sample_count"),n(r,"valid_gps_sample_count"),
                                n(r,"invalid_gps_sample_count"),n(r,"gps_segment_count"),n(r,"rejected_gps_segment_count"),
                                n(r,"implausible_speed_segment_count"),n(r,"nonpositive_time_segment_count"),n(r,"excessive_gap_segment_count"),
                                r.get("observed_distance_km",Double.class),gpsPolicy.maxSpeedKmh(),gpsPolicy.maxGapSeconds()))).all();
    }
    @Override
    public Flux<Goal> goals() {
        return database.sql("SELECT * FROM analytics_goal_facts ORDER BY code").map((r,m) -> goal(r)).all();
    }
    @Override
    public Mono<Goal> saveGoal(Indicator code, BigDecimal target, String actor) {
        var spec = database.sql("""
            INSERT INTO analytics_goals(code, target, updated_by) VALUES (:code, :target, :actor)
            ON CONFLICT(code) DO UPDATE SET target = EXCLUDED.target, updated_by = EXCLUDED.updated_by,
                updated_at = clock_timestamp()
            RETURNING code, target, updated_by, updated_at
            """).bind("code", code.name()).bind("actor", actor);
        spec = target == null ? spec.bindNull("target", BigDecimal.class) : spec.bind("target", target);
        return spec.map((r,m) -> goal(r)).one();
    }
    private static long n(Row row, String name) { return row.get(name, Long.class); }
    private static Goal goal(Row r) {
        return new Goal(r.get("code", String.class), r.get("target", BigDecimal.class),
                r.get("updated_by", String.class), r.get("updated_at", OffsetDateTime.class));
    }
    private static Totals totals(Row r) {
        return new Totals(n(r,"total"), n(r,"valid"), n(r,"scheduled"), n(r,"delivered_scheduled"),
                n(r,"evidence_scheduled"), n(r,"delivered"), n(r,"on_time"), n(r,"delayed"), n(r,"evaluable"),
                n(r,"complete_pod"), n(r,"missing_ruc"), n(r,"invalid_gps"), n(r,"missing_window"),
                n(r,"unconfirmed"), n(r,"unverified_address"), n(r,"unverified_coverage"));
    }
}
