package com.ecoroute.backend.domain.ports.in;
import com.ecoroute.backend.domain.model.Order;
import reactor.core.publisher.Mono;
import java.time.OffsetDateTime;
public interface ChangeDeliveryWindowUseCase {
    Mono<Order> changeDeliveryWindow(Long id,OffsetDateTime start,OffsetDateTime end,String reason,String actor);
}
