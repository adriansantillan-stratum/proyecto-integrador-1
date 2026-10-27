package com.ecoroute.backend.domain.model;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record Purchase(
    Long id,
    String description,
    String supplier,
    BigDecimal amount,
    String status,
    String category,
    String notes,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {}
