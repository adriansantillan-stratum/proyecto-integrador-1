package com.ecoroute.backend.infrastructure.input.rest;

public record AddGpsLocationRequest(
    @jakarta.validation.constraints.NotNull Long vehicleId,
    @jakarta.validation.constraints.NotNull Long driverId,
    @jakarta.validation.constraints.NotNull @jakarta.validation.constraints.DecimalMin("-90") @jakarta.validation.constraints.DecimalMax("90") Double latitude,
    @jakarta.validation.constraints.NotNull @jakarta.validation.constraints.DecimalMin("-180") @jakarta.validation.constraints.DecimalMax("180") Double longitude,
    @jakarta.validation.constraints.NotNull @jakarta.validation.constraints.PositiveOrZero Double speedKmh,
    Integer headingDegrees
) {}
