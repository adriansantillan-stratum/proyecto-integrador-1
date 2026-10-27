package com.ecoroute.backend.domain.ports.in;

import com.ecoroute.backend.domain.model.Order;
import reactor.core.publisher.Flux;

public interface GetAllOrdersUseCase {
    Flux<Order> getAllOrders();
}
