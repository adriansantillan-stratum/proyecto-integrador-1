package com.ecoroute.backend.infrastructure.output.persistence;

import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;

@Repository
public interface SpringDataVehicleGpsHistoryRepository extends R2dbcRepository<VehicleGpsHistoryEntity, Long> {
    Flux<VehicleGpsHistoryEntity> findByVehicleIdOrderByPingTimeDesc(Long vehicleId);
}
