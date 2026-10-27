package com.ecoroute.backend.infrastructure.output.persistence;

import com.ecoroute.backend.domain.model.DeliveryProof;

public class DeliveryProofPersistenceMapper {

    public static DeliveryProof toDomain(DeliveryProofEntity entity) {
        return new DeliveryProof(
                entity.getId(),
                entity.getOrderId(),
                entity.getImageUrl(),
                entity.getSignatureDataUrl(),
                entity.getReceiverName(),
                entity.getReceiverDni(),
                entity.getVerifiedAt(),
                entity.getLatitude(),
                entity.getLongitude()
        );
    }

    public static DeliveryProofEntity toEntity(DeliveryProof domain) {
        DeliveryProofEntity entity = new DeliveryProofEntity();
        entity.setId(domain.id());
        entity.setOrderId(domain.orderId());
        entity.setImageUrl(domain.imageUrl());
        entity.setSignatureDataUrl(domain.signatureDataUrl());
        entity.setReceiverName(domain.receiverName());
        entity.setReceiverDni(domain.receiverDni());
        entity.setVerifiedAt(domain.verifiedAt());
        entity.setLatitude(domain.latitude());
        entity.setLongitude(domain.longitude());
        entity.setNew(domain.id() == null);
        return entity;
    }
}
