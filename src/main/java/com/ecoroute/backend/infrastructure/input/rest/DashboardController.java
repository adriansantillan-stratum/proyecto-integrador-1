package com.ecoroute.backend.infrastructure.input.rest;

import com.ecoroute.backend.application.services.DashboardService;
import com.ecoroute.backend.domain.model.analytics.AnalyticsFilter;
import com.ecoroute.backend.domain.model.analytics.AnalyticsModels.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
public class DashboardController {
    private final DashboardService dashboardService;

    @GetMapping("/orders-by-status")
    public Flux<StatusCount> getOrderStats(@ModelAttribute AnalyticsFilter filter) {
        return dashboardService.getOrderStats(filter.driverId(), filter.startDate(), filter.endDate());
    }

    @GetMapping("/delivery-performance")
    public Mono<DeliveryPerformance> getDeliveryPerformance(@ModelAttribute AnalyticsFilter filter) {
        return dashboardService.getDeliveryPerformance(filter);
    }

    @GetMapping("/deliveries-by-driver")
    public Flux<NameCount> getDeliveriesByDriver(@ModelAttribute AnalyticsFilter filter) {
        return dashboardService.getDeliveriesByDriver(filter);
    }

    @GetMapping("/orders-by-district")
    public Flux<NameCount> getOrdersByDistrict(@ModelAttribute AnalyticsFilter filter) {
        return dashboardService.getOrdersByDistrict(filter);
    }
}
