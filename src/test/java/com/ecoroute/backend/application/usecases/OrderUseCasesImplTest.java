package com.ecoroute.backend.application.usecases;

import com.ecoroute.backend.domain.model.Order;
import com.ecoroute.backend.domain.model.OrderStatus;
import com.ecoroute.backend.domain.ports.out.OrderRepository;
import com.ecoroute.backend.domain.ports.out.OrderAuditPort;
import com.ecoroute.backend.domain.ports.out.RouteRepository;
import com.ecoroute.backend.domain.ports.in.UpdateRouteStatusUseCase;
import com.ecoroute.backend.domain.model.Route;
import com.ecoroute.backend.domain.model.RouteStatus;
import com.ecoroute.backend.domain.exception.BusinessRuleException;
import java.time.OffsetDateTime;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderUseCasesImplTest {

    @Mock
    private OrderRepository orderRepository;
    @Mock private OrderAuditPort audit;
    @Mock private RouteRepository routeRepository;
    @Mock private UpdateRouteStatusUseCase routeService;
    @Mock private com.ecoroute.backend.domain.ports.out.BusinessWorkflowPort workflow;
    @Mock private com.ecoroute.backend.domain.ports.out.BusinessOperationsPort operations;

    @InjectMocks
    private OrderUseCasesImpl orderUseCases;

    @Test
    void createOrder() {
        Order orderToSave = order(null,null,OrderStatus.PENDING);
        Order savedOrder = order(1L,null,OrderStatus.PENDING);

        when(orderRepository.save(any(Order.class))).thenReturn(Mono.just(savedOrder));
        when(audit.record(any(),any())).thenReturn(Mono.empty());

        Mono<Order> result = orderUseCases.createOrder(orderToSave);

        StepVerifier.create(result)
                .expectNext(savedOrder)
                .verifyComplete();
    }

    @Test
    void getOrderById() {
        Order order = order(1L,1L,OrderStatus.PENDING);

        when(orderRepository.findById(1L)).thenReturn(Mono.just(order));

        Mono<Order> result = orderUseCases.getOrderById(1L);

        StepVerifier.create(result)
                .expectNext(order)
                .verifyComplete();
    }

    @Test void assignExistingPendingWithoutDuplicating() {
        when(workflow.requireConfirmed(1L)).thenReturn(Mono.empty());
        when(workflow.invalidate(null)).thenReturn(Mono.empty());
        when(workflow.invalidate(5L)).thenReturn(Mono.empty());
        var source=order(1L,null,OrderStatus.PENDING);
        var route=new Route(5L,1L,2L,LocalDate.now(),RouteStatus.PLANNED,null,null,null,0.0,OffsetDateTime.now());
        when(routeRepository.lockById(5L)).thenReturn(Mono.just(route));
        when(orderRepository.lockById(1L)).thenReturn(Mono.just(source));
        when(orderRepository.save(any())).thenAnswer(i -> Mono.just(i.getArgument(0)));
        when(audit.record(any(),any())).thenReturn(Mono.empty());
        StepVerifier.create(orderUseCases.assignOrder(1L,5L)).assertNext(o -> {
            org.junit.jupiter.api.Assertions.assertEquals(1L,o.id());
            org.junit.jupiter.api.Assertions.assertEquals(5L,o.routeId());
            org.junit.jupiter.api.Assertions.assertEquals(OrderStatus.ASSIGNED,o.status());
        }).verifyComplete();
    }
    @Test void rejectDeliveredThroughManualEndpoint() {
        when(orderRepository.lockById(1L)).thenReturn(Mono.just(order(1L,1L,OrderStatus.IN_TRANSIT)));
        StepVerifier.create(orderUseCases.updateStatusManual(1L,OrderStatus.DELIVERED,"sin evidencia"))
                .expectError(BusinessRuleException.class).verify();
    }
    @Test void rejectReopeningClosedOrder() {
        when(orderRepository.lockById(1L)).thenReturn(Mono.just(order(1L,1L,OrderStatus.DELIVERED)));
        StepVerifier.create(orderUseCases.updateStatusManual(1L,OrderStatus.PENDING,"reabrir"))
                .expectError(BusinessRuleException.class).verify();
    }
    @Test void newDeliveryWindowRequiresFreshCustomerAcceptance() {
        var source=order(1L,null,OrderStatus.PENDING);
        when(orderRepository.lockById(1L)).thenReturn(Mono.just(source));
        when(orderRepository.save(any())).thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));
        when(workflow.confirmation(1L)).thenReturn(Mono.just(new com.ecoroute.backend.domain.model.BusinessWorkflow.Confirmation(
            1L,"20123456789",true,true,true,"Acuerdo original","dispatcher",OffsetDateTime.now())));
        when(workflow.saveConfirmation(any())).thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));
        when(workflow.invalidate(null)).thenReturn(Mono.empty());
        when(workflow.audit(any(),any(),any(),any(),any(),any())).thenReturn(Mono.empty());
        when(audit.record(any(),any())).thenReturn(Mono.empty());
        var start=OffsetDateTime.now().plusHours(1);var end=start.plusHours(2);
        StepVerifier.create(orderUseCases.changeDeliveryWindow(1L,start,end,"Cliente solicita otro horario","dispatcher"))
            .assertNext(saved -> org.junit.jupiter.api.Assertions.assertEquals(end,saved.estimatedDeliveryWindowEnd())).verifyComplete();
        var capture=org.mockito.ArgumentCaptor.forClass(com.ecoroute.backend.domain.model.BusinessWorkflow.Confirmation.class);
        org.mockito.Mockito.verify(workflow).saveConfirmation(capture.capture());
        org.junit.jupiter.api.Assertions.assertFalse(capture.getValue().customerAccepted());
        org.junit.jupiter.api.Assertions.assertTrue(capture.getValue().addressVerified());
    }
    @Test void noWindowChangeAfterDispatch() {
        when(orderRepository.lockById(1L)).thenReturn(Mono.just(order(1L,1L,OrderStatus.IN_TRANSIT)));
        StepVerifier.create(orderUseCases.changeDeliveryWindow(1L,OffsetDateTime.now().plusHours(1),OffsetDateTime.now().plusHours(2),"Cambio tardío no permitido","dispatcher"))
            .expectError(BusinessRuleException.class).verify();
    }
    static Order order(Long id,Long route,OrderStatus status) {
        return new Order(id,"tracking-123",null,route,status,"Cliente","999888777",null,
                "Dirección Lima","Lima","Cercado",-12.04,-77.04,1,null,null,OffsetDateTime.now(),OffsetDateTime.now());
    }
}
