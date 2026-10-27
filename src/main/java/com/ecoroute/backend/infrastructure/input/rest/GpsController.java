package com.ecoroute.backend.infrastructure.input.rest;

import com.ecoroute.backend.domain.model.VehicleGpsHistory;
import com.ecoroute.backend.domain.ports.in.AddGpsLocationUseCase;
import com.ecoroute.backend.domain.ports.in.GetGpsHistoryByVehicleUseCase;
import com.ecoroute.backend.infrastructure.input.websocket.GpsWebSocketHandler;
import com.ecoroute.backend.infrastructure.security.OperationalAccess;
import com.ecoroute.backend.domain.ports.out.RouteRepository;
import org.springframework.security.access.AccessDeniedException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.OffsetDateTime;

@RestController
@RequestMapping("/gps")
@RequiredArgsConstructor
public class GpsController {

    private final AddGpsLocationUseCase addGpsLocationUseCase;
    private final GetGpsHistoryByVehicleUseCase getGpsHistoryByVehicleUseCase;
    private final GpsWebSocketHandler gpsWebSocketHandler;
    private final OperationalAccess access;
    private final RouteRepository routes;

    @PostMapping("/ping")
    public Mono<VehicleGpsHistory> addLocation(@Valid @RequestBody AddGpsLocationRequest request) {
        VehicleGpsHistory history = new VehicleGpsHistory(
                null,
                request.vehicleId(),
                request.driverId(),
                request.latitude(),
                request.longitude(),
                request.speedKmh(),
                request.headingDegrees(),
                OffsetDateTime.now()
        );
        return access.requireVehicle(request.vehicleId()).then(routes.findAll()
                .filter(r -> request.vehicleId().equals(r.vehicleId()) && request.driverId().equals(r.driverId())
                        && r.status()==com.ecoroute.backend.domain.model.RouteStatus.IN_PROGRESS)
                .next().switchIfEmpty(Mono.error(new AccessDeniedException("GPS requiere el conductor y vehículo de una ruta activa"))))
                .then(access.managesOperation().flatMap(manager -> manager ? Mono.empty()
                        : access.driverId().flatMap(id -> id.equals(request.driverId()) ? Mono.empty()
                                : Mono.error(new AccessDeniedException("Conductor GPS ajeno")))))
                .then(addGpsLocationUseCase.addGpsLocation(history))
                .flatMap(saved -> gpsWebSocketHandler.broadcastLocation(
                        saved.vehicleId(), saved.latitude(), saved.longitude(), saved.speedKmh()
                ).thenReturn(saved));
    }

    @GetMapping("/history/{vehicleId}")
    public Flux<VehicleGpsHistory> getHistory(@PathVariable Long vehicleId) {
        return access.requireVehicle(vehicleId).thenMany(getGpsHistoryByVehicleUseCase.getGpsHistory(vehicleId));
    }
}
