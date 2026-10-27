package com.ecoroute.backend.infrastructure.output.persistence;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.domain.Persistable;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

@Data
@Table("auth_user_role")
public class UserRoleEntity implements Persistable<Long> {
    @Id
    @Column("user_role_id")
    private Long id;

    @Column("user_external_id")
    private String userExternalId;

    @Column("role_id")
    private Long roleId;

    @Transient
    private boolean newEntity = true;

    @Override
    public boolean isNew() {
        return this.newEntity || id == null;
    }
}
