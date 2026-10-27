package com.ecoroute.backend.infrastructure.input.rest;

import com.ecoroute.backend.application.services.DashboardService;
import com.ecoroute.backend.domain.model.analytics.AnalyticsFilter;
import com.ecoroute.backend.domain.model.analytics.AnalyticsModels.*;
import com.ecoroute.backend.infrastructure.exception.RestExceptionHandler;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import static org.mockito.Mockito.*;

class AnalyticsControllerTest {
    private final DashboardService service = mock(DashboardService.class);
    private WebTestClient client;
    private final AnalyticsFilter filter = new AnalyticsFilter(7L,LocalDate.of(2026,10,19),LocalDate.of(2026,10,19));
    private final String params = "?driverId=7&startDate=2026-10-19&endDate=2026-10-19";

    @BeforeEach void setUp() {
        client = WebTestClient.bindToController(new DashboardController(service),new ReportController(service))
                .controllerAdvice(new RestExceptionHandler()).build();
    }
    @Test void allExistingRoutesBindIsoDatesAndPreserveWireFields() {
        when(service.getOrderStats(7L,filter.startDate(),filter.endDate())).thenReturn(Flux.just(new StatusCount("DELIVERED",1L)));
        when(service.getDeliveryPerformance(filter)).thenReturn(Mono.just(new DeliveryPerformance(1,0)));
        when(service.getDeliveriesByDriver(filter)).thenReturn(Flux.just(new NameCount("Conductor",1L)));
        when(service.getOrdersByDistrict(filter)).thenReturn(Flux.just(new NameCount("Sin distrito",1L)));
        when(service.getSummary(filter)).thenReturn(Mono.just(new OrderSummary(java.util.List.of(new StatusCount("DELIVERED",1L)),1,0)));
        when(service.getRouteEfficiency(filter)).thenReturn(Flux.just(new RouteEfficiency(2L,"Ruta 2",1,null,null,null,null,null,"UNAVAILABLE")));
        client.get().uri("/dashboard/orders-by-status"+params).exchange().expectStatus().isOk().expectBody().jsonPath("$[0].status").isEqualTo("DELIVERED");
        client.get().uri("/dashboard/delivery-performance"+params).exchange().expectStatus().isOk().expectBody().jsonPath("$.onTime").isEqualTo(1);
        for (String path : new String[]{"/dashboard/deliveries-by-driver","/reports/driver-performance"})
            client.get().uri(path+params).exchange().expectStatus().isOk().expectBody().jsonPath("$[0].name").isEqualTo("Conductor");
        client.get().uri("/dashboard/orders-by-district"+params).exchange().expectStatus().isOk().expectBody().jsonPath("$[0].name").isEqualTo("Sin distrito");
        client.get().uri("/reports/orders-summary"+params).exchange().expectStatus().isOk().expectBody().jsonPath("$.onTimeDeliveries").isEqualTo(1);
        client.get().uri("/reports/route-efficiency"+params).exchange().expectStatus().isOk().expectBody()
                .jsonPath("$[0].routeId").isEqualTo(2).jsonPath("$[0].actualGpsDistanceKm").isEmpty();
        verify(service).getRouteEfficiency(filter);
    }
    @Test void optionalFiltersBindNull() {
        when(service.getOrdersByDistrict(new AnalyticsFilter(null,null,null))).thenReturn(Flux.empty());
        client.get().uri("/dashboard/orders-by-district").exchange().expectStatus().isOk().expectBody().json("[]");
    }
    @Test void invalidRangeIsBadRequest() {
        client.get().uri("/reports/bi?startDate=2026-10-20&endDate=2026-10-19").exchange().expectStatus().isBadRequest();
    }
}
