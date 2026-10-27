package com.ecoroute.backend.infrastructure.output.persistence;

import com.ecoroute.backend.application.services.DashboardService;
import com.ecoroute.backend.domain.model.analytics.AnalyticsFilter;
import com.ecoroute.backend.domain.model.analytics.AnalyticsModels.*;
import io.r2dbc.spi.ConnectionFactories;
import io.r2dbc.spi.ConnectionFactoryOptions;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.time.Duration;
import java.time.LocalDate;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.test.web.reactive.server.WebTestClient;
import com.ecoroute.backend.infrastructure.input.rest.DashboardController;
import com.ecoroute.backend.infrastructure.input.rest.ReportController;
import com.ecoroute.backend.infrastructure.exception.RestExceptionHandler;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import static org.assertj.core.api.Assertions.*;

/** Only a disposable Testcontainers database is mutated. No compose services or production URL. */
@Testcontainers(disabledWithoutDocker = true)
class R2dbcAnalyticsIntegrationTest {
    @Container static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:14-alpine");
    static R2dbcAnalyticsAdapter adapter;
    static DashboardService service;
    static final Duration TIMEOUT = Duration.ofSeconds(15);
    static final LocalDate DAY = LocalDate.of(2026,10,19);
    static final AnalyticsFilter OWN = new AnalyticsFilter(1L,DAY,DAY);

