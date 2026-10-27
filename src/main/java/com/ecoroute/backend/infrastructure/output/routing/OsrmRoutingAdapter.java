package com.ecoroute.backend.infrastructure.output.routing;

import com.ecoroute.backend.domain.model.OptimizedPath;
import com.ecoroute.backend.domain.model.Waypoint;
import com.ecoroute.backend.domain.ports.out.RoutingPort;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.StringJoiner;

/**
 * Adapter del servicio OSRM (Open Source Routing Machine) auto-hosteado.
 *
 * Dos pasos, porque OSRM no soporta TSP abierto (roundtrip=false con destino
 * libre): primero /trip (roundtrip) resuelve el ORDEN de visita, y luego
 * /route con las paradas ya ordenadas devuelve la geometría, distancia y
 * duración del recorrido real (con o sin regreso al punto de partida).
 */
@Component
public class OsrmRoutingAdapter implements RoutingPort {

    private static final Logger log = LoggerFactory.getLogger(OsrmRoutingAdapter.class);
    private static final Duration TIMEOUT = Duration.ofSeconds(5);

    private final WebClient webClient;

    public OsrmRoutingAdapter(@Value("${osrm.base-url:http://localhost:5000}") String baseUrl,
                              WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.baseUrl(baseUrl).build();
    }

    @Override
    public Mono<OptimizedPath> optimizePath(double startLat, double startLon,
                                            List<Waypoint> stops, boolean roundtrip) {
        if (stops.isEmpty()) {
            return Mono.just(new OptimizedPath(List.of(), 0.0, 0.0, null, "osrm"));
        }

        return resolveVisitOrder(startLat, startLon, stops)
                .flatMap(orderedStops -> fetchRoute(startLat, startLon, orderedStops, roundtrip));
    }

    /** Paso 1: /trip resuelve el orden óptimo de visita. */
    private Mono<List<Waypoint>> resolveVisitOrder(double startLat, double startLon,
                                                   List<Waypoint> stops) {
        String uri = String.format(
                "/trip/v1/driving/%s?source=first&roundtrip=true&overview=false",
                coordString(startLat, startLon, stops, false));

        return webClient.get()
                .uri(uri)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .timeout(TIMEOUT)
                .map(body -> {
                    requireOk(body, "/trip");
                    JsonNode waypoints = body.path("waypoints");
                    // waypoints está en orden de entrada; waypoint_index es la
                    // posición de visita (0 = inicio). Ordenamos las paradas.
                    List<Waypoint> ordered = new ArrayList<>(stops);
                    ordered.sort((a, b) -> Integer.compare(
                            visitIndex(waypoints, stops, a), visitIndex(waypoints, stops, b)));
                    return ordered;
                });
    }

    /** Paso 2: /route sobre las paradas ordenadas → geometría real. */
    private Mono<OptimizedPath> fetchRoute(double startLat, double startLon,
                                           List<Waypoint> orderedStops, boolean roundtrip) {
        String uri = String.format(
                "/route/v1/driving/%s?overview=full&geometries=polyline",
                coordString(startLat, startLon, orderedStops, roundtrip));

        return webClient.get()
                .uri(uri)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .timeout(TIMEOUT)
                .map(body -> {
                    requireOk(body, "/route");
                    JsonNode route = body.path("routes").path(0);
                    double distanceKm = Math.round(route.path("distance").asDouble() / 10.0) / 100.0;
                    double durationMin = Math.round(route.path("duration").asDouble() / 6.0) / 10.0;
                    String polyline = route.path("geometry").asText(null);

                    List<OptimizedPath.RoutedStop> routedStops = new ArrayList<>();
                    for (int i = 0; i < orderedStops.size(); i++) {
                        routedStops.add(new OptimizedPath.RoutedStop(
                                orderedStops.get(i).orderId(), i + 1));
                    }

                    log.debug("OSRM: {} paradas, {} km, {} min", routedStops.size(), distanceKm, durationMin);
                    return new OptimizedPath(routedStops, distanceKm, durationMin, polyline, "osrm");
                });
    }

    /** Coordenadas OSRM: lon,lat;lon,lat... — inicio primero, y de vuelta al inicio si roundtrip. */
    private String coordString(double startLat, double startLon, List<Waypoint> stops, boolean closeLoop) {
        StringJoiner coords = new StringJoiner(";");
        coords.add(String.format(Locale.ROOT, "%f,%f", startLon, startLat));
        for (Waypoint w : stops) {
            coords.add(String.format(Locale.ROOT, "%f,%f", w.longitude(), w.latitude()));
        }
        if (closeLoop) {
            coords.add(String.format(Locale.ROOT, "%f,%f", startLon, startLat));
        }
        return coords.toString();
    }

    private int visitIndex(JsonNode waypoints, List<Waypoint> stops, Waypoint stop) {
        int inputIndex = stops.indexOf(stop) + 1; // +1: el inicio ocupa el índice 0
        return waypoints.path(inputIndex).path("waypoint_index").asInt();
    }

    private void requireOk(JsonNode body, String endpoint) {
        if (!"Ok".equals(body.path("code").asText())) {
            throw new IllegalStateException(
                    "OSRM " + endpoint + " devolvió: " + body.path("code").asText());
        }
    }
}
