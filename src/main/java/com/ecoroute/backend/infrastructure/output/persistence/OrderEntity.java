package com.ecoroute.backend.infrastructure.output.persistence;

import com.ecoroute.backend.domain.model.OrderStatus;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.domain.Persistable;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.OffsetDateTime;

@Data
@Table("orders")
public class OrderEntity implements Persistable<Long> {
    @Id
    @Column("id")
    private Long id;

    @Column("tracking_number")
    private String trackingNumber;

    @Column("external_reference")
    private String externalReference;

    @Column("route_id")
    private Long routeId;

    @Column("status")
    private OrderStatus status;

    @Column("recipient_name")
    private String recipientName;

    @Column("recipient_phone")
    private String recipientPhone;

    @Column("recipient_email")
    private String recipientEmail;

    @Column("delivery_address")
    private String deliveryAddress;

    @Column("delivery_city")
    private String deliveryCity;

    @Column("delivery_district")
    private String deliveryDistrict;

    @Column("latitude")
    private Double latitude;

    @Column("longitude")
    private Double longitude;

    @Column("priority")
    private Integer priority;

    @Column("estimated_delivery_window_start")
    private OffsetDateTime estimatedDeliveryWindowStart;

    @Column("estimated_delivery_window_end")
    private OffsetDateTime estimatedDeliveryWindowEnd;

    @Column("created_at")
    private OffsetDateTime createdAt;

    @Column("updated_at")
    private OffsetDateTime updatedAt;

    @Transient
    private boolean isNew;

    @Override
    public boolean isNew() {
        return this.isNew || id == null;
    }
}