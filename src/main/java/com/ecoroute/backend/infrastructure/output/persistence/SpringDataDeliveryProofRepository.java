package com.ecoroute.backend.infrastructure.output.persistence;

import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

@Repository
public interface SpringDataDeliveryProofRepository extends R2dbcRepository<DeliveryProofEntity, Long> {
    Mono<DeliveryProofEntity> findByOrderId(Long orderId);
}
