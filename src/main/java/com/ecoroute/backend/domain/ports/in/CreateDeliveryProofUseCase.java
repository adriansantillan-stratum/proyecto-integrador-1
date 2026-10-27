package com.ecoroute.backend.domain.ports.in;

import com.ecoroute.backend.domain.model.DeliveryProof;
import reactor.core.publisher.Mono;

public interface CreateDeliveryProofUseCase {
    Mono<DeliveryProof> createDeliveryProof(DeliveryProof deliveryProof);
}
