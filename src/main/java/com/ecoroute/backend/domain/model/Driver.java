package com.ecoroute.backend.domain.model;

import java.time.OffsetDateTime;

public record Driver(
    Long id,
    String externalId,
    String firstName,
    String lastName,
    String licenseNumber,
    String phoneNumber,
    String email,
    Boolean isActive,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {}
