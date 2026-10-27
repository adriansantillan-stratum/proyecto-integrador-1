package com.ecoroute.backend.infrastructure.input.rest;

import com.ecoroute.backend.domain.model.Order;
import java.time.OffsetDateTime;

public class OrderRestMapper {

    public static Order toDomain(CreateOrderRequest request) {
        return new Order(
                null,
                request.trackingNumber(),
                request.externalReference(),
                request.routeId(),
                request.status(),
                request.recipientName(),
                request.recipientPhone(),
                request.recipientEmail(),
                request.deliveryAddress(),
                request.deliveryCity(),
                request.deliveryDistrict(),
                request.latitude(),
                request.longitude(),
                request.priority(),
                request.estimatedDeliveryWindowStart(),
                request.estimatedDeliveryWindowEnd(),
                OffsetDateTime.now(),
                OffsetDateTime.now()
        );
    }
}
