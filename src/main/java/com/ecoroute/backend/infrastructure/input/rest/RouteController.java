package com.ecoroute.backend.infrastructure.input.rest;

import com.ecoroute.backend.application.services.RoutePlannerService;
import com.ecoroute.backend.domain.model.Route;
import com.ecoroute.backend.domain.model.RouteStatus;
import com.ecoroute.backend.domain.model.Waypoint;
import com.ecoroute.backend.domain.ports.in.CreateRouteUseCase;
import com.ecoroute.backend.domain.ports.in.GetAllRoutesUseCase;
import com.ecoroute.backend.domain.ports.in.UpdateRouteStatusUseCase;
import com.ecoroute.backend.domain.ports.out.OrderRepository;
import com.ecoroute.backend.domain.ports.out.RouteRepository;
import com.ecoroute.backend.infrastructure.security.OperationalAccess;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.OffsetDateTime;
import java.util.List;

@RestController
@RequestMapping("/routes")
@RequiredArgsConstructor
public class RouteController {

    private final CreateRouteUseCase createRouteUseCase;
    private final UpdateRouteStatusUseCase updateRouteStatusUseCase;
    private final GetAllRoutesUseCase getAllRoutesUseCase;
    private final RouteRepository routeRepository;
    private final OrderRepository orderRepository;
    private final RoutePlannerService routePlanner;
    private final OperationalAccess access;

    @PostMapping
    public Mono<Route> createRoute(@Valid @RequestBody CreateRouteRequest request) {
        Route route = new Route(
                null,
                request.driverId(),
                request.vehicleId(),
                request.routeDate(),
                RouteStatus.PLANNED,
                request.estimatedStartTime(),
                null,
                null,
                0.0,
                OffsetDateTime.now()
        );
        return createRouteUseCase.createRoute(route);
    }

    @PatchMapping("/{id}/status")
    public Mono<Route> updateStatus(@PathVariable Long id, @RequestParam RouteStatus status) {
        return updateRouteStatusUseCase.updateRouteStatus(id, status);
    }

    @GetMapping
    public Flux<Route> getAllRoutes(
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate date,
            @RequestParam(required = false) RouteStatus status) {
        if (date != null || status != null) {
            return getAllRoutesUseCase.getRoutesByFilters(date, status).filterWhen(access::mayReadRoute);
        }
        return getAllRoutesUseCase.getAllRoutes().filterWhen(access::mayReadRoute);
    }

    @DeleteMapping("/{id}")
    public Mono<Void> deleteRoute(@PathVariable Long id) {
        return routeRepository.deleteById(id);
    }

    /**
     * Camino en vivo por calles: recalcula el recorrido óptimo sobre los
     * pedidos aún activos partiendo de la posición del conductor (o del hub
     * si no se envía posición). No persiste nada.
     */
    @GetMapping("/{id}/path")
    public Mono<RoutePathResponse> getRoutePath(
            @PathVariable Long id,
            @RequestParam(required = false) Double fromLat,
            @RequestParam(required = false) Double fromLng) {

        double startLat = fromLat != null ? fromLat : RoutePlannerService.DEFAULT_START_LAT;
        double startLon = fromLng != null ? fromLng : RoutePlannerService.DEFAULT_START_LON;

        return access.requireRoute(id).thenMany(orderRepository.findByRouteId(id))
                .filter(o -> !com.ecoroute.backend.domain.model.OrderLifecycle.terminal(o.status())
                        && o.latitude() != null && o.longitude() != null)
                .map(o -> new Waypoint(o.id(), o.latitude(), o.longitude()))
                .collectList()
                .flatMap(stops -> routePlanner.plan(startLat, startLon, stops, false))
                .map(path -> new RoutePathResponse(
                        path.polyline(),
                        path.stops().stream().map(s -> s.orderId()).toList(),
                        path.distanceKm(),
                        path.durationMin(),
                        path.source()));
    }
}
