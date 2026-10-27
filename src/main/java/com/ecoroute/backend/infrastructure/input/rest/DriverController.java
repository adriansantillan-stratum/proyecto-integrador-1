package com.ecoroute.backend.infrastructure.input.rest;

import com.ecoroute.backend.domain.model.Driver;
import com.ecoroute.backend.domain.ports.in.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.OffsetDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/drivers")
@RequiredArgsConstructor
public class DriverController {

    private final CreateDriverUseCase createDriverUseCase;
    private final GetDriverByIdUseCase getDriverByIdUseCase;
    private final GetAllDriversUseCase getAllDriversUseCase;
    private final UpdateDriverUseCase updateDriverUseCase;
    private final DeleteDriverUseCase deleteDriverUseCase;
    private final com.ecoroute.backend.infrastructure.security.OperationalAccess access;

    @PostMapping
    public Mono<Driver> createDriver(@Valid @RequestBody DriverRequest request) {
        Driver driver = new Driver(
                null,
                UUID.randomUUID().toString(),
                request.firstName(),
                request.lastName(),
                request.licenseNumber(),
                request.phoneNumber(),
                request.email(),
                request.isActive(),
                OffsetDateTime.now(),
                OffsetDateTime.now()
        );
        return createDriverUseCase.createDriver(driver);
    }

    @GetMapping("/{id}")
    public Mono<Driver> getDriverById(@PathVariable Long id) {
        return getDriverByIdUseCase.getDriverById(id).filterWhen(driver -> access.managesOperation()
                .flatMap(manager -> manager ? Mono.just(true) : access.driverId().map(id::equals)))
                .switchIfEmpty(Mono.error(new org.springframework.security.access.AccessDeniedException("Conductor ajeno")));
    }

    @GetMapping
    public Flux<Driver> getAllDrivers() {
        return getAllDriversUseCase.getAllDrivers().filterWhen(driver -> access.managesOperation()
                .flatMap(manager -> manager ? Mono.just(true) : access.driverId().map(driver.id()::equals)));
    }

    @PutMapping("/{id}")
    public Mono<Driver> updateDriver(@PathVariable Long id, @Valid @RequestBody DriverRequest request) {
        Driver driver = new Driver(
                id,
                null,
                request.firstName(),
                request.lastName(),
                request.licenseNumber(),
                request.phoneNumber(),
                request.email(),
                request.isActive(),
                null,
                OffsetDateTime.now()
        );
        return updateDriverUseCase.updateDriver(id, driver);
    }

    @DeleteMapping("/{id}")
    public Mono<Void> deleteDriver(@PathVariable Long id) {
        return deleteDriverUseCase.deleteDriver(id);
    }
}
