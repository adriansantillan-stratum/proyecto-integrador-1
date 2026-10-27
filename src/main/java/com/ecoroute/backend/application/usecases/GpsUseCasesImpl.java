package com.ecoroute.backend.application.usecases;

import com.ecoroute.backend.domain.model.VehicleGpsHistory;
import com.ecoroute.backend.domain.ports.in.AddGpsLocationUseCase;
import com.ecoroute.backend.domain.ports.in.GetGpsHistoryByVehicleUseCase;
import com.ecoroute.backend.domain.ports.out.VehicleGpsHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
@RequiredArgsConstructor
public class GpsUseCasesImpl implements AddGpsLocationUseCase, GetGpsHistoryByVehicleUseCase {

    private final VehicleGpsHistoryRepository gpsHistoryRepository;

    @Override
    public Mono<VehicleGpsHistory> addGpsLocation(VehicleGpsHistory history) {
        return gpsHistoryRepository.save(history);
    }

    @Override
    public Flux<VehicleGpsHistory> getGpsHistory(Long vehicleId) {
        return gpsHistoryRepository.findByVehicleIdOrderByPingTimeDesc(vehicleId);
    }
}
