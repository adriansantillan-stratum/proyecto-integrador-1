package com.ecoroute.backend.infrastructure.input.rest;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record CreateRouteRequest(
    @jakarta.validation.constraints.NotNull Long driverId,
    @jakarta.validation.constraints.NotNull Long vehicleId,
    @jakarta.validation.constraints.NotNull LocalDate routeDate,
    OffsetDateTime estimatedStartTime
) {}
