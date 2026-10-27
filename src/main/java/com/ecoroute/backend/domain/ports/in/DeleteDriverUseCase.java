package com.ecoroute.backend.domain.ports.in;

import reactor.core.publisher.Mono;

public interface DeleteDriverUseCase {
    Mono<Void> deleteDriver(Long id);
}
