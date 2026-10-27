package com.ecoroute.backend.application.usecases;

import com.ecoroute.backend.application.services.RoutePlannerService;
import com.ecoroute.backend.domain.exception.BusinessRuleException;
import com.ecoroute.backend.domain.model.*;
import com.ecoroute.backend.domain.ports.in.UpdateRouteStatusUseCase;
import com.ecoroute.backend.domain.ports.out.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;
import reactor.test.publisher.PublisherProbe;
import java.time.*;
import java.util.ArrayList;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

/** Unit boundaries only: mocked repositories, no DB, HTTP or routing service. */
@ExtendWith(MockitoExtension.class)
class WorkflowExceptionUseCasesTest {
    @Mock OrderRepository orders;
    @Mock RouteRepository routes;
    @Mock OrderAuditPort audit;
    @Mock BusinessWorkflowPort workflow;
    @Mock BusinessOperationsPort operations;
    @Mock UpdateRouteStatusUseCase routeTransitions;
    @Mock RoutePlannerService planner;
    @Mock DriverRepository drivers;
    @Mock VehicleRepository vehicles;
    OrderUseCasesImpl orderService;
    RouteUseCasesImpl routeService;

    @BeforeEach void setup() {
        orderService = new OrderUseCasesImpl(orders, routeTransitions, routes, audit, workflow, operations);
        routeService = new RouteUseCasesImpl(routes, orders, planner, drivers, vehicles, audit, workflow);
    }
    static Order order(OrderStatus status) {
        return new Order(11L,"EXCEPTION-ORDER",null,21L,status,"Receptor prueba","900000001",null,
                "Dirección sintética","Lima",null,-12.04,-77.04,1,null,null,OffsetDateTime.now(),OffsetDateTime.now());
    }
    static Route route(long id, RouteStatus status) {
        return new Route(id,31L,41L,LocalDate.of(2026,10,22),status,null,null,null,0.0,OffsetDateTime.now());
    }
    void reassignment() {
        when(routes.lockById(22L)).thenReturn(Mono.just(route(22L,RouteStatus.PLANNED)));
        when(orders.lockById(11L)).thenReturn(Mono.just(order(OrderStatus.ASSIGNED)));
        when(routes.findById(21L)).thenReturn(Mono.just(route(21L,RouteStatus.PLANNED)));
    }
    @Test void reassignmentInvalidatesBothPlansBeforeSavingSameOrder() {
        reassignment();
        List<String> subscribed = new ArrayList<>();
        when(workflow.requireConfirmed(11L)).thenReturn(Mono.fromRunnable(() -> subscribed.add("confirmation")));
        when(workflow.invalidate(21L)).thenReturn(Mono.fromRunnable(() -> subscribed.add("old-plan")));
        when(workflow.invalidate(22L)).thenReturn(Mono.fromRunnable(() -> subscribed.add("new-plan")));
        when(orders.save(any())).thenAnswer(call -> Mono.fromSupplier(() -> {
            subscribed.add("save"); return call.getArgument(0,Order.class);
        }));
        when(audit.record(any(),any())).thenReturn(Mono.empty());
        StepVerifier.create(orderService.assignOrder(11L,22L)).assertNext(saved -> {
            assertEquals(11L,saved.id()); assertEquals("EXCEPTION-ORDER",saved.trackingNumber());
            assertEquals(22L,saved.routeId()); assertEquals(OrderStatus.ASSIGNED,saved.status());
        }).verifyComplete();
        assertEquals(List.of("confirmation","old-plan","new-plan","save"),subscribed);
        verify(orders,times(1)).save(any());
    }
    @Test void unconfirmedReassignmentDoesNotSubscribeInvalidationsOrSave() {
        reassignment();
        var oldPlan = PublisherProbe.<Void>empty(); var newPlan = PublisherProbe.<Void>empty();
        when(workflow.requireConfirmed(11L)).thenReturn(Mono.error(new BusinessRuleException("Falta aceptación comercial")));
        when(workflow.invalidate(21L)).thenReturn(oldPlan.mono());
        when(workflow.invalidate(22L)).thenReturn(newPlan.mono());
        StepVerifier.create(orderService.assignOrder(11L,22L)).expectError(BusinessRuleException.class).verify();
        oldPlan.assertWasNotSubscribed(); newPlan.assertWasNotSubscribed();
        verify(orders,never()).save(any()); verifyNoInteractions(audit);
    }
    @ParameterizedTest(name="dispatchedOrTerminalOrderCannotBeReassigned[{index}] status={0}")
    @EnumSource(value=OrderStatus.class,names={"PICKED_UP","IN_TRANSIT","DELIVERED","FAILED","RETURNED"})
    void dispatchedOrTerminalOrderCannotBeReassigned(OrderStatus status) {
        when(routes.lockById(22L)).thenReturn(Mono.just(route(22L,RouteStatus.PLANNED)));
        when(orders.lockById(11L)).thenReturn(Mono.just(order(status)));
        StepVerifier.create(orderService.assignOrder(11L,22L)).expectError(BusinessRuleException.class).verify();
        verifyNoInteractions(workflow,audit); verify(orders,never()).save(any());
    }
    @Test void dispatchedSourceRouteCannotBeReassigned() {
        when(routes.lockById(22L)).thenReturn(Mono.just(route(22L,RouteStatus.PLANNED)));
        when(orders.lockById(11L)).thenReturn(Mono.just(order(OrderStatus.ASSIGNED)));
        when(routes.findById(21L)).thenReturn(Mono.just(route(21L,RouteStatus.IN_PROGRESS)));
        var confirmed = PublisherProbe.<Void>empty(); var invalidated = PublisherProbe.<Void>empty();
        when(workflow.requireConfirmed(11L)).thenReturn(confirmed.mono());
        when(workflow.invalidate(any())).thenReturn(invalidated.mono());
        StepVerifier.create(orderService.assignOrder(11L,22L)).expectError(BusinessRuleException.class).verify();
        confirmed.assertWasNotSubscribed(); invalidated.assertWasNotSubscribed(); verify(orders,never()).save(any());
    }
    @Test void dispatchWithoutReviewDoesNotSubscribePlanningOrSave() {
        when(routes.lockById(21L)).thenReturn(Mono.just(route(21L,RouteStatus.PLANNED)));
        when(workflow.requireDispatchReview(21L)).thenReturn(Mono.error(new BusinessRuleException("Revisión o aceptación pendiente")));
        var reads = PublisherProbe.of(Flux.<Order>empty());
        when(orders.findByRouteId(21L)).thenReturn(reads.flux());
        StepVerifier.create(routeService.updateRouteStatus(21L,RouteStatus.IN_PROGRESS)).expectError(BusinessRuleException.class).verify();
        reads.assertWasNotSubscribed(); verifyNoInteractions(planner,drivers,vehicles,audit);
        verify(orders,never()).save(any()); verify(routes,never()).save(any());
    }
    @ParameterizedTest(name="cancellationWithOpenStopsIsRejected[{index}] status={0}")
    @EnumSource(value=OrderStatus.class,names={"PENDING","ASSIGNED","PICKED_UP","IN_TRANSIT"})
    void cancellationWithOpenStopsIsRejected(OrderStatus status) {
        when(routes.lockById(21L)).thenReturn(Mono.just(route(21L,RouteStatus.PLANNED)));
        when(orders.findByRouteId(21L)).thenReturn(Flux.just(order(status)));
        StepVerifier.create(routeService.updateRouteStatus(21L,RouteStatus.CANCELLED)).expectError(BusinessRuleException.class).verify();
        verify(routes,never()).save(any()); verify(orders,never()).save(any()); verifyNoInteractions(workflow,planner);
    }
    @Test void emptyRouteCancellationDoesNotCreateOrCancelOrders() {
        when(routes.lockById(21L)).thenReturn(Mono.just(route(21L,RouteStatus.PLANNED)));
        when(orders.findByRouteId(21L)).thenReturn(Flux.empty());
        when(routes.save(any())).thenAnswer(call -> Mono.just(call.getArgument(0)));
        StepVerifier.create(routeService.updateRouteStatus(21L,RouteStatus.CANCELLED)).assertNext(saved -> {
            assertEquals(21L,saved.id()); assertEquals(RouteStatus.CANCELLED,saved.status());
            assertNull(saved.actualStartTime());
        }).verifyComplete();
        verify(orders,never()).save(any()); verifyNoInteractions(workflow,planner,audit);
    }
    @Test void cancellationWithTerminalStopsPreservesTheirOutcomes() {
        when(routes.lockById(21L)).thenReturn(Mono.just(route(21L,RouteStatus.IN_PROGRESS)));
        when(orders.findByRouteId(21L)).thenReturn(Flux.just(order(OrderStatus.DELIVERED),order(OrderStatus.FAILED),order(OrderStatus.RETURNED)));
        when(routes.save(any())).thenAnswer(call -> Mono.just(call.getArgument(0)));
        StepVerifier.create(routeService.updateRouteStatus(21L,RouteStatus.CANCELLED))
                .assertNext(saved -> assertEquals(RouteStatus.CANCELLED,saved.status())).verifyComplete();
        verify(orders,never()).save(any()); verifyNoInteractions(workflow,audit);
    }
    @ParameterizedTest(name="closedRouteCannotRestart[{index}] status={0}")
    @EnumSource(value=RouteStatus.class,names={"COMPLETED","CANCELLED"})
    void closedRouteCannotRestart(RouteStatus status) {
        when(routes.lockById(21L)).thenReturn(Mono.just(route(21L,status)));
        StepVerifier.create(routeService.updateRouteStatus(21L,RouteStatus.IN_PROGRESS)).expectError(BusinessRuleException.class).verify();
        verifyNoInteractions(orders,workflow,planner); verify(routes,never()).save(any());
    }
}
