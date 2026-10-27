package com.ecoroute.backend.domain.model;

import java.time.OffsetDateTime;

public record Order(
    Long id,
    String trackingNumber,
    String externalReference,
    Long routeId,
    OrderStatus status,
    
    // Recipient Info
    String recipientName,
    String recipientPhone,
    String recipientEmail,
    
    // Delivery Address
    String deliveryAddress,
    String deliveryCity,
    String deliveryDistrict,
    Double latitude,
    Double longitude,
    
    // Constraints
    Integer priority,
    OffsetDateTime estimatedDeliveryWindowStart,
    OffsetDateTime estimatedDeliveryWindowEnd,
    
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
    public Order withAssignment(Long assignedRoute, OrderStatus newStatus) {
        return new Order(id, trackingNumber, externalReference, assignedRoute, newStatus,
                recipientName, recipientPhone, recipientEmail, deliveryAddress, deliveryCity,
                deliveryDistrict, latitude, longitude, priority, estimatedDeliveryWindowStart,
                estimatedDeliveryWindowEnd, createdAt, OffsetDateTime.now());
    }
    public Order withStatus(OrderStatus newStatus) { return withAssignment(routeId, newStatus); }
}
