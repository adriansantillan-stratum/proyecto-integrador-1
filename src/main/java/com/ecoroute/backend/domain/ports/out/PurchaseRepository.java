package com.ecoroute.backend.domain.ports.out;

import com.ecoroute.backend.domain.model.Purchase;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface PurchaseRepository {
    Mono<Purchase> save(Purchase purchase);
    Flux<Purchase> findAll();
    Mono<Purchase> findById(Long id);
    Mono<Void> deleteById(Long id);
}
