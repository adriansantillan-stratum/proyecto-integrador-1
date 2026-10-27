package com.ecoroute.backend.infrastructure.output.persistence;

import com.ecoroute.backend.domain.model.Driver;

public class DriverPersistenceMapper {

    public static Driver toDomain(DriverEntity entity) {
        return new Driver(
                entity.getId(),
                entity.getExternalId(),
                entity.getFirstName(),
                entity.getLastName(),
                entity.getLicenseNumber(),
                entity.getPhoneNumber(),
                entity.getEmail(),
                entity.isActive(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    public static DriverEntity toEntity(Driver domain) {
        DriverEntity entity = new DriverEntity();
        entity.setId(domain.id());
        entity.setExternalId(domain.externalId());
        entity.setFirstName(domain.firstName());
        entity.setLastName(domain.lastName());
        entity.setLicenseNumber(domain.licenseNumber());
        entity.setPhoneNumber(domain.phoneNumber());
        entity.setEmail(domain.email());
        entity.setActive(domain.isActive());
        entity.setCreatedAt(domain.createdAt());
        entity.setUpdatedAt(domain.updatedAt());
        entity.setNew(domain.id() == null);
        return entity;
    }
}
