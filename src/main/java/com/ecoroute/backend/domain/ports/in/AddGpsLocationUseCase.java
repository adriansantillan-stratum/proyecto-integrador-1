package com.ecoroute.backend.domain.ports.in;

import com.ecoroute.backend.domain.model.VehicleGpsHistory;
import reactor.core.publisher.Mono;

public interface AddGpsLocationUseCase {
    Mono<VehicleGpsHistory> addGpsLocation(VehicleGpsHistory history);
}
