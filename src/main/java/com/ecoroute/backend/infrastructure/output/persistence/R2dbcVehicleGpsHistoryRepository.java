package com.ecoroute.backend.infrastructure.output.persistence;

import com.ecoroute.backend.domain.model.VehicleGpsHistory;
import com.ecoroute.backend.domain.ports.out.VehicleGpsHistoryRepository;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Component
public class R2dbcVehicleGpsHistoryRepository implements VehicleGpsHistoryRepository {

    private final SpringDataVehicleGpsHistoryRepository springDataRepository;

    public R2dbcVehicleGpsHistoryRepository(SpringDataVehicleGpsHistoryRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    public Mono<VehicleGpsHistory> save(VehicleGpsHistory history) {
        VehicleGpsHistoryEntity entity = VehicleGpsHistoryPersistenceMapper.toEntity(history);
        return springDataRepository.save(entity)
                .map(VehicleGpsHistoryPersistenceMapper::toDomain);
    }

    @Override
    public Flux<VehicleGpsHistory> findByVehicleIdOrderByPingTimeDesc(Long vehicleId) {
        return springDataRepository.findByVehicleIdOrderByPingTimeDesc(vehicleId)
                .map(VehicleGpsHistoryPersistenceMapper::toDomain);
    }
}
