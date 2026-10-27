package com.ecoroute.backend.domain.ports.in;

import com.ecoroute.backend.domain.model.Driver;
import reactor.core.publisher.Mono;

public interface CreateDriverUseCase {
    Mono<Driver> createDriver(Driver driver);
}
