package com.ecoroute.backend.domain.model;

/** Parada a visitar: el pedido y sus coordenadas. */
public record Waypoint(
    Long orderId,
    double latitude,
    double longitude
) {}
