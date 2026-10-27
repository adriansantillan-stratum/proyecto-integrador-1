package com.ecoroute.backend.domain.ports.in;
import com.ecoroute.backend.domain.model.Order;
import reactor.core.publisher.Mono;
public interface AssignOrderUseCase {
    Mono<Order> assignOrder(Long orderId, Long routeId);
}
