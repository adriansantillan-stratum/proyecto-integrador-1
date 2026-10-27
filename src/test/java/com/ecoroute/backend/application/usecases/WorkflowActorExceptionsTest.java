package com.ecoroute.backend.application.usecases;

import com.ecoroute.backend.application.services.BusinessOperationsService;
import com.ecoroute.backend.application.services.BusinessWorkflowService;
import com.ecoroute.backend.domain.model.BusinessWorkflow.Review;
import com.ecoroute.backend.domain.ports.out.BusinessWorkflowPort;
import com.ecoroute.backend.infrastructure.config.SecurityConfig;
import com.ecoroute.backend.infrastructure.input.rest.BusinessOperationsController;
import com.ecoroute.backend.infrastructure.input.rest.BusinessWorkflowController;
import com.ecoroute.backend.infrastructure.security.OperationalAccess;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.WebFluxTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.reactive.server.SecurityMockServerConfigurers.mockJwt;

/** In-process HTTP handler tests, never contacts a running API or identity provider. */
@WebFluxTest(controllers={BusinessWorkflowController.class,BusinessOperationsController.class},
        properties="ecoroute.rate-limit.enabled=false")
@Import(SecurityConfig.class)
class WorkflowActorExceptionsTest {
    @Autowired WebTestClient client;
    @MockitoBean BusinessWorkflowService service;
    @MockitoBean BusinessOperationsService operations;
    @MockitoBean BusinessWorkflowPort workflow;
    @MockitoBean OperationalAccess access;
    @MockitoBean ReactiveJwtDecoder decoder;
    WebTestClient actor(String role) {
        return client.mutateWith(mockJwt().jwt(jwt -> jwt.subject("synthetic-subject"))
                .authorities(new SimpleGrantedAuthority("ROLE_"+role)));
    }
    @Test void anonymousCannotApproveOrResolve() {
        client.post().uri("/routes/21/review").bodyValue(new BusinessWorkflowController.ReviewRequest(true,true,true,100.0,"Plan de prueba"))
                .exchange().expectStatus().isUnauthorized();
        client.patch().uri("/incidents/51/resolution").bodyValue(new BusinessOperationsController.Resolution("RETRY","Motivo de prueba",null))
                .exchange().expectStatus().isUnauthorized();
        verifyNoInteractions(service,operations,workflow,access);
    }
    @Test void dispatcherCannotApproveManagementPlan() {
        actor("DISPATCHER").post().uri("/routes/21/review")
                .bodyValue(new BusinessWorkflowController.ReviewRequest(true,true,true,100.0,"Plan de prueba"))
                .exchange().expectStatus().isForbidden();
        verifyNoInteractions(service,access);
    }
    @Test void administratorCannotImpersonateDriverAcceptance() {
        actor("ADMIN").post().uri("/routes/21/acceptance").exchange().expectStatus().isForbidden();
        verifyNoInteractions(service,access);
    }
    @Test void driverCannotResolveOperationalIncident() {
        actor("DRIVER").patch().uri("/incidents/51/resolution")
                .bodyValue(new BusinessOperationsController.Resolution("RETRY","Motivo de prueba",null))
                .exchange().expectStatus().isForbidden();
        verifyNoInteractions(operations,access);
    }
    @Test void administratorApprovalUsesAuthenticatedSubject() {
        when(access.authentication()).thenReturn(ReactiveSecurityContextHolder.getContext().map(c -> c.getAuthentication()));
        when(service.approve(21L,100.0,"Plan de prueba","synthetic-subject"))
                .thenReturn(Mono.just(new Review(21L,true,false,100.0,"synthetic-subject",null,null,null,"Plan de prueba")));
        actor("ADMIN").post().uri("/routes/21/review")
                .bodyValue(new BusinessWorkflowController.ReviewRequest(true,true,true,100.0,"Plan de prueba"))
                .exchange().expectStatus().isOk().expectBody().jsonPath("$.approvedBy").isEqualTo("synthetic-subject");
        verify(service).approve(21L,100.0,"Plan de prueba","synthetic-subject");
    }
}
