package com.ecoroute.backend.application.usecases;

import com.ecoroute.backend.application.services.BusinessOperationsService;
import com.ecoroute.backend.application.services.BusinessWorkflowService;
import com.ecoroute.backend.domain.exception.BusinessRuleException;
import com.ecoroute.backend.domain.model.*;
import com.ecoroute.backend.domain.model.BusinessOperations.Incident;
import com.ecoroute.backend.domain.model.BusinessWorkflow.*;
import com.ecoroute.backend.domain.ports.out.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

@ExtendWith(MockitoExtension.class)
class WorkflowDecisionExceptionsTest {
    @Mock BusinessOperationsPort operations;
    @Mock OrderRepository orders;
    @Mock RouteRepository routes;
    @Mock BusinessWorkflowPort workflow;
    @Mock OrderAuditPort audit;
    @Mock DriverRepository drivers;
    @Mock VehicleRepository vehicles;
    BusinessOperationsService decisions;
    BusinessWorkflowService reviews;
    @BeforeEach void setup() {
        decisions = new BusinessOperationsService(operations,orders,routes,workflow,audit);
        reviews = new BusinessWorkflowService(workflow,orders,routes,vehicles,drivers,audit);
    }
    Incident incident(String status,String outcome) {
        return new Incident(51L,21L,11L,"DELIVERY_FAILED","MEDIUM","Ausencia de prueba",status,outcome,
                null,null,null,"driver-prueba",null,null,null);
    }
    @Test void replanCreatesLinkedAssignedAttemptAndRevokesCommercialAcceptanceAndPlan() {
        var base = WorkflowExceptionUseCasesTest.order(OrderStatus.RETURNED);
        var original = new Order(base.id(),base.trackingNumber(),base.externalReference(),base.routeId(),base.status(),
                base.recipientName(),base.recipientPhone(),base.recipientEmail(),base.deliveryAddress(),base.deliveryCity(),
                base.deliveryDistrict(),base.latitude(),base.longitude(),base.priority(),
                java.time.OffsetDateTime.parse("2026-10-21T09:00:00-05:00"),
                java.time.OffsetDateTime.parse("2026-10-21T12:00:00-05:00"),base.createdAt(),base.updatedAt());
        when(operations.incident(51L,true)).thenReturn(Mono.just(incident("OPEN",null)));
        when(routes.lockById(22L)).thenReturn(Mono.just(WorkflowExceptionUseCasesTest.route(22L,RouteStatus.PLANNED)));
        when(orders.lockById(11L)).thenReturn(Mono.just(original));
        when(workflow.requireConfirmed(11L)).thenReturn(Mono.empty());
        when(orders.save(any())).thenAnswer(call -> Mono.just(call.getArgument(0,Order.class).withAssignment(22L,OrderStatus.ASSIGNED))
                .map(o -> new Order(12L,o.trackingNumber(),o.externalReference(),o.routeId(),o.status(),o.recipientName(),o.recipientPhone(),
                        o.recipientEmail(),o.deliveryAddress(),o.deliveryCity(),o.deliveryDistrict(),o.latitude(),o.longitude(),o.priority(),
                        o.estimatedDeliveryWindowStart(),o.estimatedDeliveryWindowEnd(),o.createdAt(),o.updatedAt())));
        when(operations.linkAttempt(11L,12L,51L)).thenReturn(Mono.empty());
        when(workflow.confirmation(11L)).thenReturn(Mono.just(new Confirmation(11L,"20999999991",true,true,true,"Acuerdo previo","dispatcher",null)));
        when(workflow.saveConfirmation(any())).thenAnswer(call -> Mono.just(call.getArgument(0)));
        when(workflow.invalidate(22L)).thenReturn(Mono.empty());
        when(audit.record(any(),any())).thenReturn(Mono.empty());
        when(operations.resolve(51L,"REPLAN","Nueva fecha autorizada","dispatcher",22L,12L)).thenReturn(Mono.just(incident("RESOLVED","REPLAN")));
        when(workflow.audit(any(),any(),any(),any(),any(),any())).thenReturn(Mono.empty());
        StepVerifier.create(decisions.resolve(51L,"REPLAN","Nueva fecha autorizada",22L,"dispatcher",false))
                .assertNext(i -> assertEquals("REPLAN",i.outcome())).verifyComplete();
        var attempt = ArgumentCaptor.forClass(Order.class); verify(orders,times(1)).save(attempt.capture());
        assertNull(attempt.getValue().id()); assertEquals(OrderStatus.ASSIGNED,attempt.getValue().status());
        assertEquals(22L,attempt.getValue().routeId()); assertEquals(original.trackingNumber(),attempt.getValue().externalReference());
        assertNotEquals(original.trackingNumber(),attempt.getValue().trackingNumber());
        assertNull(attempt.getValue().estimatedDeliveryWindowStart()); assertNull(attempt.getValue().estimatedDeliveryWindowEnd());
        var confirmation = ArgumentCaptor.forClass(Confirmation.class); verify(workflow).saveConfirmation(confirmation.capture());
        assertEquals(12L,confirmation.getValue().orderId()); assertFalse(confirmation.getValue().customerAccepted());
        assertTrue(confirmation.getValue().addressVerified()); assertTrue(confirmation.getValue().coverageVerified());
        verify(operations).linkAttempt(11L,12L,51L); verify(workflow).invalidate(22L);
        assertEquals(OrderStatus.RETURNED,original.status());
        assertNotNull(original.estimatedDeliveryWindowStart()); assertNotNull(original.estimatedDeliveryWindowEnd());
    }
    @Test void replanRejectsAnAlreadyDispatchedDestinationWithoutCreatingAttempt() {
        when(operations.incident(51L,true)).thenReturn(Mono.just(incident("OPEN",null)));
        when(routes.lockById(22L)).thenReturn(Mono.just(WorkflowExceptionUseCasesTest.route(22L,RouteStatus.IN_PROGRESS)));
        when(orders.lockById(11L)).thenReturn(Mono.just(WorkflowExceptionUseCasesTest.order(OrderStatus.FAILED)));
        StepVerifier.create(decisions.resolve(51L,"REPLAN","Nueva fecha autorizada",22L,"dispatcher",false))
                .expectError(BusinessRuleException.class).verify();
        verify(orders,never()).save(any()); verifyNoInteractions(workflow,audit);
        verify(operations,never()).linkAttempt(any(),any(),any());
    }
    @Test void resolvedIncidentCannotChangeDecisionOrCreateAnotherAttempt() {
        when(operations.incident(51L,true)).thenReturn(Mono.just(incident("RESOLVED","RETRY")));
        StepVerifier.create(decisions.resolve(51L,"REPLAN","Cambio de resolución",22L,"dispatcher",false))
                .expectError(BusinessRuleException.class).verify();
        verifyNoInteractions(orders,routes,workflow); verify(operations,never()).resolve(any(),any(),any(),any(),any(),any());
    }
    @ParameterizedTest(name="dispatcherCannotCloseDefinitively[{index}] outcome={0}")
    @ValueSource(strings={"CLOSE_FAILED","CLOSE_CASE"})
    void dispatcherCannotCloseDefinitively(String outcome) {
        StepVerifier.create(decisions.resolve(51L,outcome,"Cierre final de prueba",null,"dispatcher",false))
                .expectError(AccessDeniedException.class).verify();
        verifyNoInteractions(operations,orders,routes,workflow);
    }
    @Test void managerCloseCasePreservesOrderAndDoesNotCreateAttempt() {
        when(operations.incident(51L,true)).thenReturn(Mono.just(incident("OPEN",null)));
        when(operations.resolve(51L,"CLOSE_CASE","Caso general conciliado","admin",null,null)).thenReturn(Mono.just(incident("RESOLVED","CLOSE_CASE")));
        when(workflow.audit(any(),any(),any(),any(),any(),any())).thenReturn(Mono.empty());
        StepVerifier.create(decisions.resolve(51L,"CLOSE_CASE","Caso general conciliado",null,"admin",true))
                .assertNext(i -> assertEquals("CLOSE_CASE",i.outcome())).verifyComplete();
        verifyNoInteractions(orders,routes,audit); verify(operations,never()).linkAttempt(any(),any(),any());
    }
    @Test void driverCannotAcceptAnotherDriversSheet() {
        when(routes.lockById(21L)).thenReturn(Mono.just(WorkflowExceptionUseCasesTest.route(21L,RouteStatus.PLANNED)));
        StepVerifier.create(reviews.accept(21L,99L,"driver-foreign")).expectError(BusinessRuleException.class).verify();
        verifyNoInteractions(workflow);
    }
    @Test void ownerCannotAcceptUnapprovedPlan() {
        when(routes.lockById(21L)).thenReturn(Mono.just(WorkflowExceptionUseCasesTest.route(21L,RouteStatus.PLANNED)));
        when(workflow.review(21L)).thenReturn(Mono.just(new Review(21L,false,false,null,null,null,null,null,null)));
        StepVerifier.create(reviews.accept(21L,31L,"driver-owner")).expectError(BusinessRuleException.class).verify();
        verify(workflow,never()).accept(any(),any());
    }
    @Test void commercialChangeInvalidatesPlanAndPersistsAuthenticatedActor() {
        when(orders.lockById(11L)).thenReturn(Mono.just(WorkflowExceptionUseCasesTest.order(OrderStatus.ASSIGNED)));
        var input = new Confirmation(11L,"20999999991",true,true,true,"Acuerdo comercial actualizado","actor-real",null);
        when(workflow.saveConfirmation(input)).thenReturn(Mono.just(input));
        when(workflow.invalidate(21L)).thenReturn(Mono.empty());
        when(workflow.audit("P01","ORDER",11L,"COMMERCIAL_REVIEW","actor-real","Acuerdo comercial actualizado")).thenReturn(Mono.empty());
        when(audit.record(any(),any())).thenReturn(Mono.empty());
        StepVerifier.create(reviews.confirm(input)).expectNext(input).verifyComplete();
        verify(workflow).invalidate(21L); verify(workflow).saveConfirmation(input);
    }
}
