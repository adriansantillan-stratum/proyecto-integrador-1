package com.ecoroute.backend.infrastructure.output.persistence;

import com.ecoroute.backend.domain.model.Vehicle;
import com.ecoroute.backend.domain.ports.out.VehicleRepository;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Component
public class R2dbcVehicleRepository implements VehicleRepository {

    private final SpringDataVehicleRepository springDataVehicleRepository;

    public R2dbcVehicleRepository(SpringDataVehicleRepository springDataVehicleRepository) {
        this.springDataVehicleRepository = springDataVehicleRepository;
    }

    @Override
    public Mono<Vehicle> save(Vehicle vehicle) {
        VehicleEntity vehicleEntity = VehiclePersistenceMapper.toEntity(vehicle);
        return springDataVehicleRepository.save(vehicleEntity)
                .map(VehiclePersistenceMapper::toDomain);
    }

    @Override
    public Flux<Vehicle> findAll() {
        return springDataVehicleRepository.findAll()
                .map(VehiclePersistenceMapper::toDomain);
    }

    @Override
    public Mono<Vehicle> findById(Long id) {
        return springDataVehicleRepository.findById(id)
                .map(VehiclePersistenceMapper::toDomain);
    }

    @Override
    public Mono<Void> deleteById(Long id) {
        return springDataVehicleRepository.deleteById(id);
    }
}