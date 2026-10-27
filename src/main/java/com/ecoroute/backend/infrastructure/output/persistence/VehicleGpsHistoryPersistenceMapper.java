package com.ecoroute.backend.infrastructure.output.persistence;

import com.ecoroute.backend.domain.model.VehicleGpsHistory;

public class VehicleGpsHistoryPersistenceMapper {

    public static VehicleGpsHistory toDomain(VehicleGpsHistoryEntity entity) {
        return new VehicleGpsHistory(
                entity.getId(),
                entity.getVehicleId(),
                entity.getDriverId(),
                entity.getLatitude(),
                entity.getLongitude(),
                entity.getSpeedKmh(),
                entity.getHeadingDegrees(),
                entity.getPingTime()
        );
    }

    public static VehicleGpsHistoryEntity toEntity(VehicleGpsHistory domain) {
        VehicleGpsHistoryEntity entity = new VehicleGpsHistoryEntity();
        entity.setId(domain.id());
        entity.setVehicleId(domain.vehicleId());
        entity.setDriverId(domain.driverId());
        entity.setLatitude(domain.latitude());
        entity.setLongitude(domain.longitude());
        entity.setSpeedKmh(domain.speedKmh());
        entity.setHeadingDegrees(domain.headingDegrees());
        entity.setPingTime(domain.pingTime());
        entity.setNew(domain.id() == null);
        return entity;
    }
}
