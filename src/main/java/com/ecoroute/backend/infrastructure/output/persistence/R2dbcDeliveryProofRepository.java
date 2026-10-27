package com.ecoroute.backend.infrastructure.output.persistence;

import com.ecoroute.backend.domain.model.DeliveryProof;
import com.ecoroute.backend.domain.ports.out.DeliveryProofRepository;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

@Component
public class R2dbcDeliveryProofRepository implements DeliveryProofRepository {

    private final SpringDataDeliveryProofRepository springDataDeliveryProofRepository;

    public R2dbcDeliveryProofRepository(SpringDataDeliveryProofRepository springDataDeliveryProofRepository) {
        this.springDataDeliveryProofRepository = springDataDeliveryProofRepository;
    }

        @Override
        public Mono<DeliveryProof> save(DeliveryProof deliveryProof) {
            DeliveryProofEntity deliveryProofEntity = DeliveryProofPersistenceMapper.toEntity(deliveryProof);
            return springDataDeliveryProofRepository.save(deliveryProofEntity)
                    .map(DeliveryProofPersistenceMapper::toDomain);
        }
    
        @Override
        public Mono<DeliveryProof> findByOrderId(Long orderId) {
            return springDataDeliveryProofRepository.findByOrderId(orderId)
                    .map(DeliveryProofPersistenceMapper::toDomain);
        }
    }
    