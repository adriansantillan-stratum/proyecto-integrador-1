package com.ecoroute.backend.domain.ports.out;

import com.ecoroute.backend.domain.model.analytics.AnalyticsFilter;
import com.ecoroute.backend.domain.model.analytics.AnalyticsModels.*;
import java.math.BigDecimal;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface AnalyticsQueryPort {
    Flux<StatusCount> ordersByStatus(AnalyticsFilter filter);
    Mono<Totals> totals(AnalyticsFilter filter);
    Flux<DailyTotals> daily(AnalyticsFilter filter);
    Flux<DriverCount> byDriver(AnalyticsFilter filter);
    Flux<NameCount> byDistrict(AnalyticsFilter filter);
    Flux<Cause> causes(AnalyticsFilter filter);
    Flux<RouteEfficiency> efficiency(AnalyticsFilter filter);
    Flux<Goal> goals();
    Mono<Goal> saveGoal(Indicator code, BigDecimal target, String actor);
}
