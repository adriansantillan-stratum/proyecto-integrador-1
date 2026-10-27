package com.ecoroute.backend.domain.ports.in;

import com.ecoroute.backend.domain.model.Driver;
import reactor.core.publisher.Mono;

public interface GetDriverByIdUseCase {
    Mono<Driver> getDriverById(Long id);
}
