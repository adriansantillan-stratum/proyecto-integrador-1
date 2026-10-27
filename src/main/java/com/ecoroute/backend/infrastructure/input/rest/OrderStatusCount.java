package com.ecoroute.backend.infrastructure.input.rest;

public record OrderStatusCount(
    String status,
    Long count
) {}
