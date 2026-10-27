package com.ecoroute.backend.domain.model;

import java.time.OffsetDateTime;

public record VehicleGpsHistory(
    Long id,
    Long vehicleId,
    Long driverId,
    Double latitude,
    Double longitude,
    Double speedKmh,
    Integer headingDegrees,
    OffsetDateTime pingTime
) {}
