package com.ecoroute.backend.infrastructure.output.persistence;

import com.ecoroute.backend.domain.model.RouteStatus;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.domain.Persistable;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Data
@Table("routes")
public class RouteEntity implements Persistable<Long> {
    @Id
    @Column("id")
    private Long id;

    @Column("driver_id")
    private Long driverId;

    @Column("vehicle_id")
    private Long vehicleId;

    @Column("route_date")
    private LocalDate routeDate;

    @Column("status")
    private RouteStatus status;

    @Column("estimated_start_time")
    private OffsetDateTime estimatedStartTime;

    @Column("actual_start_time")
    private OffsetDateTime actualStartTime;

    @Column("actual_end_time")
    private OffsetDateTime actualEndTime;

    @Column("total_distance_km")
    private Double totalDistanceKm;

    @Column("created_at")
    private OffsetDateTime createdAt;

    @Transient
    private boolean isNew;

    @Override
    public boolean isNew() {
        return this.isNew || id == null;
    }
}
