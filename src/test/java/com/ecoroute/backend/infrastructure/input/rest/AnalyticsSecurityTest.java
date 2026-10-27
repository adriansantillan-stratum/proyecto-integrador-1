package com.ecoroute.backend.infrastructure.input.rest;

import com.ecoroute.backend.application.services.DashboardService;
import com.ecoroute.backend.domain.model.analytics.AnalyticsModels.Goal;
import com.ecoroute.backend.infrastructure.config.SecurityConfig;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.WebFluxTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.reactive.server.SecurityMockServerConfigurers.mockJwt;

@WebFluxTest(controllers = {DashboardController.class, ReportController.class},
        properties = "ecoroute.rate-limit.enabled=false")
@Import(SecurityConfig.class)
class AnalyticsSecurityTest {
    @Autowired WebTestClient client;
    @MockitoBean DashboardService service;
    @MockitoBean ReactiveJwtDecoder decoder;

    @Test void anonymousCannotReadBiOrGoals() {
        client.get().uri("/reports/bi").exchange().expectStatus().isUnauthorized();
        client.get().uri("/reports/goals/IID").exchange().expectStatus().isUnauthorized();
    }
    @Test @WithMockUser(roles="DRIVER") void driverCannotReadOrChangeGlobalAnalytics() {
        client.get().uri("/reports/bi").exchange().expectStatus().isForbidden();
        client.get().uri("/dashboard/orders-by-status").exchange().expectStatus().isForbidden();
        client.put().uri("/reports/goals/IID").bodyValue(new ReportController.GoalRequest(BigDecimal.TEN))
                .exchange().expectStatus().isForbidden();
        verifyNoInteractions(service);
    }
    @Test @WithMockUser(roles="DISPATCHER") void dispatcherCannotReadGlobalAnalytics() {
        client.get().uri("/reports/bi").exchange().expectStatus().isForbidden();
    }
    @Test void adminGoalWriteUsesAuthenticatedSubject() {
        when(service.saveGoal("IID",BigDecimal.TEN,"jwt-subject"))
                .thenReturn(Mono.just(new Goal("IID",BigDecimal.TEN,"jwt-subject",null)));
        client.mutateWith(mockJwt().jwt(jwt -> jwt.subject("jwt-subject"))
                        .authorities(new SimpleGrantedAuthority("ROLE_ADMIN")))
                .put().uri("/reports/goals/IID").bodyValue(new ReportController.GoalRequest(BigDecimal.TEN))
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.target").isEqualTo(10).jsonPath("$.updatedBy").isEqualTo("jwt-subject");
        verify(service).saveGoal("IID",BigDecimal.TEN,"jwt-subject");
    }
    @Test @WithMockUser(roles="ADMIN") void adminCanReadAnUnconfiguredGoalAsNull() {
        when(service.getGoal("CHR")).thenReturn(Mono.just(new Goal("CHR",null,null,null)));
        client.get().uri("/reports/goals/CHR").exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.code").isEqualTo("CHR").jsonPath("$.target").isEmpty();
    }
}
