package com.ecoroute.backend.application.services;

import com.ecoroute.backend.domain.model.analytics.AnalyticsFilter;
import com.ecoroute.backend.domain.model.analytics.AnalyticsModels.*;
import com.ecoroute.backend.domain.ports.out.AnalyticsQueryPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final AnalyticsQueryPort analytics;

    public Flux<StatusCount> getOrderStats(Long driverId, LocalDate start, LocalDate end) {
        return analytics.ordersByStatus(new AnalyticsFilter(driverId, start, end));
    }
    public Mono<DeliveryPerformance> getDeliveryPerformance(AnalyticsFilter filter) {
        return analytics.totals(filter).map(t -> new DeliveryPerformance(t.onTime(), t.delayed()));
    }
    public Flux<NameCount> getDeliveriesByDriver(AnalyticsFilter filter) {
        return analytics.byDriver(filter).map(d -> new NameCount(d.name(), d.count()));
    }
    public Flux<NameCount> getOrdersByDistrict(AnalyticsFilter filter) { return analytics.byDistrict(filter); }
    public Flux<RouteEfficiency> getRouteEfficiency(AnalyticsFilter filter) { return analytics.efficiency(filter); }
    public Mono<OrderSummary> getSummary(AnalyticsFilter filter) {
        return Mono.zip(analytics.ordersByStatus(filter).collectList(), analytics.totals(filter))
                .map(t -> new OrderSummary(t.getT1(), t.getT2().onTime(), t.getT2().delayed()));
    }
    public Mono<Goal> getGoal(String code) {
        String canonical = Indicator.parse(code).name();
        return analytics.goals().filter(g -> canonical.equals(g.code())).single();
    }
    public Mono<Goal> saveGoal(String code, BigDecimal target, String actor) {
        Indicator indicator = Indicator.parse(code);
        if (target != null && (target.signum() < 0 || target.compareTo(BigDecimal.valueOf(100)) > 0))
            throw new IllegalArgumentException("La meta debe estar entre 0 y 100");
        if (actor == null || actor.isBlank() || actor.length() > 100)
            throw new IllegalArgumentException("Actor de meta ausente o inválido");
        return analytics.saveGoal(indicator, target, actor);
    }
    public Mono<BiReport> getBi(AnalyticsFilter filter) {
        return Mono.zip(analytics.totals(filter), analytics.daily(filter).collectList(),
                analytics.byDriver(filter).collectList(), analytics.byDistrict(filter).collectList(),
                analytics.causes(filter).collectList(), analytics.efficiency(filter).collectList(), analytics.goals().collectList())
                .map(t -> {
                    Totals a = t.getT1();
                    List<Goal> goals = t.getT7();
                    return new BiReport(filter.driverId(), filter.startDate(), filter.endDate(), "America/Lima",
                            kpis(a, goals), t.getT2().stream().map(d -> new DailyTrend(d.date(), kpis(d.totals(), goals))).toList(),
                            t.getT3(), t.getT4(), t.getT5(), t.getT6(), goals,
                            new Quality(a.total(), a.scheduled(), a.completePod(), a.missingRuc(), a.invalidGps(),
                                    a.missingWindow(), t.getT6().stream().filter(r -> r.actualGpsDistanceKm() == null).count(),
                                    a.unconfirmed(), a.unverifiedAddress(), a.unverifiedCoverage()));
                });
    }
    private List<Kpi> kpis(Totals t, List<Goal> goals) {
        return java.util.Arrays.stream(Indicator.values()).map(i -> {
            BigDecimal target = goals.stream().filter(g -> i.name().equals(g.code())).findFirst().map(Goal::target).orElse(null);
            return switch (i) {
                case IID -> Kpi.of(i, t.valid(), t.total(), target);
                case CHR -> Kpi.of(i, t.deliveredScheduled(), t.scheduled(), target);
                case TDE -> Kpi.of(i, t.evidenceScheduled(), t.scheduled(), target);
                case SUCCESS -> Kpi.of(i, t.delivered(), t.total(), target);
                case ONTIME -> Kpi.of(i, t.onTime(), t.evaluable(), target);
            };
        }).toList();
    }
}
