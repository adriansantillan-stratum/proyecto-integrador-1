package com.ecoroute.backend.domain.ports.out;

import com.ecoroute.backend.domain.model.VehicleGpsHistory;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface VehicleGpsHistoryRepository {
    Mono<VehicleGpsHistory> save(VehicleGpsHistory history);
    Flux<VehicleGpsHistory> findByVehicleIdOrderByPingTimeDesc(Long vehicleId);
}
