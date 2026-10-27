package com.ecoroute.backend.infrastructure.output.persistence;

import com.ecoroute.backend.domain.model.Order;

public class OrderPersistenceMapper {

    public static Order toDomain(OrderEntity entity) {
        return new Order(
                entity.getId(),
                entity.getTrackingNumber(),
                entity.getExternalReference(),
                entity.getRouteId(),
                entity.getStatus(),
                entity.getRecipientName(),
                entity.getRecipientPhone(),
                entity.getRecipientEmail(),
                entity.getDeliveryAddress(),
                entity.getDeliveryCity(),
                entity.getDeliveryDistrict(),
                entity.getLatitude(),
                entity.getLongitude(),
                entity.getPriority(),
                entity.getEstimatedDeliveryWindowStart(),
                entity.getEstimatedDeliveryWindowEnd(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    public static OrderEntity toEntity(Order domain) {
        OrderEntity entity = new OrderEntity();
        entity.setId(domain.id());
        entity.setTrackingNumber(domain.trackingNumber());
        entity.setExternalReference(domain.externalReference());
        entity.setRouteId(domain.routeId());
        entity.setStatus(domain.status());
        entity.setRecipientName(domain.recipientName());
        entity.setRecipientPhone(domain.recipientPhone());
        entity.setRecipientEmail(domain.recipientEmail());
        entity.setDeliveryAddress(domain.deliveryAddress());
        entity.setDeliveryCity(domain.deliveryCity());
        entity.setDeliveryDistrict(domain.deliveryDistrict());
        entity.setLatitude(domain.latitude());
        entity.setLongitude(domain.longitude());
        entity.setPriority(domain.priority());
        entity.setEstimatedDeliveryWindowStart(domain.estimatedDeliveryWindowStart());
        entity.setEstimatedDeliveryWindowEnd(domain.estimatedDeliveryWindowEnd());
        entity.setCreatedAt(domain.createdAt());
        entity.setUpdatedAt(domain.updatedAt());
        entity.setNew(domain.id() == null);
        return entity;
    }
}