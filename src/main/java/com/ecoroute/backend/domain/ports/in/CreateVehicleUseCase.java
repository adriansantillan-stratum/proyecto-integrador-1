package com.ecoroute.backend.domain.ports.in;

import com.ecoroute.backend.domain.model.Vehicle;
import reactor.core.publisher.Mono;

public interface CreateVehicleUseCase {
    Mono<Vehicle> createVehicle(Vehicle vehicle);
}
