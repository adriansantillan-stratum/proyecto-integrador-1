package com.ecoroute.backend.domain.model;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record Route(
    Long id,
    Long driverId,
    Long vehicleId,
    LocalDate routeDate,
    RouteStatus status,
    OffsetDateTime estimatedStartTime,
    OffsetDateTime actualStartTime,
    OffsetDateTime actualEndTime,
    Double totalDistanceKm,
    OffsetDateTime createdAt
) {}
