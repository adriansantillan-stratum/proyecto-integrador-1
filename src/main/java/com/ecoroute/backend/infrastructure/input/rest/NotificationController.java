package com.ecoroute.backend.infrastructure.input.rest;

import com.ecoroute.backend.domain.model.Notification;
import com.ecoroute.backend.domain.ports.out.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.OffsetDateTime;
import java.util.Map;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationRepository notificationRepository;

    @GetMapping
    public Flux<Notification> getAllNotifications() {
        return notificationRepository.findAll();
    }

    @GetMapping("/unread")
    public Flux<Notification> getUnreadNotifications() {
        return notificationRepository.findByIsReadFalse();
    }

    @GetMapping("/unread/count")
    public Mono<Map<String, Long>> getUnreadCount() {
        return notificationRepository.countByIsReadFalse()
                .map(count -> Map.of("count", count));
    }

    @PatchMapping("/{id}/read")
    public Mono<Notification> markAsRead(@PathVariable Long id) {
        return notificationRepository.findById(id)
                .flatMap(notification -> {
                    Notification updated = new Notification(
                            notification.id(),
                            notification.type(),
                            notification.title(),
                            notification.message(),
                            notification.orderId(),
                            true,
                            notification.createdAt()
                    );
                    return notificationRepository.save(updated);
                });
    }
}
