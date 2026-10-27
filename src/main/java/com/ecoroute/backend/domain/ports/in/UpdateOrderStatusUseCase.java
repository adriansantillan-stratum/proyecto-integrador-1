package com.ecoroute.backend.domain.ports.in;

import com.ecoroute.backend.domain.model.Order;
import com.ecoroute.backend.domain.model.OrderStatus;
import reactor.core.publisher.Mono;

public interface UpdateOrderStatusUseCase {
    Mono<Order> updateStatusManual(Long id, OrderStatus status, String reason);
}
