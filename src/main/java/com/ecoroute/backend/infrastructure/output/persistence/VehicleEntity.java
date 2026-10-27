package com.ecoroute.backend.infrastructure.output.persistence;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.domain.Persistable;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.OffsetDateTime;

@Data
@Table("vehicles")
public class VehicleEntity implements Persistable<Long> {
    @Id
    @Column("id")
    private Long id;

    @Column("plate_number")
    private String plateNumber;

    @Column("model")
    private String model;

    @Column("brand")
    private String brand;

    @Column("capacity_kg")
    private Double capacityKg;

    @Column("capacity_m3")
    private Double capacityM3;

    @Column("is_active")
    private boolean active;

    @Column("created_at")
    private OffsetDateTime createdAt;

    @Transient
    private boolean isNew;

    @Override
    public boolean isNew() {
        return this.isNew || id == null;
    }
}
