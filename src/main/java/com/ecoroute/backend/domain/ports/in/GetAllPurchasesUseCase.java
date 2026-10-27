package com.ecoroute.backend.domain.ports.in;

import com.ecoroute.backend.domain.model.Purchase;
import reactor.core.publisher.Flux;

public interface GetAllPurchasesUseCase {
    Flux<Purchase> getAllPurchases();
}
