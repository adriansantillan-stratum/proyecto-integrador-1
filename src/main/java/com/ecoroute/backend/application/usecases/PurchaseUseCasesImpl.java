package com.ecoroute.backend.application.usecases;

import com.ecoroute.backend.domain.model.Purchase;
import com.ecoroute.backend.domain.ports.in.CreatePurchaseUseCase;
import com.ecoroute.backend.domain.ports.in.DeletePurchaseUseCase;
import com.ecoroute.backend.domain.ports.in.GetAllPurchasesUseCase;
import com.ecoroute.backend.domain.ports.in.UpdatePurchaseUseCase;
import com.ecoroute.backend.domain.ports.out.PurchaseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.OffsetDateTime;

@Service
@RequiredArgsConstructor
public class PurchaseUseCasesImpl implements CreatePurchaseUseCase, GetAllPurchasesUseCase, UpdatePurchaseUseCase, DeletePurchaseUseCase {

    private final PurchaseRepository purchaseRepository;

    @Override
    public Mono<Purchase> createPurchase(Purchase purchase) {
        return purchaseRepository.save(purchase);
    }

    @Override
    public Flux<Purchase> getAllPurchases() {
        return purchaseRepository.findAll();
    }

    @Override
    public Mono<Purchase> updatePurchase(Long id, Purchase purchase) {
        return purchaseRepository.findById(id)
                .flatMap(existing -> {
                    Purchase updated = new Purchase(
                            id,
                            purchase.description(),
                            purchase.supplier(),
                            purchase.amount(),
                            purchase.status(),
                            purchase.category(),
                            purchase.notes(),
                            existing.createdAt(),
                            OffsetDateTime.now()
                    );
                    return purchaseRepository.save(updated);
                });
    }

    @Override
    public Mono<Void> deletePurchase(Long id) {
        return purchaseRepository.deleteById(id);
    }
}
