package com.ecoroute.backend.infrastructure.security;

import com.ecoroute.backend.domain.model.Order;
import com.ecoroute.backend.domain.model.Route;
import com.ecoroute.backend.domain.ports.out.DriverRepository;
import com.ecoroute.backend.domain.ports.out.OrderRepository;
import com.ecoroute.backend.domain.ports.out.RouteRepository;
import com.ecoroute.backend.domain.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

/** Resolves identity from a validated subject, never from a client supplied driver id. */
@Component
@RequiredArgsConstructor
public class OperationalAccess {
    private final DriverRepository drivers;
    private final RouteRepository routes;
    private final OrderRepository orders;
    public Mono<Authentication> authentication() {
        return ReactiveSecurityContextHolder.getContext().map(c -> c.getAuthentication())
                .switchIfEmpty(Mono.error(new AccessDeniedException("Sesión requerida")));
    }
    public Mono<Boolean> managesOperation() {
        return authentication().map(a -> a.getAuthorities().stream().anyMatch(r ->
                r.getAuthority().equals("ROLE_ADMIN") || r.getAuthority().equals("ROLE_DISPATCHER")));
    }
    public Mono<Long> driverId() {
        return authentication().flatMap(a -> {
            if (!(a instanceof JwtAuthenticationToken jwt)) return Mono.error(new AccessDeniedException("Identidad de conductor no vinculada"));
            return drivers.findAll().filter(d -> jwt.getToken().getSubject().equals(d.externalId()) && Boolean.TRUE.equals(d.isActive()))
                    .next().map(d -> d.id()).switchIfEmpty(Mono.error(new AccessDeniedException("La cuenta no está vinculada a un conductor activo")));
        });
    }
    public Mono<Boolean> mayReadRoute(Route route) {
        return managesOperation().flatMap(manager -> manager ? Mono.just(true) : driverId().map(id -> id.equals(route.driverId())));
    }
    public Mono<Boolean> mayReadOrder(Order order) {
        return managesOperation().flatMap(manager -> manager ? Mono.just(true) : order.routeId() == null
                ? Mono.just(false) : routes.findById(order.routeId()).flatMap(this::mayReadRoute).defaultIfEmpty(false));
    }
    public Mono<Order> requireOrder(Long id) {
        return orders.findById(id).switchIfEmpty(Mono.error(new ResourceNotFoundException("Pedido no encontrado")))
                .filterWhen(this::mayReadOrder).switchIfEmpty(Mono.error(new AccessDeniedException("El pedido no pertenece a su operación")));
    }
    public Mono<Route> requireRoute(Long id) {
        return routes.findById(id).switchIfEmpty(Mono.error(new ResourceNotFoundException("Ruta no encontrada")))
                .filterWhen(this::mayReadRoute).switchIfEmpty(Mono.error(new AccessDeniedException("La ruta no pertenece a su operación")));
    }
    public Mono<Void> requireVehicle(Long vehicleId) {
        return managesOperation().flatMap(manager -> manager ? Mono.empty() : driverId().flatMap(driver -> routes.findAll()
                .any(r -> driver.equals(r.driverId()) && vehicleId.equals(r.vehicleId()))
                .flatMap(allowed -> allowed ? Mono.empty() : Mono.error(new AccessDeniedException("Vehículo ajeno")))));
    }
}
