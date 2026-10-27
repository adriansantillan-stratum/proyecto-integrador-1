package com.ecoroute.backend.domain.ports.in;

import com.ecoroute.backend.domain.model.Route;
import com.ecoroute.backend.domain.model.RouteStatus;
import reactor.core.publisher.Mono;

public interface UpdateRouteStatusUseCase {
    Mono<Route> updateRouteStatus(Long id, RouteStatus status);
    Mono<Void> updateRouteStatusOnly(Long id, RouteStatus status);
}
