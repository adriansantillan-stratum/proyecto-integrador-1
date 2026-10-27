package com.ecoroute.backend.infrastructure.input.rest;

import com.ecoroute.backend.domain.model.OrderStatus;

public record UpdateStatusRequest(
    OrderStatus status,
    String reason
) {}
