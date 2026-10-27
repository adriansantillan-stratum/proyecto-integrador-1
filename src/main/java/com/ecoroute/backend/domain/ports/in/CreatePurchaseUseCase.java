package com.ecoroute.backend.domain.ports.in;

import com.ecoroute.backend.domain.model.Purchase;
import reactor.core.publisher.Mono;

public interface CreatePurchaseUseCase {
    Mono<Purchase> createPurchase(Purchase purchase);
}
