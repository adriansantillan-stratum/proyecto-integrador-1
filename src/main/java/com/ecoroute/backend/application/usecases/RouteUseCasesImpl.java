package com.ecoroute.backend.application.usecases;

import com.ecoroute.backend.application.services.RoutePlannerService;
import com.ecoroute.backend.domain.exception.ResourceNotFoundException;
import com.ecoroute.backend.domain.model.Order;
import com.ecoroute.backend.domain.model.OrderStatus;
import com.ecoroute.backend.domain.model.Route;
import com.ecoroute.backend.domain.model.RouteStatus;
import com.ecoroute.backend.domain.model.Waypoint;
import com.ecoroute.backend.domain.model.OrderLifecycle;
import com.ecoroute.backend.domain.exception.BusinessRuleException;
import com.ecoroute.backend.domain.ports.out.DriverRepository;
import com.ecoroute.backend.domain.ports.out.VehicleRepository;
import com.ecoroute.backend.domain.ports.out.OrderAuditPort;
import com.ecoroute.backend.domain.ports.out.BusinessWorkflowPort;
import com.ecoroute.backend.domain.ports.in.CreateRouteUseCase;
import com.ecoroute.backend.domain.ports.in.GetAllRoutesUseCase;
import com.ecoroute.backend.domain.ports.in.UpdateRouteStatusUseCase;
import com.ecoroute.backend.domain.ports.out.OrderRepository;
import com.ecoroute.backend.domain.ports.out.RouteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.OffsetDateTime;

@Service
@RequiredArgsConstructor
public class RouteUseCasesImpl implements CreateRouteUseCase, UpdateRouteStatusUseCase, GetAllRoutesUseCase {

    private final RouteRepository routeRepository;
    private final OrderRepository orderRepository;
    private final RoutePlannerService routePlanner;
    private final DriverRepository drivers;
    private final VehicleRepository vehicles;
    private final OrderAuditPort audit;
    private final BusinessWorkflowPort workflow;

    @Override
    @Transactional
    public Mono<Route> createRoute(Route route) {
        if (route.driverId() == null || route.vehicleId() == null || route.routeDate() == null)
            return Mono.error(new IllegalArgumentException("Indique conductor, vehículo y fecha"));
        return validateResources(route).thenMany(routeRepository.findAll())
                .filter(r -> r.routeDate().equals(route.routeDate()) && 
                            (r.status() == RouteStatus.PLANNED || r.status() == RouteStatus.IN_PROGRESS))
                .filter(r -> r.driverId().equals(route.driverId()) || r.vehicleId().equals(route.vehicleId()))
                .collectList()
                .flatMap(conflicts -> {
                    if (!conflicts.isEmpty()) {
                        return Mono.error(new BusinessRuleException("El conductor o vehículo ya tiene una ruta activa para esta fecha"));
                    }
                    return routeRepository.save(route);
                });
    }

    @Override
    @Transactional
    public Mono<Route> updateRouteStatus(Long id, RouteStatus status) {
        return routeRepository.lockById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Route not found")))
                .flatMap(existingRoute -> {
                    if (status == existingRoute.status()) return Mono.just(existingRoute);
                    if (existingRoute.status() == RouteStatus.COMPLETED || existingRoute.status() == RouteStatus.CANCELLED)
                        return Mono.error(new BusinessRuleException("No se reabre una ruta cerrada"));
                    if (status == RouteStatus.PLANNED)
                        return Mono.error(new BusinessRuleException("No se revierte una ruta a planificada"));
                    if (status == RouteStatus.COMPLETED)
                        return orderRepository.findByRouteId(id).collectList().flatMap(orders -> {
                            if (orders.isEmpty() || orders.stream().anyMatch(o -> !OrderLifecycle.terminal(o.status())))
                                return Mono.error(new BusinessRuleException("Debe cerrar todas las paradas antes de finalizar"));
                            return routeRepository.save(createUpdatedRouteObject(existingRoute,status,existingRoute.totalDistanceKm()));
                        });
                    if (status == RouteStatus.CANCELLED)
                        return orderRepository.findByRouteId(id).any(o -> !OrderLifecycle.terminal(o.status()))
                                .flatMap(pending -> pending ? Mono.error(new BusinessRuleException("Reasigne los pedidos antes de cancelar"))
                                        : routeRepository.save(createUpdatedRouteObject(existingRoute,status,existingRoute.totalDistanceKm())));
                    // Calculate distance if starting route OR completing if it's 0
                    boolean shouldCalculate = (status == RouteStatus.IN_PROGRESS) || 
                                             (status == RouteStatus.COMPLETED && existingRoute.totalDistanceKm() <= 0);

                    Mono<Double> distanceMono = shouldCalculate 
                            ? calculateRouteDistance(id) 
                            : Mono.just(existingRoute.totalDistanceKm());

                    Mono<Void> authorization=status==RouteStatus.IN_PROGRESS ? workflow.requireDispatchReview(id) : Mono.empty();
                    return authorization.then(distanceMono).flatMap(distance -> {
                        Route updatedRoute = createUpdatedRouteObject(existingRoute, status, distance);

                        // CASCADE: Update all orders to IN_TRANSIT if route starts
                        if (status == RouteStatus.IN_PROGRESS) {
                            return validateResources(existingRoute).thenMany(orderRepository.findByRouteId(id))
                                    .collectList().flatMapMany(orders -> {
                                        if (orders.isEmpty()) return Flux.error(new BusinessRuleException("No se despacha una ruta sin pedidos"));
                                        if (orders.stream().anyMatch(o -> OrderLifecycle.terminal(o.status())))
                                            return Flux.error(new BusinessRuleException("La ruta contiene pedidos ya cerrados"));
                                        if (orders.stream().anyMatch(o -> o.latitude() == null || o.longitude() == null
                                                || !Double.isFinite(o.latitude()) || !Double.isFinite(o.longitude())
                                                || Math.abs(o.latitude())>90 || Math.abs(o.longitude())>180
                                                || (o.latitude()==0 && o.longitude()==0)))
                                            return Flux.error(new BusinessRuleException("Revise las coordenadas de todas las paradas"));
                                        return Flux.fromIterable(orders);
                                    })
                                    .concatMap(order -> updateOrderStatus(order, OrderStatus.IN_TRANSIT)
                                            .flatMap(saved -> audit.record(saved,"Despacho de ruta " + id).thenReturn(saved)))
                                    .then(Mono.defer(() -> routeRepository.save(updatedRoute)));
                        }
                        
                        return routeRepository.save(updatedRoute);
                    });
                });
    }

