package com.ecoroute.backend.infrastructure.output.persistence;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.domain.Persistable;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.OffsetDateTime;

@Data
@Table("notifications")
public class NotificationEntity implements Persistable<Long> {
    @Id
    @Column("id")
    private Long id;

    @Column("type")
    private String type;

    @Column("title")
    private String title;

    @Column("message")
    private String message;

    @Column("order_id")
    private Long orderId;

    @Column("is_read")
    private Boolean isRead;

    @Column("created_at")
    private OffsetDateTime createdAt;

    @Transient
    private boolean newEntity;

    @Override
    public boolean isNew() {
        return this.newEntity || id == null;
    }
}
