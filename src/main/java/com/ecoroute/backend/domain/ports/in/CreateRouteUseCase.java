package com.ecoroute.backend.domain.ports.in;

import com.ecoroute.backend.domain.model.Route;
import reactor.core.publisher.Mono;

public interface CreateRouteUseCase {
    Mono<Route> createRoute(Route route);
}
