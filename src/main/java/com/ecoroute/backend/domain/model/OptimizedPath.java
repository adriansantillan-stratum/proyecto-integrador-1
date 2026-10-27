package com.ecoroute.backend.domain.model;

import java.util.List;

/**
 * Resultado de optimizar una ruta de reparto.
 *
 * @param stops       paradas con su orden de visita (1 = primera)
 * @param distanceKm  distancia total del recorrido
 * @param durationMin duración estimada de manejo
 * @param polyline    geometría del camino por calles (polyline5); null si el
 *                    cálculo vino del fallback en línea recta
 * @param source      "osrm" (calles reales) o "haversine" (fallback)
 */
public record OptimizedPath(
    List<RoutedStop> stops,
    double distanceKm,
    double durationMin,
    String polyline,
    String source
) {
    public record RoutedStop(Long orderId, int sequence) {}
}
