package com.ecoroute.backend.domain.ports.in;

import com.ecoroute.backend.domain.model.Vehicle;
import reactor.core.publisher.Mono;

public interface UpdateVehicleUseCase {
    Mono<Vehicle> updateVehicle(Long id, Vehicle vehicle);
}
