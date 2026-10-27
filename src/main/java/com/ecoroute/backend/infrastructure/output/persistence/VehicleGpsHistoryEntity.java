package com.ecoroute.backend.infrastructure.output.persistence;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.domain.Persistable;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.OffsetDateTime;

@Data
@Table("vehicle_gps_history")
public class VehicleGpsHistoryEntity implements Persistable<Long> {
    @Id
    @Column("id")
    private Long id;

    @Column("vehicle_id")
    private Long vehicleId;

    @Column("driver_id")
    private Long driverId;

    @Column("latitude")
    private Double latitude;

    @Column("longitude")
    private Double longitude;

    @Column("speed_kmh")
    private Double speedKmh;

    @Column("heading_degrees")
    private Integer headingDegrees;

    @Column("ping_time")
    private OffsetDateTime pingTime;

    @Transient
    private boolean isNew;

    @Override
    public boolean isNew() {
        return this.isNew || id == null;
    }
}
