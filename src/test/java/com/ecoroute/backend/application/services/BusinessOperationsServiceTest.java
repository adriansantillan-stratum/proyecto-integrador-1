package com.ecoroute.backend.application.services;

import com.ecoroute.backend.domain.exception.BusinessRuleException;
import com.ecoroute.backend.domain.model.BusinessOperations.*;
import com.ecoroute.backend.domain.model.*;
import com.ecoroute.backend.domain.ports.out.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

@ExtendWith(MockitoExtension.class)
class BusinessOperationsServiceTest {
    @Mock BusinessOperationsPort operations;
    @Mock OrderRepository orders;
    @Mock RouteRepository routes;
    @Mock BusinessWorkflowPort workflow;
    @Mock OrderAuditPort audit;
    @InjectMocks BusinessOperationsService service;
    Incident incident(String status,String outcome) {
        return new Incident(1L,2L,3L,"DELIVERY_FAILED","MEDIUM","Cliente ausente",status,outcome,null,null,null,"driver",null,null,null);
    }
    Order order(OrderStatus status) {
        return new Order(3L,"original-1",null,2L,status,"Cliente","999123456",null,"Lima","Lima",null,
            -12.04,-77.04,1,null,null,OffsetDateTime.now(),OffsetDateTime.now());
    }
    Route route(RouteStatus status) {
        return new Route(2L,4L,5L,LocalDate.now(),status,null,null,null,0.0,OffsetDateTime.now());
    }
    @Test void retryNeverReopensOriginalOrder() {
        when(operations.incident(1L,true)).thenReturn(Mono.just(incident("OPEN",null)));
        when(routes.lockById(2L)).thenReturn(Mono.just(route(RouteStatus.IN_PROGRESS)));
        when(orders.lockById(3L)).thenReturn(Mono.just(order(OrderStatus.FAILED)));
        when(workflow.requireConfirmed(3L)).thenReturn(Mono.empty());
        when(orders.save(any())).thenAnswer(invocation -> {
            Order o=invocation.getArgument(0);
            return Mono.just(new Order(10L,o.trackingNumber(),o.externalReference(),o.routeId(),o.status(),o.recipientName(),
                o.recipientPhone(),o.recipientEmail(),o.deliveryAddress(),o.deliveryCity(),o.deliveryDistrict(),o.latitude(),o.longitude(),
                o.priority(),o.estimatedDeliveryWindowStart(),o.estimatedDeliveryWindowEnd(),o.createdAt(),o.updatedAt()));
        });
        when(operations.linkAttempt(3L,10L,1L)).thenReturn(Mono.empty());
        when(workflow.confirmation(3L)).thenReturn(Mono.just(new BusinessWorkflow.Confirmation(3L,"20123456789",true,true,true,"Acuerdo confirmado","admin",null)));
        when(workflow.saveConfirmation(any())).thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));
        when(audit.record(any(),any())).thenReturn(Mono.empty());
        when(operations.resolve(eq(1L),eq("RETRY"),any(),any(),eq(2L),eq(10L))).thenReturn(Mono.just(incident("RESOLVED","RETRY")));
        when(workflow.audit(any(),any(),any(),any(),any(),any())).thenReturn(Mono.empty());
        StepVerifier.create(service.resolve(1L,"RETRY","Segundo intento autorizado",null,"dispatcher",false))
            .assertNext(i -> assertEquals("RESOLVED",i.status())).verifyComplete();
        ArgumentCaptor<Order> capture=ArgumentCaptor.forClass(Order.class);verify(orders).save(capture.capture());
        assertNull(capture.getValue().id());assertEquals(OrderStatus.IN_TRANSIT,capture.getValue().status());
        assertEquals("original-1",capture.getValue().externalReference());assertNotEquals("original-1",capture.getValue().trackingNumber());
    }
    @Test void closedJourneyRequiresReplan() {
        when(operations.incident(1L,true)).thenReturn(Mono.just(incident("OPEN",null)));
        when(routes.lockById(2L)).thenReturn(Mono.just(route(RouteStatus.COMPLETED)));
        when(orders.lockById(3L)).thenReturn(Mono.just(order(OrderStatus.FAILED)));
        StepVerifier.create(service.resolve(1L,"RETRY","Cliente ya disponible",null,"dispatcher",false))
            .expectError(BusinessRuleException.class).verify();verify(orders,never()).save(any());
    }
    @Test void resolvedIncidentIsIdempotentForSameOutcome() {
        var closed=incident("RESOLVED","REPLAN");when(operations.incident(1L,true)).thenReturn(Mono.just(closed));
        StepVerifier.create(service.resolve(1L,"REPLAN","Mismo pedido y decisión",8L,"dispatcher",false)).expectNext(closed).verifyComplete();
        verifyNoInteractions(orders,routes);
    }
    @Test void finalClosureRequiresManagement() {
        StepVerifier.create(service.resolve(1L,"CLOSE_FAILED","No corresponde reintento",null,"dispatcher",false))
            .expectError(org.springframework.security.access.AccessDeniedException.class).verify();
        verifyNoInteractions(operations);
    }
    @Test void actionCannotSkipExecutionBeforeVerification() {
        var action=new Improvement(1L,"Reducir demora","Planificación tardía","Jefatura",LocalDate.now(),"ONTIME",20.0,90.0,null,"OPEN",null,"admin",null);
        when(operations.improvement(1L,true)).thenReturn(Mono.just(action));
        StepVerifier.create(service.updateAction(1L,"VERIFIED",95.0,"Medición registrada", "admin",true))
            .expectError(BusinessRuleException.class).verify();verify(operations,never()).updateImprovement(any(),any(),any(),any(),any());
    }
    @Test void verificationRequiresMeasuredResult() {
        StepVerifier.create(service.updateAction(1L,"VERIFIED",null,"Sin medición disponible","admin",true))
            .expectError(IllegalArgumentException.class).verify();verifyNoInteractions(operations);
    }
}