    static Connection connection() throws SQLException {
        return DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }
    @BeforeAll static void migrateAndSeed() throws Exception {
        Flyway.configure().dataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword())
                .locations("classpath:db/migration").load().migrate();
        var options = ConnectionFactoryOptions.builder().option(ConnectionFactoryOptions.DRIVER,"postgresql")
                .option(ConnectionFactoryOptions.HOST,postgres.getHost())
                .option(ConnectionFactoryOptions.PORT,postgres.getFirstMappedPort())
                .option(ConnectionFactoryOptions.DATABASE,postgres.getDatabaseName())
                .option(ConnectionFactoryOptions.USER,postgres.getUsername())
                .option(ConnectionFactoryOptions.PASSWORD,postgres.getPassword()).build();
        adapter = new R2dbcAnalyticsAdapter(DatabaseClient.create(ConnectionFactories.get(options)));
        service = new DashboardService(adapter);
        try (var c = connection(); var s = c.createStatement()) {
            s.execute("""
                INSERT INTO drivers(id,first_name,last_name,license_number) VALUES
                  (1,'Mismo','Nombre','TEST-1'), (2,'Mismo','Nombre','TEST-2');
                INSERT INTO vehicles(id,plate_number) VALUES (1,'TEST-1'),(2,'TEST-2');
                INSERT INTO routes(id,driver_id,vehicle_id,route_date,status,actual_start_time,actual_end_time,total_distance_km) VALUES
                  (11,1,1,'2026-10-19','COMPLETED','2026-10-19 15:00Z','2026-10-19 16:00Z',99),
                  (12,2,2,'2026-10-19','COMPLETED','2026-10-19 15:00Z','2026-10-19 16:00Z',88),
                  (13,1,1,'2026-10-20','COMPLETED','2026-10-20 15:00Z','2026-10-20 16:00Z',77),
                  (14,1,1,'2026-10-19','IN_PROGRESS','2026-10-19 18:00Z',NULL,66),
                  (15,2,2,'2026-10-19','PLANNED',NULL,NULL,55);
                INSERT INTO orders(id,tracking_number,status,driver_id,route_id,recipient_name,delivery_address,
                                   latitude,longitude,delivery_district,external_reference,created_at,estimated_delivery_window_end) VALUES
                  (101,'TEST-101','DELIVERED',2,11,'Receptor','Dirección',-12,-77,'Lima',NULL,'2026-10-18 02:00Z','2026-10-19 16:00Z'),
                  (102,'TEST-102','FAILED',1,11,'Receptor','Dirección',0,0,NULL,'20123456789','2026-10-18 02:00Z',NULL),
                  (103,'TEST-103','DELIVERED',2,12,'Receptor','Dirección',-12,-77,'Lima',NULL,'2026-10-19 20:00Z','2026-10-19 15:00Z'),
                  (104,'TEST-104','PENDING',1,NULL,'Receptor','Dirección',-12,-77,' ',NULL,'2026-10-20 04:59:59Z',NULL),
                  (105,'TEST-105','DELIVERED',1,13,'Receptor','Dirección',-12,-77,'Lima',NULL,'2026-10-19 20:00Z',NULL),
                  (106,'TEST-106','DELIVERED',1,14,'Receptor','Dirección',-12,-77,NULL,NULL,'2026-10-19 20:00Z',NULL),
                  (107,'TEST-107','PENDING',1,NULL,'Receptor','Dirección',-12,-77,'Lima',NULL,'2026-10-20 05:00Z',NULL);
                INSERT INTO order_business_data(order_id,recipient_ruc,customer_accepted,address_verified,coverage_verified,agreement_note,confirmed_by,confirmed_at) VALUES
                  (101,'20123456789',TRUE,TRUE,TRUE,'Prueba','actor','2026-10-19 14:00Z'),
                  (104,'20123456789',FALSE,FALSE,FALSE,'Prueba','actor',NULL);
                INSERT INTO delivery_proofs(order_id,image_url,signature_data_url,receiver_name,receiver_dni,latitude,longitude,verified_at,captured_at,received_at,image_sha256,signature_sha256) VALUES
                  (101,'photo','signature','Receptor','12345678',-12,-77,'2026-10-19 15:30Z','2026-10-19 15:29Z','2026-10-19 15:30Z',repeat('a',64),repeat('b',64)),
                  (103,'photo',NULL,NULL,NULL,NULL,NULL,'2026-10-19 15:30Z',NULL,'2026-10-19 15:30Z',NULL,NULL);
                INSERT INTO order_status_history(order_id,status,reason) VALUES
                  (102,'FAILED','Ausente'),(103,'FAILED','Ausente');
                INSERT INTO incidents(route_id,order_id,incident_type,description,resolution_reason) VALUES
                  (11,102,'FAILURE','Descripción','Cliente ausente'),
                  (11,NULL,'TRAFFIC','Tráfico',NULL),
                  (12,103,'FAILURE','Otra zona','Otra zona');
                INSERT INTO vehicle_gps_history(vehicle_id,driver_id,latitude,longitude,ping_time) VALUES
                  (1,1,-13,-77,'2026-10-19 14:59Z'),
                  (1,1,-12,-77,'2026-10-19 15:00Z'),
                  (1,1,0,0,'2026-10-19 15:05Z'),
                  (1,1,-12.01,-77,'2026-10-19 15:10Z'),
                  (1,1,-14,-77,'2026-10-19 16:01Z'),
                  (1,1,-12,-77,'2026-10-19 18:10Z'),
                  (2,2,-12,-77,'2026-10-19 15:00Z'),
                  (2,2,-12.02,-77,'2026-10-19 15:10Z');
                """);
        }
    }

    @Test void filtersUseRouteDateAndLimaMidnightAndRouteOwner() {
        Totals t = adapter.totals(OWN).block(TIMEOUT);
        assertThat(t.total()).isEqualTo(4); assertThat(t.valid()).isEqualTo(2);
        assertThat(t.scheduled()).isEqualTo(3); assertThat(t.deliveredScheduled()).isEqualTo(2);
        assertThat(t.evidenceScheduled()).isEqualTo(1); assertThat(t.completePod()).isEqualTo(1);
        assertThat(t.onTime()).isEqualTo(1); assertThat(t.delayed()).isZero();
        assertThat(t.evaluable()).isEqualTo(1); assertThat(t.missingRuc()).isEqualTo(2);
        assertThat(t.invalidGps()).isEqualTo(1); assertThat(t.unconfirmed()).isEqualTo(3);
        assertThat(adapter.daily(OWN).collectList().block(TIMEOUT)).singleElement().satisfies(d -> {
            assertThat(d.date()).isEqualTo(DAY); assertThat(d.totals()).isEqualTo(t);
        });
        assertThat(adapter.totals(new AnalyticsFilter(1L,DAY.plusDays(1),DAY.plusDays(1))).block(TIMEOUT).total()).isEqualTo(2);
        assertThat(adapter.totals(new AnalyticsFilter(1L,DAY,null)).block(TIMEOUT).total()).isEqualTo(6);
        assertThat(adapter.totals(new AnalyticsFilter(1L,null,DAY)).block(TIMEOUT).total()).isEqualTo(4);
        assertThat(adapter.totals(new AnalyticsFilter(2L,DAY,DAY)).block(TIMEOUT).total()).isEqualTo(1);
        assertThat(adapter.totals(new AnalyticsFilter(null,null,null)).block(TIMEOUT).total()).isEqualTo(7);
    }
    @Test void districtsAndSameNameDriversRemainDistinctAndCausesDoNotMultiply() {
        assertThat(adapter.byDistrict(OWN).collectList().block(TIMEOUT)).contains(new NameCount("Sin distrito",3L));
        var drivers = adapter.byDriver(new AnalyticsFilter(null,DAY,DAY)).collectList().block(TIMEOUT);
        assertThat(drivers).hasSize(2).extracting(DriverCount::driverId).containsExactly(1L,2L);
        assertThat(adapter.causes(OWN).collectList().block(TIMEOUT)).containsExactlyInAnyOrder(
                new Cause("STATUS_HISTORY","Ausente",1),new Cause("INCIDENT","Cliente ausente",1),new Cause("INCIDENT","Tráfico",1));
        assertThat(adapter.ordersByStatus(OWN).collectList().block(TIMEOUT)).containsExactlyInAnyOrder(
                new StatusCount("DELIVERED",2L),new StatusCount("FAILED",1L),new StatusCount("PENDING",1L));
    }
    @Test void gpsQualityDoesNotBridgeInvalidSamplesOrUsePlannedDistance() {
        var rows = adapter.efficiency(OWN).collectList().block(TIMEOUT);
        assertThat(rows).hasSize(2);
        RouteEfficiency r = rows.get(0);
        assertThat(r.routeId()).isEqualTo(11); assertThat(r.orderCount()).isEqualTo(2);
        assertThat(r.plannedDistanceKm()).isEqualTo(99);
        assertThat(r.actualGpsDistanceKm()).isNull();
        assertThat(r.kmPerDelivery()).isNull();
        assertThat(r.operationMinutes()).isEqualTo(60); assertThat(r.timePerStopMin()).isEqualTo(30);
        assertThat(r.distanceSource()).isEqualTo("UNAVAILABLE");
        assertThat(r.gpsQuality().status()).isEqualTo("INVALID_COORDINATES");
        assertThat(r.gpsQuality().sampleCount()).isEqualTo(3);
        assertThat(r.gpsQuality().invalidSampleCount()).isEqualTo(1);
        assertThat(r.gpsQuality().observedDistanceKm()).isNull();
        RouteEfficiency singlePoint = rows.get(1);
        assertThat(singlePoint.actualGpsDistanceKm()).isNull(); assertThat(singlePoint.operationMinutes()).isNull();
        assertThat(singlePoint.kmPerDelivery()).isNull(); assertThat(singlePoint.timePerStopMin()).isNull();
        assertThat(singlePoint.distanceSource()).isEqualTo("UNAVAILABLE");
        assertThat(singlePoint.gpsQuality().status()).isEqualTo("INSUFFICIENT_SAMPLES");
        assertThat(adapter.efficiency(new AnalyticsFilter(2L,DAY,DAY)).collectList().block(TIMEOUT))
                .filteredOn(e -> e.routeId() == 12).singleElement().satisfies(e -> {
                    assertThat(e.actualGpsDistanceKm()).isCloseTo(2.2239016,within(0.00001));
                    assertThat(e.distanceSource()).isEqualTo("GPS_HAVERSINE");
                    assertThat(e.gpsQuality().status()).isEqualTo("AVAILABLE");
                });
        assertThat(adapter.efficiency(new AnalyticsFilter(2L,DAY,DAY)).collectList().block(TIMEOUT))
                .filteredOn(e -> e.routeId() == 15).singleElement().satisfies(e -> {
                    assertThat(e.orderCount()).isZero(); assertThat(e.actualGpsDistanceKm()).isNull();
                });
    }
    @Test void returnedOrdersCountAsTerminalStopsWithoutChangingSharedSeed() throws Exception {
        // Separate container: these facts cannot change global totals or test-order expectations.
        try (var isolated = new PostgreSQLContainer<>("postgres:14-alpine")) {
            isolated.start();
            Flyway.configure().dataSource(isolated.getJdbcUrl(),isolated.getUsername(),isolated.getPassword())
                    .locations("classpath:db/migration").load().migrate();
            try (var c = DriverManager.getConnection(isolated.getJdbcUrl(),isolated.getUsername(),isolated.getPassword());
                 var s = c.createStatement()) {
                s.execute("""
                    INSERT INTO drivers(id,first_name,last_name,license_number) VALUES (901,'Terminal','Returned','RETURNED-901');
                    INSERT INTO vehicles(id,plate_number) VALUES (901,'RETURNED-901');
                    INSERT INTO routes(id,driver_id,vehicle_id,route_date,status,actual_start_time,actual_end_time) VALUES
                      (901,901,901,'2026-10-19','COMPLETED','2026-10-19 15:00Z','2026-10-19 16:00Z');
                    INSERT INTO orders(id,tracking_number,status,driver_id,route_id) VALUES
                      (901,'RETURNED-DELIVERED','DELIVERED',901,901),
                      (902,'RETURNED-FAILED','FAILED',901,901),
                      (903,'RETURNED-RETURNED','RETURNED',901,901);
                    INSERT INTO order_status_history(order_id,status,reason,changed_by)
                      VALUES(903,'RETURNED','Devolucion autorizada','test-actor');
                    """);
                var facts = s.executeQuery("""
                    SELECT order_count,delivered_count,terminal_stop_count,operation_minutes,time_per_stop_min
                    FROM analytics_route_facts WHERE route_id=901
                    """);
                assertThat(facts.next()).isTrue();
                assertThat(facts.getLong("order_count")).isEqualTo(3);
                assertThat(facts.getLong("delivered_count")).isEqualTo(1);
                assertThat(facts.getLong("terminal_stop_count")).isEqualTo(3);
                assertThat(facts.getDouble("operation_minutes")).isEqualTo(60);
                assertThat(facts.getDouble("time_per_stop_min")).isEqualTo(20);
            }
            var options = ConnectionFactoryOptions.builder().option(ConnectionFactoryOptions.DRIVER,"postgresql")
                    .option(ConnectionFactoryOptions.HOST,isolated.getHost())
                    .option(ConnectionFactoryOptions.PORT,isolated.getFirstMappedPort())
                    .option(ConnectionFactoryOptions.DATABASE,isolated.getDatabaseName())
                    .option(ConnectionFactoryOptions.USER,isolated.getUsername())
                    .option(ConnectionFactoryOptions.PASSWORD,isolated.getPassword()).build();
            var isolatedAdapter = new R2dbcAnalyticsAdapter(DatabaseClient.create(ConnectionFactories.get(options)));
            var returnedFilter = new AnalyticsFilter(901L,DAY,DAY);
            var returnedBi = new DashboardService(isolatedAdapter).getBi(returnedFilter).block(TIMEOUT);
            assertThat(returnedBi.kpis()).extracting(Kpi::denominator).containsExactly(3L,3L,3L,3L,0L);
            assertThat(returnedBi.kpis()).extracting(Kpi::numerator).containsExactly(0L,1L,0L,1L,0L);
            assertThat(returnedBi.kpis()).extracting(Kpi::percentage).containsExactly(new BigDecimal("0.00"),
                    new BigDecimal("33.33"),new BigDecimal("0.00"),new BigDecimal("33.33"),null);
            assertThat(returnedBi.kpis()).allSatisfy(k -> {assertThat(k.target()).isNull(); assertThat(k.gap()).isNull();});
            assertThat(isolatedAdapter.causes(returnedFilter).collectList().block(TIMEOUT))
                    .contains(new Cause("STATUS_HISTORY","Devolucion autorizada",1));
            assertThat(isolatedAdapter.efficiency(new AnalyticsFilter(901L,DAY,DAY)).collectList().block(TIMEOUT))
                    .singleElement().satisfies(route -> {
                        assertThat(route.routeId()).isEqualTo(901);
                        assertThat(route.orderCount()).isEqualTo(3);
                        assertThat(route.operationMinutes()).isEqualTo(60);
                        assertThat(route.timePerStopMin()).isEqualTo(20);
                        assertThat(route.actualGpsDistanceKm()).isNull();
                    });
        }
    }
    @Test void emptyPeriodProducesFiveNullPercentagesAndNoSyntheticTarget() {
        var bi = service.getBi(new AnalyticsFilter(null,DAY.minusYears(1),DAY.minusYears(1))).block(TIMEOUT);
        assertThat(bi.kpis()).hasSize(5).allSatisfy(k -> assertThat(k.percentage()).isNull());
        assertThat(bi.trends()).isEmpty(); assertThat(bi.efficiency()).isEmpty();
        assertThat(bi.quality().totalOrders()).isZero();
        assertThat(service.getGoal("TDE").block(TIMEOUT).target()).isNull();
    }
    @Test void fullBiReportUsesRealCountersAndQuality() {
        var r = service.getBi(OWN).block(TIMEOUT);
        assertThat(r.kpis()).extracting(Kpi::percentage).containsExactly(new BigDecimal("50.00"),
                new BigDecimal("66.67"),new BigDecimal("33.33"),new BigDecimal("50.00"),new BigDecimal("100.00"));
        assertThat(r.quality().routesWithoutGps()).isEqualTo(2);
        assertThat(r.quality().unverifiedAddressOrders()).isEqualTo(3);
        assertThat(r.quality().unverifiedCoverageOrders()).isEqualTo(3);
    }
    @Test void httpBiAndSummaryReadActualSqlWithTheSameInclusiveFilters() {
        var http = WebTestClient.bindToController(new DashboardController(service),new ReportController(service))
                .controllerAdvice(new RestExceptionHandler()).build();
        String params = "?driverId=1&startDate=2026-10-19&endDate=2026-10-19";
        http.get().uri("/reports/bi"+params).exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.kpis.length()").isEqualTo(5)
                .jsonPath("$.kpis[0].percentage").isEqualTo(50)
                .jsonPath("$.kpis[2].percentage").isEqualTo(33.33)
                .jsonPath("$.quality.totalOrders").isEqualTo(4)
                .jsonPath("$.byDistrict[1].name").isEqualTo("Sin distrito")
                .jsonPath("$.efficiency[1].actualGpsDistanceKm").isEmpty();
        http.get().uri("/reports/orders-summary?driverId=1&startDate=2025-01-01&endDate=2025-01-01")
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.ordersByStatus").isEmpty().jsonPath("$.onTimeDeliveries").isEqualTo(0)
                .jsonPath("$.delayedDeliveries").isEqualTo(0);
        http.get().uri("/reports/goals/TDE").exchange().expectStatus().isOk().expectBody().jsonPath("$.target").isEmpty();
        http.get().uri("/reports/goals/UNKNOWN").exchange().expectStatus().isBadRequest();
    }
    @Test void goalsPersistAndAuditEveryChangeWithActorAndTime() throws Exception {
        Goal first = service.saveGoal("IID",BigDecimal.ZERO,"subject-1").block(TIMEOUT);
        Goal second = service.saveGoal("IID",new BigDecimal("100"),"subject-2").block(TIMEOUT);
        Goal cleared = service.saveGoal("IID",null,"subject-3").block(TIMEOUT);
        assertThat(first.updatedAt()).isNotNull(); assertThat(second.updatedAt()).isAfterOrEqualTo(first.updatedAt());
        assertThat(cleared.target()).isNull(); assertThat(cleared.updatedBy()).isEqualTo("subject-3");
        assertThat(service.getGoal("IID").block(TIMEOUT)).isEqualTo(cleared);
        try (var c = connection(); var s = c.createStatement()) {
            var rs = s.executeQuery("SELECT count(*),count(DISTINCT changed_by) FROM analytics_goal_history WHERE code='IID'");
            rs.next(); assertThat(rs.getLong(1)).isEqualTo(3); assertThat(rs.getLong(2)).isEqualTo(3);
            assertThatThrownBy(() -> s.executeUpdate("UPDATE analytics_goals SET target=101 WHERE code='IID'"))
                    .isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> s.executeUpdate("UPDATE analytics_goal_history SET target=42 WHERE code='IID'"))
                    .isInstanceOf(SQLException.class).hasMessageContaining("inmutable");
        }
    }
    @Test void goalHttpPutPersistsAndRejectsOutOfRangeValues() {
        var http = WebTestClient.bindToController(new ReportController(service))
                .controllerAdvice(new RestExceptionHandler())
                .webFilter((exchange,chain) -> chain.filter(exchange.mutate()
                        .principal(reactor.core.publisher.Mono.just((java.security.Principal) () -> "http-test-subject")).build()))
                .build();
        http.put().uri("/reports/goals/CHR").bodyValue(new ReportController.GoalRequest(new BigDecimal("87.5")))
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.target").isEqualTo(87.5).jsonPath("$.updatedBy").isEqualTo("http-test-subject");
        http.get().uri("/reports/goals/CHR").exchange().expectStatus().isOk().expectBody().jsonPath("$.target").isEqualTo(87.5);
        http.put().uri("/reports/goals/CHR").bodyValue(new ReportController.GoalRequest(new BigDecimal("100.01")))
                .exchange().expectStatus().isBadRequest();
        http.put().uri("/reports/goals/CHR").bodyValue(new ReportController.GoalRequest(new BigDecimal("-0.01")))
                .exchange().expectStatus().isBadRequest();
        http.get().uri("/reports/goals/CHR").exchange().expectStatus().isOk().expectBody().jsonPath("$.target").isEqualTo(87.5);
    }
    @Test void biReaderCanSelectViewsButCannotReadOrMutateBaseTables() throws Exception {
        try (var c = connection(); var s = c.createStatement()) {
            s.execute("SET ROLE ecoroute_bi_reader");
            for (String view : new String[]{"analytics_order_facts","analytics_route_facts","analytics_goal_facts","analytics_goal_history_facts"})
                assertThat(s.executeQuery("SELECT count(*) FROM " + view).next()).isTrue();
            assertThatThrownBy(() -> s.executeQuery("SELECT * FROM orders")).isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> s.executeUpdate("UPDATE analytics_goals SET target=1")).isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> s.executeUpdate("UPDATE analytics_order_facts SET recipient_name='x'"))
                    .isInstanceOf(SQLException.class);
            s.execute("RESET ROLE");
            var rs = s.executeQuery("SELECT rolcanlogin,rolsuper,rolcreaterole FROM pg_roles WHERE rolname='ecoroute_bi_reader'");
            rs.next(); assertThat(rs.getBoolean(1)).isFalse(); assertThat(rs.getBoolean(2)).isFalse(); assertThat(rs.getBoolean(3)).isFalse();
        }
    }
}
