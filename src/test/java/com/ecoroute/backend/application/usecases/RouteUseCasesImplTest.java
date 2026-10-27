package com.ecoroute.backend.application.usecases;

import com.ecoroute.backend.domain.model.*;
import com.ecoroute.backend.domain.ports.out.OrderRepository;
import com.ecoroute.backend.domain.ports.out.RouteRepository;
import com.ecoroute.backend.domain.ports.out.DriverRepository;
import com.ecoroute.backend.domain.ports.out.VehicleRepository;
import com.ecoroute.backend.domain.ports.out.OrderAuditPort;
import com.ecoroute.backend.application.services.RoutePlannerService;
import com.ecoroute.backend.domain.exception.BusinessRuleException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Flux;
import reactor.test.StepVerifier;

import java.time.LocalDate;
import java.time.OffsetDateTime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class RouteUseCasesImplTest {

    @Mock
    private RouteRepository routeRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private DriverRepository drivers;
    @Mock private VehicleRepository vehicles;
    @Mock private OrderAuditPort audit;
    @Mock private RoutePlannerService routePlanner;
    @Mock private com.ecoroute.backend.domain.ports.out.BusinessWorkflowPort workflow;

    @InjectMocks
    private RouteUseCasesImpl routeUseCases;

    private Route sampleRoute;

    @BeforeEach
    void setUp() {
        lenient().when(workflow.requireDispatchReview(1L)).thenReturn(Mono.empty());
        sampleRoute = new Route(
                1L, 1L, 1L, LocalDate.now(), RouteStatus.PLANNED,
                OffsetDateTime.now(), null, null, 0.0, OffsetDateTime.now()
        );
        lenient().when(drivers.findById(1L)).thenReturn(Mono.just(new Driver(1L,"subject","Juan","Prueba","Q12345678","999888777",null,true,null,null)));
        lenient().when(vehicles.findById(1L)).thenReturn(Mono.just(new Vehicle(1L,"ABC123","Modelo","Marca",100.0,1.0,true,null)));
    }

    @Test
    void createRoute_Success() {
        when(routeRepository.findAll()).thenReturn(Flux.empty());
        when(routeRepository.save(any(Route.class))).thenReturn(Mono.just(sampleRoute));

        Mono<Route> result = routeUseCases.createRoute(sampleRoute);

        StepVerifier.create(result)
                .expectNext(sampleRoute)
                .verifyComplete();
    }

    @Test
    void updateRouteStatus_ToInProgress_SetsStartTime() {
        when(routeRepository.lockById(1L)).thenReturn(Mono.just(sampleRoute));
        when(orderRepository.findByRouteId(1L)).thenReturn(Flux.just(OrderUseCasesImplTest.order(1L,1L,OrderStatus.ASSIGNED)));
        when(routePlanner.plan(org.mockito.ArgumentMatchers.anyDouble(),org.mockito.ArgumentMatchers.anyDouble(),any(),org.mockito.ArgumentMatchers.anyBoolean()))
                .thenReturn(Mono.just(new OptimizedPath(java.util.List.of(new OptimizedPath.RoutedStop(1L,1)),2,5,"abc","osrm")));
        when(routeRepository.updatePathInfo(any(),any(),any())).thenReturn(Mono.just(1));
        when(orderRepository.updateStopSequence(any(),any())).thenReturn(Mono.just(1));
        when(orderRepository.save(any())).thenAnswer(i -> Mono.just(i.getArgument(0)));
        when(audit.record(any(),any())).thenReturn(Mono.empty());
        when(routeRepository.save(any(Route.class))).thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));

        Mono<Route> result = routeUseCases.updateRouteStatus(1L, RouteStatus.IN_PROGRESS);

        StepVerifier.create(result)
                .assertNext(route -> {
                    assert route.status() == RouteStatus.IN_PROGRESS;
                    assert route.actualStartTime() != null;
                })
                .verifyComplete();
    }
    @Test void rejectEmptyDispatch() {
        when(routeRepository.lockById(1L)).thenReturn(Mono.just(sampleRoute));
        when(orderRepository.findByRouteId(1L)).thenReturn(Flux.empty());
        StepVerifier.create(routeUseCases.updateRouteStatus(1L,RouteStatus.IN_PROGRESS))
                .expectError(BusinessRuleException.class).verify();
    }
}