    private Mono<Void> validateResources(Route route) {
        return drivers.findById(route.driverId())
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Conductor no encontrado")))
                .flatMap(driver -> Boolean.TRUE.equals(driver.isActive()) ? Mono.empty()
                        : Mono.error(new BusinessRuleException("El conductor no está habilitado")))
                .then(vehicles.findById(route.vehicleId())
                    .switchIfEmpty(Mono.error(new ResourceNotFoundException("Vehículo no encontrado")))
                    .flatMap(vehicle -> Boolean.TRUE.equals(vehicle.isActive()) ? Mono.empty()
                            : Mono.error(new BusinessRuleException("El vehículo no está habilitado"))));
    }

    /**
     * Planifica el recorrido (OSRM con fallback haversine), persiste la
     * geometría/duración en la ruta y el orden de visita en cada pedido,
     * y devuelve la distancia total.
     */
    private Mono<Double> calculateRouteDistance(Long routeId) {
        return orderRepository.findByRouteId(routeId)
                .filter(o -> o.latitude() != null && o.longitude() != null)
                .map(o -> new Waypoint(o.id(), o.latitude(), o.longitude()))
                .collectList()
                .flatMap(stops -> {
                    if (stops.isEmpty()) return Mono.just(0.0);

                    return routePlanner.plan(
                                    RoutePlannerService.DEFAULT_START_LAT,
                                    RoutePlannerService.DEFAULT_START_LON,
                                    stops, true)
                            .flatMap(path -> routeRepository
                                    .updatePathInfo(routeId, path.polyline(), path.durationMin())
                                    .thenMany(Flux.fromIterable(path.stops())
                                            .flatMap(s -> orderRepository.updateStopSequence(s.orderId(), s.sequence())))
                                    .then(Mono.just(path.distanceKm())));
                });
    }

    @Override
    public Mono<Void> updateRouteStatusOnly(Long id, RouteStatus status) {
        return routeRepository.findById(id)
                .flatMap(existingRoute -> routeRepository.save(createUpdatedRouteObject(existingRoute, status, existingRoute.totalDistanceKm())))
                .then();
    }

    private Route createUpdatedRouteObject(Route existing, RouteStatus newStatus, Double distance) {
        OffsetDateTime actualStartTime = existing.actualStartTime();
        OffsetDateTime actualEndTime = existing.actualEndTime();
        
        if (newStatus == RouteStatus.IN_PROGRESS && actualStartTime == null) actualStartTime = OffsetDateTime.now();
        if (newStatus == RouteStatus.COMPLETED && actualEndTime == null) actualEndTime = OffsetDateTime.now();
        
        return new Route(
                existing.id(), existing.driverId(), existing.vehicleId(),
                existing.routeDate(), newStatus, existing.estimatedStartTime(),
                actualStartTime, actualEndTime, distance,
                existing.createdAt()
        );
    }

    private Mono<Order> updateOrderStatus(Order order, OrderStatus newStatus) {
        Order updated = new Order(
                order.id(), order.trackingNumber(), order.externalReference(),
                order.routeId(), newStatus, order.recipientName(),
                order.recipientPhone(), order.recipientEmail(),
                order.deliveryAddress(), order.deliveryCity(),
                order.deliveryDistrict(), order.latitude(), order.longitude(),
                order.priority(), order.estimatedDeliveryWindowStart(),
                order.estimatedDeliveryWindowEnd(), order.createdAt(),
                OffsetDateTime.now()
        );
        return orderRepository.save(updated);
    }

    @Override
    public Flux<Route> getAllRoutes() {
        return routeRepository.findAll();
    }

    @Override
    public Flux<Route> getRoutesByFilters(java.time.LocalDate date, RouteStatus status) {
        return routeRepository.findByFilters(date, status);
    }
}
