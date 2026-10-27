package com.ecoroute.backend.domain.ports.in;

import com.ecoroute.backend.domain.model.Route;
import com.ecoroute.backend.domain.model.RouteStatus;
import reactor.core.publisher.Flux;
import java.time.LocalDate;

public interface GetAllRoutesUseCase {
    Flux<Route> getAllRoutes();
    Flux<Route> getRoutesByFilters(LocalDate date, RouteStatus status);
}
