package com.ecoroute.backend.infrastructure.output.persistence;

import com.ecoroute.backend.domain.model.Purchase;
import com.ecoroute.backend.domain.ports.out.PurchaseRepository;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Component
public class R2dbcPurchaseRepository implements PurchaseRepository {

    private final SpringDataPurchaseRepository springDataPurchaseRepository;

    public R2dbcPurchaseRepository(SpringDataPurchaseRepository springDataPurchaseRepository) {
        this.springDataPurchaseRepository = springDataPurchaseRepository;
    }

    @Override
    public Mono<Purchase> save(Purchase purchase) {
        PurchaseEntity entity = PurchasePersistenceMapper.toEntity(purchase);
        return springDataPurchaseRepository.save(entity)
                .map(PurchasePersistenceMapper::toDomain);
    }

    @Override
    public Flux<Purchase> findAll() {
        return springDataPurchaseRepository.findAll()
                .map(PurchasePersistenceMapper::toDomain);
    }

    @Override
    public Mono<Purchase> findById(Long id) {
        return springDataPurchaseRepository.findById(id)
                .map(PurchasePersistenceMapper::toDomain);
    }

    @Override
    public Mono<Void> deleteById(Long id) {
        return springDataPurchaseRepository.deleteById(id);
    }
}
