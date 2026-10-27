package com.ecoroute.backend.infrastructure.output.persistence;

import com.ecoroute.backend.domain.model.Notification;

public class NotificationPersistenceMapper {

    public static Notification toDomain(NotificationEntity entity) {
        return new Notification(
                entity.getId(),
                entity.getType(),
                entity.getTitle(),
                entity.getMessage(),
                entity.getOrderId(),
                entity.getIsRead(),
                entity.getCreatedAt()
        );
    }

    public static NotificationEntity toEntity(Notification domain) {
        NotificationEntity entity = new NotificationEntity();
        entity.setId(domain.id());
        entity.setType(domain.type());
        entity.setTitle(domain.title());
        entity.setMessage(domain.message());
        entity.setOrderId(domain.orderId());
        entity.setIsRead(domain.isRead());
        entity.setCreatedAt(domain.createdAt());
        entity.setNewEntity(domain.id() == null);
        return entity;
    }
}
