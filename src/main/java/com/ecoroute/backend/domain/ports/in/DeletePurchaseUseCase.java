package com.ecoroute.backend.domain.ports.in;

import reactor.core.publisher.Mono;

public interface DeletePurchaseUseCase {
    Mono<Void> deletePurchase(Long id);
}
