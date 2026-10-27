package com.ecoroute.backend.domain.ports.out;

import com.ecoroute.backend.domain.model.Order;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface OrderRepository {
    Mono<Order> save(Order order);
    Flux<Order> findAll();
    Mono<Order> findById(Long id);
    Mono<Order> lockById(Long id);
    Mono<Order> findByTrackingNumber(String trackingNumber);
    Flux<Order> findByRouteId(Long routeId);
    Mono<Void> deleteById(Long id);
    Mono<Integer> updateStopSequence(Long id, Integer sequence);
}
