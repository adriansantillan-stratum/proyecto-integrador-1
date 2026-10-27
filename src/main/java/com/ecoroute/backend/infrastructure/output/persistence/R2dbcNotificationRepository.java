package com.ecoroute.backend.infrastructure.output.persistence;

import com.ecoroute.backend.domain.model.Notification;
import com.ecoroute.backend.domain.ports.out.NotificationRepository;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Component
public class R2dbcNotificationRepository implements NotificationRepository {

    private final SpringDataNotificationRepository springDataNotificationRepository;

    public R2dbcNotificationRepository(SpringDataNotificationRepository springDataNotificationRepository) {
        this.springDataNotificationRepository = springDataNotificationRepository;
    }

    @Override
    public Mono<Notification> save(Notification notification) {
        NotificationEntity entity = NotificationPersistenceMapper.toEntity(notification);
        return springDataNotificationRepository.save(entity)
                .map(NotificationPersistenceMapper::toDomain);
    }

    @Override
    public Flux<Notification> findAll() {
        return springDataNotificationRepository.findAll()
                .map(NotificationPersistenceMapper::toDomain);
    }

    @Override
    public Flux<Notification> findByIsReadFalse() {
        return springDataNotificationRepository.findByIsReadFalseOrderByCreatedAtDesc()
                .map(NotificationPersistenceMapper::toDomain);
    }

    @Override
    public Mono<Notification> findById(Long id) {
        return springDataNotificationRepository.findById(id)
                .map(NotificationPersistenceMapper::toDomain);
    }

    @Override
    public Mono<Long> countByIsReadFalse() {
        return springDataNotificationRepository.countByIsReadFalse();
    }
}
