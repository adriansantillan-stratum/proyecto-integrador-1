package com.ecoroute.backend.application.services;

import com.ecoroute.backend.domain.model.analytics.AnalyticsFilter;
import com.ecoroute.backend.domain.model.analytics.AnalyticsModels.*;
import com.ecoroute.backend.domain.ports.out.AnalyticsQueryPort;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class DashboardAnalyticsServiceTest {
    private final AnalyticsQueryPort port = mock(AnalyticsQueryPort.class);
    private final DashboardService service = new DashboardService(port);
    private final AnalyticsFilter filter = new AnalyticsFilter(7L, LocalDate.of(2026,10,19), LocalDate.of(2026,10,19));

    @BeforeEach
    void setUp() {
        when(port.totals(filter)).thenReturn(Mono.just(Totals.empty()));
        when(port.daily(filter)).thenReturn(Flux.empty());
        when(port.byDriver(filter)).thenReturn(Flux.empty());
        when(port.byDistrict(filter)).thenReturn(Flux.empty());
        when(port.causes(filter)).thenReturn(Flux.empty());
        when(port.efficiency(filter)).thenReturn(Flux.empty());
        when(port.goals()).thenReturn(Flux.fromIterable(Arrays.stream(Indicator.values())
                .map(i -> new Goal(i.name(), null, null, null)).toList()));
    }
    @Test
    void biUsesIdenticalFilterAndZeroDenominatorsStayNull() {
        StepVerifier.create(service.getBi(filter)).assertNext(report -> {
            assertThat(report.timezone()).isEqualTo("America/Lima");
            assertThat(report.kpis()).hasSize(5).allSatisfy(k -> {
                assertThat(k.percentage()).isNull(); assertThat(k.target()).isNull();
                assertThat(k.gap()).isNull(); assertThat(k.status()).isEqualTo("NO_DATA");
            });
            assertThat(report.goals()).hasSize(5);
        }).verifyComplete();
        verify(port).totals(filter); verify(port).daily(filter); verify(port).byDriver(filter);
        verify(port).byDistrict(filter); verify(port).causes(filter); verify(port).efficiency(filter);
    }
    @Test
    void formulasUseDifferentUniversesAndTrendsUseTheSameFormula() {
        Totals totals = new Totals(10,6,8,4,5,5,2,1,3,1,4,2,3,1,2,3);
        when(port.totals(filter)).thenReturn(Mono.just(totals));
        when(port.daily(filter)).thenReturn(Flux.just(new DailyTotals(filter.startDate(), totals)));
        when(port.goals()).thenReturn(Flux.just(new Goal("IID", new BigDecimal("70"), "actor", null)));
        StepVerifier.create(service.getBi(filter)).assertNext(r -> {
            assertThat(r.kpis()).extracting(Kpi::percentage)
                    .containsExactly(new BigDecimal("60.00"),new BigDecimal("50.00"),new BigDecimal("62.50"),
                            new BigDecimal("50.00"),new BigDecimal("66.67"));
            assertThat(r.kpis().get(0).gap()).isEqualByComparingTo("-10");
            assertThat(r.kpis().get(0).status()).isEqualTo("BELOW_TARGET");
            assertThat(r.kpis().get(1).status()).isEqualTo("NO_TARGET");
            assertThat(r.trends().get(0).kpis()).isEqualTo(r.kpis());
            assertThat(r.quality().completePodOrders()).isEqualTo(1);
        }).verifyComplete();
    }
    @Test
    void summaryAndLegacyMethodsPassAllFilters() {
        when(port.ordersByStatus(filter)).thenReturn(Flux.just(new StatusCount("PENDING", 1L)));
        StepVerifier.create(service.getSummary(filter)).assertNext(s -> {
            assertThat(s.ordersByStatus()).containsExactly(new StatusCount("PENDING",1L));
            assertThat(s.onTimeDeliveries()).isZero(); assertThat(s.delayedDeliveries()).isZero();
        }).verifyComplete();
        StepVerifier.create(service.getOrderStats(7L,filter.startDate(),filter.endDate())).expectNextCount(1).verifyComplete();
        verify(port,times(2)).ordersByStatus(filter);
    }
    @Test
    void invalidFiltersAndGoalsAreRejectedBeforePersistence() {
        assertThatThrownBy(() -> new AnalyticsFilter(0L,null,null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AnalyticsFilter(null,filter.endDate().plusDays(1),filter.endDate()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.saveGoal("IID",new BigDecimal("100.01"),"actor")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.saveGoal("IID",new BigDecimal("-0.01"),"actor")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.saveGoal("OTHER",BigDecimal.TEN,"actor")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.saveGoal("IID",BigDecimal.TEN," ")).isInstanceOf(IllegalArgumentException.class);
        verify(port,never()).saveGoal(any(),any(),any());
    }
    @Test
    void goalBoundaryValuesAndClearingArePersistedWithActor() {
        for (BigDecimal value : new BigDecimal[]{BigDecimal.ZERO,new BigDecimal("100"),null}) {
            when(port.saveGoal(Indicator.IID,value,"jwt-subject")).thenReturn(Mono.just(new Goal("IID",value,"jwt-subject",null)));
            StepVerifier.create(service.saveGoal("iid",value,"jwt-subject"))
                    .assertNext(g -> { assertThat(g.target()).isEqualTo(value); assertThat(g.updatedBy()).isEqualTo("jwt-subject"); })
                    .verifyComplete();
            verify(port).saveGoal(Indicator.IID,value,"jwt-subject");
        }
    }
}
