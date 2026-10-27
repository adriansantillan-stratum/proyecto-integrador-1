package com.ecoroute.backend.infrastructure.output.persistence;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.domain.Persistable;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Data
@Table("purchases")
public class PurchaseEntity implements Persistable<Long> {
    @Id
    @Column("id")
    private Long id;

    @Column("description")
    private String description;

    @Column("supplier")
    private String supplier;

    @Column("amount")
    private BigDecimal amount;

    @Column("status")
    private String status;

    @Column("category")
    private String category;

    @Column("notes")
    private String notes;

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
