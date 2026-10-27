package com.ecoroute.backend.infrastructure.output.persistence;

import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Repository
public interface SpringDataNotificationRepository extends R2dbcRepository<NotificationEntity, Long> {
    Flux<NotificationEntity> findByIsReadFalseOrderByCreatedAtDesc();
    Mono<Long> countByIsReadFalse();
}
