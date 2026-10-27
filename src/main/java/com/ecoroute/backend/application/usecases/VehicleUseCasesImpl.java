package com.ecoroute.backend.application.usecases;

import com.ecoroute.backend.domain.exception.ResourceNotFoundException;
import com.ecoroute.backend.domain.model.Vehicle;
import com.ecoroute.backend.domain.ports.in.*;
import com.ecoroute.backend.domain.ports.out.VehicleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
@RequiredArgsConstructor
public class VehicleUseCasesImpl implements
        CreateVehicleUseCase, GetVehicleByIdUseCase, GetAllVehiclesUseCase,
        UpdateVehicleUseCase, DeleteVehicleUseCase {

    private final VehicleRepository vehicleRepository;

    @Override
    public Mono<Vehicle> createVehicle(Vehicle vehicle) {
        return vehicleRepository.save(vehicle);
    }

    @Override
    public Mono<Vehicle> getVehicleById(Long id) {
        return vehicleRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Vehicle not found with id: " + id)));
    }

    @Override
    public Flux<Vehicle> getAllVehicles() {
        return vehicleRepository.findAll();
    }

    @Override
    public Mono<Vehicle> updateVehicle(Long id, Vehicle vehicle) {
        return vehicleRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Vehicle not found with id: " + id)))
                .flatMap(existingVehicle -> {
                    Vehicle updatedVehicle = new Vehicle(
                            existingVehicle.id(),
                            vehicle.plateNumber(),
                            vehicle.model(),
                            vehicle.brand(),
                            vehicle.capacityKg(),
                            vehicle.capacityM3(),
                            vehicle.isActive(),
                            existingVehicle.createdAt()
                    );
                    return vehicleRepository.save(updatedVehicle);
                });
    }

    @Override
    public Mono<Void> deleteVehicle(Long id) {
        return vehicleRepository.deleteById(id);
    }
}
