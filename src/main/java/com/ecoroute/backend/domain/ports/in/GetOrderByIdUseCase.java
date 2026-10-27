package com.ecoroute.backend.domain.ports.in;

import com.ecoroute.backend.domain.model.Order;
import reactor.core.publisher.Mono;

public interface GetOrderByIdUseCase {
    Mono<Order> getOrderById(Long id);
}
