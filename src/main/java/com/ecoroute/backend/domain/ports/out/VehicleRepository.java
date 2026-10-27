package com.ecoroute.backend.domain.ports.out;

import com.ecoroute.backend.domain.model.Vehicle;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface VehicleRepository {
    Mono<Vehicle> save(Vehicle vehicle);
    Flux<Vehicle> findAll();
    Mono<Vehicle> findById(Long id);
    Mono<Void> deleteById(Long id);
}
