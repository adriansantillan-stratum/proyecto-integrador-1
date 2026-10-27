package com.ecoroute.backend.domain.ports.in;

import com.ecoroute.backend.domain.model.Purchase;
import reactor.core.publisher.Mono;

public interface UpdatePurchaseUseCase {
    Mono<Purchase> updatePurchase(Long id, Purchase purchase);
}
