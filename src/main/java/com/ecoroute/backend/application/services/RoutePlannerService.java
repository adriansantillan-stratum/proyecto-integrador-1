package com.ecoroute.backend.application.services;

import com.ecoroute.backend.domain.model.OptimizedPath;
import com.ecoroute.backend.domain.model.Waypoint;
import com.ecoroute.backend.domain.ports.out.RoutingPort;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.List;

/**
 * Planifica el recorrido de una ruta: intenta OSRM (calles reales) y, si el
 * motor de ruteo no responde, degrada al vecino más cercano con distancias
 * haversine para que la operación nunca se detenga.
 */
@Service
@RequiredArgsConstructor
public class RoutePlannerService {

    private static final Logger log = LoggerFactory.getLogger(RoutePlannerService.class);

    // Punto de partida por defecto (hub Lima). Configurable por ruta en WS2.
    public static final double DEFAULT_START_LAT = -12.046374;
    public static final double DEFAULT_START_LON = -77.042793;

    private final RoutingPort routingPort;

    public Mono<OptimizedPath> plan(double startLat, double startLon,
                                    List<Waypoint> stops, boolean roundtrip) {
        if (stops.isEmpty()) {
            return Mono.just(new OptimizedPath(List.of(), 0.0, 0.0, null, "osrm"));
        }
        return routingPort.optimizePath(startLat, startLon, stops, roundtrip)
                .timeout(java.time.Duration.ofSeconds(5))
                .onErrorResume(e -> {
                    log.warn("OSRM no disponible ({}), usando fallback haversine", e.toString());
                    return Mono.just(haversineFallback(startLat, startLon, stops, roundtrip));
                });
    }

    /** Vecino más cercano con distancias en línea recta (comportamiento previo). */
    private OptimizedPath haversineFallback(double startLat, double startLon,
                                            List<Waypoint> stops, boolean roundtrip) {
        List<Waypoint> remaining = new ArrayList<>(stops);
        List<OptimizedPath.RoutedStop> sequence = new ArrayList<>();

        double currentLat = startLat;
        double currentLon = startLon;
        double totalDist = 0.0;
        int visit = 1;

        while (!remaining.isEmpty()) {
            Waypoint nearest = null;
            double minDistance = Double.MAX_VALUE;
            for (Waypoint w : remaining) {
                double d = haversine(currentLat, currentLon, w.latitude(), w.longitude());
                if (d < minDistance) {
                    minDistance = d;
                    nearest = w;
                }
            }
            totalDist += minDistance;
            currentLat = nearest.latitude();
            currentLon = nearest.longitude();
            sequence.add(new OptimizedPath.RoutedStop(nearest.orderId(), visit++));
            remaining.remove(nearest);
        }

        if (roundtrip) {
            totalDist += haversine(currentLat, currentLon, startLat, startLon);
        }

        // Sin geometría: el camino en línea recta lo dibujan los clientes
        return new OptimizedPath(sequence, Math.round(totalDist * 100.0) / 100.0,
                0.0, null, "haversine");
    }

    private double haversine(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371; // Radius of the earth in km
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
