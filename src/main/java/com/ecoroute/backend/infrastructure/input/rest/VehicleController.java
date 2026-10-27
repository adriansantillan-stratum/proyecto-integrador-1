package com.ecoroute.backend.infrastructure.input.rest;

import com.ecoroute.backend.domain.model.Vehicle;
import com.ecoroute.backend.domain.ports.in.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.OffsetDateTime;

@RestController
@RequestMapping("/vehicles")
@RequiredArgsConstructor
public class VehicleController {

    private final CreateVehicleUseCase createVehicleUseCase;
    private final GetVehicleByIdUseCase getVehicleByIdUseCase;
    private final GetAllVehiclesUseCase getAllVehiclesUseCase;
    private final UpdateVehicleUseCase updateVehicleUseCase;
    private final DeleteVehicleUseCase deleteVehicleUseCase;
    private final com.ecoroute.backend.infrastructure.security.OperationalAccess access;

    @PostMapping
    public Mono<Vehicle> createVehicle(@Valid @RequestBody VehicleRequest request) {
        Vehicle vehicle = new Vehicle(
                null,
                request.plateNumber(),
                request.model(),
                request.brand(),
                request.capacityKg(),
                request.capacityM3(),
                request.isActive(),
                OffsetDateTime.now()
        );
        return createVehicleUseCase.createVehicle(vehicle);
    }

    @GetMapping("/{id}")
    public Mono<Vehicle> getVehicleById(@PathVariable Long id) {
        return access.requireVehicle(id).then(getVehicleByIdUseCase.getVehicleById(id));
    }

    @GetMapping
    public Flux<Vehicle> getAllVehicles() {
        return getAllVehiclesUseCase.getAllVehicles().filterWhen(vehicle -> access.requireVehicle(vehicle.id())
                .thenReturn(true).onErrorReturn(org.springframework.security.access.AccessDeniedException.class,false));
    }

    @PutMapping("/{id}")
    public Mono<Vehicle> updateVehicle(@PathVariable Long id, @Valid @RequestBody VehicleRequest request) {
        Vehicle vehicle = new Vehicle(
                id,
                request.plateNumber(),
                request.model(),
                request.brand(),
                request.capacityKg(),
                request.capacityM3(),
                request.isActive(),
                null
        );
        return updateVehicleUseCase.updateVehicle(id, vehicle);
    }

    @DeleteMapping("/{id}")
    public Mono<Void> deleteVehicle(@PathVariable Long id) {
        return deleteVehicleUseCase.deleteVehicle(id);
    }
}
