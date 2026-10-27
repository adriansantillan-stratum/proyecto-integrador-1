package com.ecoroute.backend.infrastructure.output.persistence;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.domain.Persistable;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.OffsetDateTime;

@Data
@Table("drivers")
public class DriverEntity implements Persistable<Long> {
    @Id
    @Column("id")
    private Long id;

    @Column("external_id")
    private String externalId;

    @Column("first_name")
    private String firstName;

    @Column("last_name")
    private String lastName;

    @Column("license_number")
    private String licenseNumber;

    @Column("phone_number")
    private String phoneNumber;

    @Column("email")
    private String email;

    @Column("is_active")
    private boolean active;

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
