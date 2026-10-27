package com.ecoroute.backend.domain.ports.in;

import reactor.core.publisher.Mono;

public interface DeleteVehicleUseCase {
    Mono<Void> deleteVehicle(Long id);
}
