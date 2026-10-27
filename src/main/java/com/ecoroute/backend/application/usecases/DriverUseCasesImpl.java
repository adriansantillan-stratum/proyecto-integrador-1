package com.ecoroute.backend.application.usecases;

import com.ecoroute.backend.domain.exception.ResourceNotFoundException;
import com.ecoroute.backend.domain.model.Driver;
import com.ecoroute.backend.domain.ports.in.*;
import com.ecoroute.backend.domain.ports.out.DriverRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
@RequiredArgsConstructor
public class DriverUseCasesImpl implements
        CreateDriverUseCase, GetDriverByIdUseCase, GetAllDriversUseCase,
        UpdateDriverUseCase, DeleteDriverUseCase {

    private final DriverRepository driverRepository;

    @Override
    public Mono<Driver> createDriver(Driver driver) {
        return driverRepository.save(driver);
    }

    @Override
    public Mono<Driver> getDriverById(Long id) {
        return driverRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Driver not found with id: " + id)));
    }

    @Override
    public Flux<Driver> getAllDrivers() {
        return driverRepository.findAll();
    }

    @Override
    public Mono<Driver> updateDriver(Long id, Driver driver) {
        return driverRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Driver not found with id: " + id)))
                .flatMap(existingDriver -> {
                    Driver updatedDriver = new Driver(
                            existingDriver.id(),
                            existingDriver.externalId(), // Keep the original UUID
                            driver.firstName(),
                            driver.lastName(),
                            driver.licenseNumber(),
                            driver.phoneNumber(),
                            driver.email(),
                            driver.isActive(),
                            existingDriver.createdAt(),
                            java.time.OffsetDateTime.now()
                    );
                    return driverRepository.save(updatedDriver);
                });
    }

    @Override
    public Mono<Void> deleteDriver(Long id) {
        return driverRepository.deleteById(id);
    }
}
