package com.ecoroute.backend.domain.ports.in;

import com.ecoroute.backend.domain.model.Driver;
import reactor.core.publisher.Flux;

public interface GetAllDriversUseCase {
    Flux<Driver> getAllDrivers();
}
