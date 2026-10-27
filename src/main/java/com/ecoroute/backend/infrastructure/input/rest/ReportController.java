package com.ecoroute.backend.infrastructure.input.rest;

import com.ecoroute.backend.application.services.DashboardService;
import com.ecoroute.backend.domain.model.analytics.AnalyticsFilter;
import com.ecoroute.backend.domain.model.analytics.AnalyticsModels.*;
import java.math.BigDecimal;
import java.security.Principal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/reports")
@RequiredArgsConstructor
public class ReportController {
    private final DashboardService dashboardService;

    @GetMapping("/orders-summary")
    public Mono<OrderSummary> getOrdersSummary(@ModelAttribute AnalyticsFilter filter) {
        return dashboardService.getSummary(filter);
    }

    @GetMapping("/driver-performance")
    public Flux<NameCount> getDriverPerformance(@ModelAttribute AnalyticsFilter filter) {
        return dashboardService.getDeliveriesByDriver(filter);
    }

    @GetMapping("/route-efficiency")
    public Flux<RouteEfficiency> getRouteEfficiency(@ModelAttribute AnalyticsFilter filter) {
        return dashboardService.getRouteEfficiency(filter);
    }

    @GetMapping("/bi")
    public Mono<BiReport> getBi(@ModelAttribute AnalyticsFilter filter) {
        return dashboardService.getBi(filter);
    }

    @GetMapping("/goals/{code}")
    public Mono<Goal> getGoal(@PathVariable String code) {
        return dashboardService.getGoal(code);
    }

    @PutMapping("/goals/{code}")
    public Mono<Goal> saveGoal(@PathVariable String code, @RequestBody GoalRequest request, Principal principal) {
        if (principal == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return dashboardService.saveGoal(code, request.target(), principal.getName());
    }

    public record GoalRequest(BigDecimal target) {}
}
