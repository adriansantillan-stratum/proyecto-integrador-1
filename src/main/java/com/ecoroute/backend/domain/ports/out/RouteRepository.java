package com.ecoroute.backend.domain.ports.out;

import com.ecoroute.backend.domain.model.Route;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDate;

public interface RouteRepository {
    Mono<Route> save(Route route);
    Mono<Route> findById(Long id);
    Mono<Route> lockById(Long id);
    Flux<Route> findByDriverIdAndDate(Long driverId, LocalDate date);
    Flux<Route> findAll();
    Flux<Route> findByFilters(LocalDate date, com.ecoroute.backend.domain.model.RouteStatus status);
    Mono<Void> deleteById(Long id);
    Mono<Integer> updatePathInfo(Long id, String geometry, Double durationMin);
}
