package com.ecoroute.backend.domain.ports.out;

import com.ecoroute.backend.domain.model.DeliveryProof;
import reactor.core.publisher.Mono;

public interface DeliveryProofRepository {
    Mono<DeliveryProof> save(DeliveryProof deliveryProof);
    Mono<DeliveryProof> findByOrderId(Long orderId);
}
