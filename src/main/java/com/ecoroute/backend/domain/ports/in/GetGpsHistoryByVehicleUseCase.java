package com.ecoroute.backend.domain.ports.in;

import com.ecoroute.backend.domain.model.VehicleGpsHistory;
import reactor.core.publisher.Flux;

public interface GetGpsHistoryByVehicleUseCase {
    Flux<VehicleGpsHistory> getGpsHistory(Long vehicleId);
}
