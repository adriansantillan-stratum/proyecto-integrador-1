package com.ecoroute.backend.infrastructure.output.persistence;

import com.ecoroute.backend.domain.model.analytics.AnalyticsFilter;
import com.ecoroute.backend.domain.model.analytics.AnalyticsModels.RouteEfficiency;
import io.r2dbc.spi.ConnectionFactories;
import io.r2dbc.spi.ConnectionFactoryOptions;
import java.sql.DriverManager;
import java.time.Duration;
import java.time.LocalDate;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.r2dbc.core.DatabaseClient;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import static org.assertj.core.api.Assertions.*;

/** V15 -> V16 on an isolated disposable database; never connects to compose/business databases. */
@Testcontainers(disabledWithoutDocker = true)
class R2dbcAnalyticsGpsQualityIntegrationTest {
    @Container static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:14-alpine");
    static DatabaseClient db;
    static R2dbcAnalyticsAdapter adapter;
    static double legacyJumpKm;
    static String beforeDigest;
    static final AnalyticsFilter FILTER = new AnalyticsFilter(801L,LocalDate.of(2026,10,22),LocalDate.of(2026,10,22));
    static final Duration TIMEOUT = Duration.ofSeconds(20);

    static Flyway flyway(String target) {
        var config = Flyway.configure().dataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword())
                .locations("classpath:db/migration");
        if (target != null) config.target(target);
        return config.load();
    }
    static String digest(java.sql.Statement statement) throws Exception {
        var r = statement.executeQuery("""
            SELECT md5(json_build_array(
              (SELECT json_agg(t ORDER BY id) FROM routes t),
              (SELECT json_agg(t ORDER BY id) FROM orders t),
              (SELECT json_agg(t ORDER BY id) FROM vehicle_gps_history t))::text)
            """);
        r.next(); return r.getString(1);
    }
    @BeforeAll static void seedV15ThenUpgradeOnlyDisposableDatabase() throws Exception {
        flyway("15").migrate();
        try (var c = DriverManager.getConnection(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword());
             var s = c.createStatement()) {
            s.execute("""
                INSERT INTO drivers(id,first_name,last_name,license_number) VALUES(801,'GPS','Quality','GPS-801');
                INSERT INTO vehicles(id,plate_number) SELECT n,'GPS-'||n FROM generate_series(2001,2013) n;
                INSERT INTO routes(id,driver_id,vehicle_id,route_date,status,actual_start_time,actual_end_time,total_distance_km)
                  SELECT n,801,n,'2026-10-22','COMPLETED','2026-10-22 15:00Z','2026-10-22 16:00Z',77
                  FROM generate_series(2001,2013) n;
                INSERT INTO orders(id,tracking_number,status,driver_id,route_id)
                  SELECT n,'GPS-'||n,'DELIVERED',801,n FROM generate_series(2001,2013) n;
                INSERT INTO vehicle_gps_history(vehicle_id,driver_id,latitude,longitude,ping_time) VALUES
                  (2001,801,-12,-77,'2026-10-22 15:00Z'),(2001,801,-12.01,-77,'2026-10-22 15:10Z'),
                  (2002,801,-12,-77,'2026-10-22 15:00Z'),
                  (2004,801,-12,-77,'2026-10-22 15:00Z'),(2004,801,37.422,-122.084,'2026-10-22 15:00:10Z'),
                  (2005,801,-12,-77,'2026-10-22 15:00Z'),(2005,801,-12.01,-77,'2026-10-22 15:10Z'),
                  (2005,801,37.422,-122.084,'2026-10-22 15:10:10Z'),(2005,801,37.423,-122.084,'2026-10-22 15:20Z'),
                  (2006,801,-12,-77,'2026-10-22 15:00Z'),(2006,801,-12.01,-77,'2026-10-22 15:00Z'),
                  (2007,801,-12,-77,'2026-10-22 15:00Z'),(2007,801,-12.01,-77,'2026-10-22 15:15:01Z'),
                  (2008,801,-12,-77,'2026-10-22 15:00Z'),(2008,801,-12,-77,'2026-10-22 15:10Z'),
                  (2009,801,-12,-77,'2026-10-22 15:00Z'),(2009,801,0,0,'2026-10-22 15:05Z'),
                  (2009,801,-12.01,-77,'2026-10-22 15:10Z'),
                  (2010,801,-12,-77,'2026-10-22 15:00Z'),(2010,801,91,-77,'2026-10-22 15:10Z'),
                  (2011,801,0,-77,'2026-10-22 15:00Z'),(2011,801,0,-77.01,'2026-10-22 15:10Z'),
                  (2012,801,-12,-77,'2026-10-22 14:59:59Z'),(2012,801,-12.01,-77,'2026-10-22 16:00:01Z'),
                  (2013,801,-12,-77,'2026-10-22 15:00Z'),(2013,801,-12.01,-77,'2026-10-22 15:15Z');
                """);
            var r = s.executeQuery("SELECT actual_gps_distance_km FROM analytics_route_facts WHERE route_id=2004");
            r.next(); legacyJumpKm = r.getDouble(1); beforeDigest = digest(s);
        }
        flyway(null).migrate();
        var options = ConnectionFactoryOptions.builder().option(ConnectionFactoryOptions.DRIVER,"postgresql")
                .option(ConnectionFactoryOptions.HOST,postgres.getHost()).option(ConnectionFactoryOptions.PORT,postgres.getFirstMappedPort())
                .option(ConnectionFactoryOptions.DATABASE,postgres.getDatabaseName()).option(ConnectionFactoryOptions.USER,postgres.getUsername())
                .option(ConnectionFactoryOptions.PASSWORD,postgres.getPassword()).build();
        db = DatabaseClient.create(ConnectionFactories.get(options)); adapter = new R2dbcAnalyticsAdapter(db);
    }
    static RouteEfficiency route(long id) { return route(adapter,id); }
    static RouteEfficiency route(R2dbcAnalyticsAdapter source,long id) {
        return source.efficiency(FILTER).filter(r -> r.routeId() == id).single().block(TIMEOUT);
    }

    @Test void v15JumpIsReproducedAndV16LeavesAllOperationalRowsIntact() throws Exception {
        assertThat(legacyJumpKm).isGreaterThan(6000);
        try (var c = DriverManager.getConnection(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword());
             var s = c.createStatement()) {
            assertThat(digest(s)).isEqualTo(beforeDigest);
            var r = s.executeQuery("SELECT actual_gps_distance_km,observed_distance_km,gps_quality FROM analytics_route_facts WHERE route_id=2004");
            assertThat(r.next()).isTrue(); assertThat(r.getObject(1)).isNull();
            assertThat(r.getDouble(2)).isCloseTo(legacyJumpKm,within(0.000001));
            assertThat(r.getString(3)).isEqualTo("IMPLAUSIBLE_SPEED");
        }
    }
    @Test void plausibleTraceAndStationaryTraceRemainAvailableWithoutPlanFallback() {
        var moving = route(2001);
        assertThat(moving.actualGpsDistanceKm()).isCloseTo(1.1119508,within(0.00001));
        assertThat(moving.plannedDistanceKm()).isEqualTo(77);
        assertThat(moving.gpsQuality().status()).isEqualTo("AVAILABLE");
        assertThat(moving.kmPerDelivery()).isEqualTo(moving.actualGpsDistanceKm());
        assertThat(route(2008).actualGpsDistanceKm()).isZero();
        assertThat(route(2008).gpsQuality().status()).isEqualTo("AVAILABLE");
        assertThat(route(2011).actualGpsDistanceKm()).isCloseTo(1.1119508,within(0.00001));
        assertThat(route(2013).gpsQuality().status()).isEqualTo("AVAILABLE");
    }
    @Test void zeroOrOneSampleIsUnavailableAndOutsideWindowPointsAreNotCounted() {
        for (long id : new long[]{2002,2003,2012}) {
            var r = route(id);
            assertThat(r.actualGpsDistanceKm()).isNull(); assertThat(r.kmPerDelivery()).isNull();
            assertThat(r.gpsQuality().status()).isEqualTo("INSUFFICIENT_SAMPLES");
            assertThat(r.distanceSource()).isEqualTo("UNAVAILABLE");
        }
        assertThat(route(2002).gpsQuality().sampleCount()).isEqualTo(1);
        assertThat(route(2012).gpsQuality().sampleCount()).isZero();
    }
    @Test void jumpsInvalidateWholeTraceRatherThanPublishingASumOfAcceptedSegments() {
        for (long id : new long[]{2004,2005}) {
            var r = route(id);
            assertThat(r.actualGpsDistanceKm()).isNull(); assertThat(r.kmPerDelivery()).isNull();
            assertThat(r.gpsQuality().status()).isEqualTo("IMPLAUSIBLE_SPEED");
            assertThat(r.gpsQuality().observedDistanceKm()).isGreaterThan(6000);
            assertThat(r.gpsQuality().implausibleSpeedSegmentCount()).isEqualTo(1);
        }
    }
    @Test void gapsTimestampsAndInvalidCoordinatesHaveDistinctQualityReasons() {
        assertThat(route(2006).gpsQuality().status()).isEqualTo("NON_POSITIVE_TIME");
        assertThat(route(2006).gpsQuality().nonPositiveTimeSegmentCount()).isEqualTo(1);
        assertThat(route(2007).gpsQuality().status()).isEqualTo("EXCESSIVE_GAP");
        assertThat(route(2007).gpsQuality().excessiveGapSegmentCount()).isEqualTo(1);
        for (long id : new long[]{2009,2010}) {
            var r = route(id);
            assertThat(r.actualGpsDistanceKm()).isNull();
            assertThat(r.gpsQuality().status()).isEqualTo("INVALID_COORDINATES");
            assertThat(r.gpsQuality().invalidSampleCount()).isEqualTo(1);
            assertThat(r.gpsQuality().observedDistanceKm()).isNull();
        }
    }
    @Test void configuredBoundsAreAppliedAndReportedSeparatelyFromViewDefaults() {
        var strict = route(new R2dbcAnalyticsAdapter(db,5,900),2001);
        assertThat(strict.actualGpsDistanceKm()).isNull();
        assertThat(strict.gpsQuality().status()).isEqualTo("IMPLAUSIBLE_SPEED");
        assertThat(strict.gpsQuality().maxSpeedKmh()).isEqualTo(5);
        assertThat(route(new R2dbcAnalyticsAdapter(db,160,1000),2007).actualGpsDistanceKm()).isNotNull();
        assertThat(route(2007).actualGpsDistanceKm()).isNull();
    }
    @Test void invalidReportingConfigurationCannotCreateAnApparentlyValidDistance() {
        assertThatThrownBy(() -> new R2dbcAnalyticsAdapter(db,Double.NaN,900)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new R2dbcAnalyticsAdapter(db,160,0)).isInstanceOf(IllegalArgumentException.class);
        var quality = db.sql("SELECT gps_quality,actual_gps_distance_km FROM analytics_route_gps_quality(0,900) WHERE route_id=2001")
                .map((r,m) -> {assertThat(r.get("actual_gps_distance_km")).isNull(); return r.get("gps_quality",String.class);})
                .one().block(TIMEOUT);
        assertThat(quality).isEqualTo("INVALID_CONFIGURATION");
    }
}
