package com.ecoroute.backend.infrastructure.output.persistence;

import com.ecoroute.backend.domain.model.Route;

public class RoutePersistenceMapper {

    public static Route toDomain(RouteEntity entity) {
        return new Route(
                entity.getId(),
                entity.getDriverId(),
                entity.getVehicleId(),
                entity.getRouteDate(),
                entity.getStatus(),
                entity.getEstimatedStartTime(),
                entity.getActualStartTime(),
                entity.getActualEndTime(),
                entity.getTotalDistanceKm(),
                entity.getCreatedAt()
        );
    }

    public static RouteEntity toEntity(Route domain) {
        RouteEntity entity = new RouteEntity();
        entity.setId(domain.id());
        entity.setDriverId(domain.driverId());
        entity.setVehicleId(domain.vehicleId());
        entity.setRouteDate(domain.routeDate());
        entity.setStatus(domain.status());
        entity.setEstimatedStartTime(domain.estimatedStartTime());
        entity.setActualStartTime(domain.actualStartTime());
        entity.setActualEndTime(domain.actualEndTime());
        entity.setTotalDistanceKm(domain.totalDistanceKm());
        entity.setCreatedAt(domain.createdAt());
        entity.setNew(domain.id() == null);
        return entity;
    }
}
