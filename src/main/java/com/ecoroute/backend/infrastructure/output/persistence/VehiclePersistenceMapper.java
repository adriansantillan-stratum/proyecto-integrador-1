package com.ecoroute.backend.infrastructure.output.persistence;

import com.ecoroute.backend.domain.model.Vehicle;

public class VehiclePersistenceMapper {

    public static Vehicle toDomain(VehicleEntity entity) {
        return new Vehicle(
                entity.getId(),
                entity.getPlateNumber(),
                entity.getModel(),
                entity.getBrand(),
                entity.getCapacityKg(),
                entity.getCapacityM3(),
                entity.isActive(),
                entity.getCreatedAt()
        );
    }

    public static VehicleEntity toEntity(Vehicle domain) {
        VehicleEntity entity = new VehicleEntity();
        entity.setId(domain.id());
        entity.setPlateNumber(domain.plateNumber());
        entity.setModel(domain.model());
        entity.setBrand(domain.brand());
        entity.setCapacityKg(domain.capacityKg());
        entity.setCapacityM3(domain.capacityM3());
        entity.setActive(domain.isActive());
        entity.setCreatedAt(domain.createdAt());
        entity.setNew(domain.id() == null);
        return entity;
    }
}
