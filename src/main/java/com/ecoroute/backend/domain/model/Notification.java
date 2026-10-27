package com.ecoroute.backend.domain.model;

import java.time.OffsetDateTime;

public record Notification(
    Long id,
    String type,
    String title,
    String message,
    Long orderId,
    Boolean isRead,
    OffsetDateTime createdAt
) {}
