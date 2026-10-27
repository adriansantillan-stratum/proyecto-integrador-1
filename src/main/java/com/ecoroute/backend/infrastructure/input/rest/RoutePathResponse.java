package com.ecoroute.backend.infrastructure.input.rest;

import java.util.List;

/**
 * Camino calculado para una ruta.
 *
 * @param polyline        geometría por calles (polyline5); null si vino del
 *                        fallback en línea recta
 * @param orderedOrderIds ids de pedidos en orden óptimo de visita
 * @param source          "osrm" o "haversine"
 */
public record RoutePathResponse(
    String polyline,
    List<Long> orderedOrderIds,
    double distanceKm,
    double durationMin,
    String source
) {}
