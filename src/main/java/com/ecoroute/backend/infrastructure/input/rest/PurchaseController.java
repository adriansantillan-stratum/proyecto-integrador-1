package com.ecoroute.backend.infrastructure.input.rest;

import com.ecoroute.backend.domain.model.Purchase;
import com.ecoroute.backend.domain.ports.in.CreatePurchaseUseCase;
import com.ecoroute.backend.domain.ports.in.DeletePurchaseUseCase;
import com.ecoroute.backend.domain.ports.in.GetAllPurchasesUseCase;
import com.ecoroute.backend.domain.ports.in.UpdatePurchaseUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.OffsetDateTime;

@RestController
@RequestMapping("/purchases")
@RequiredArgsConstructor
public class PurchaseController {

    private final CreatePurchaseUseCase createPurchaseUseCase;
    private final GetAllPurchasesUseCase getAllPurchasesUseCase;
    private final UpdatePurchaseUseCase updatePurchaseUseCase;
    private final DeletePurchaseUseCase deletePurchaseUseCase;

    @PostMapping
    public Mono<Purchase> createPurchase(@jakarta.validation.Valid @RequestBody PurchaseRequest request) {
        Purchase purchase = new Purchase(
                null,
                request.description(),
                request.supplier(),
                request.amount(),
                request.status() != null ? request.status() : "PENDING",
                request.category(),
                request.notes(),
                OffsetDateTime.now(),
                OffsetDateTime.now()
        );
        return createPurchaseUseCase.createPurchase(purchase);
    }

    @GetMapping
    public Flux<Purchase> getAllPurchases() {
        return getAllPurchasesUseCase.getAllPurchases();
    }

    @PutMapping("/{id}")
    public Mono<Purchase> updatePurchase(@PathVariable Long id, @jakarta.validation.Valid @RequestBody PurchaseRequest request) {
        Purchase purchase = new Purchase(
                id,
                request.description(),
                request.supplier(),
                request.amount(),
                request.status(),
                request.category(),
                request.notes(),
                null,
                OffsetDateTime.now()
        );
        return updatePurchaseUseCase.updatePurchase(id, purchase);
    }

    @DeleteMapping("/{id}")
    public Mono<Void> deletePurchase(@PathVariable Long id) {
        return deletePurchaseUseCase.deletePurchase(id);
    }
}
