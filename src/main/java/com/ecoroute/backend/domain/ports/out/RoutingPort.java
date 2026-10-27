package com.ecoroute.backend.domain.ports.out;

import com.ecoroute.backend.domain.model.OptimizedPath;
import com.ecoroute.backend.domain.model.Waypoint;
import reactor.core.publisher.Mono;

import java.util.List;

/** Motor de ruteo: ordena las paradas y devuelve el camino por calles. */
public interface RoutingPort {

    /**
     * Resuelve el orden óptimo de visita partiendo de (startLat, startLon).
     *
     * @param roundtrip si el vehículo vuelve al punto de partida (despacho
     *                  desde hub) o termina en la última parada (camino en
     *                  vivo desde la posición del conductor)
     */
    Mono<OptimizedPath> optimizePath(double startLat, double startLon,
                                     List<Waypoint> stops, boolean roundtrip);
}
