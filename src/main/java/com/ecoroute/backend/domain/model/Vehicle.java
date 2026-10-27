package com.ecoroute.backend.domain.model;

import java.time.OffsetDateTime;

public record Vehicle(
    Long id,
    String plateNumber,
    String model,
    String brand,
    Double capacityKg,
    Double capacityM3,
    Boolean isActive,
    OffsetDateTime createdAt
) {}
