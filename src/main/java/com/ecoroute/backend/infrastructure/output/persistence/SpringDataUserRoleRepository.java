package com.ecoroute.backend.infrastructure.output.persistence;

import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;

@Repository
public interface SpringDataUserRoleRepository extends R2dbcRepository<UserRoleEntity, Long> {
    Flux<UserRoleEntity> findByUserExternalId(String userExternalId);
}
