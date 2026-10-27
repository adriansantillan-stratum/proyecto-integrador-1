package com.ecoroute.backend.domain.ports.in;

import com.ecoroute.backend.domain.model.Vehicle;
import reactor.core.publisher.Flux;

public interface GetAllVehiclesUseCase {
    Flux<Vehicle> getAllVehicles();
}
