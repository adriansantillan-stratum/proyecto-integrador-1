package com.ecoroute.backend.domain.ports.out;

import com.ecoroute.backend.domain.model.Notification;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface NotificationRepository {
    Mono<Notification> save(Notification notification);
    Flux<Notification> findAll();
    Flux<Notification> findByIsReadFalse();
    Mono<Notification> findById(Long id);
    Mono<Long> countByIsReadFalse();
}
