package com.ecoroute.backend.infrastructure.output.persistence;

import com.ecoroute.backend.domain.model.Order;
import com.ecoroute.backend.domain.ports.out.OrderRepository;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Component
public class R2dbcOrderRepository implements OrderRepository {

    private final SpringDataOrderRepository springDataOrderRepository;

    public R2dbcOrderRepository(SpringDataOrderRepository springDataOrderRepository) {
        this.springDataOrderRepository = springDataOrderRepository;
    }

    @Override
    public Mono<Order> save(Order order) {
        OrderEntity orderEntity = OrderPersistenceMapper.toEntity(order);
        return springDataOrderRepository.save(orderEntity)
                .map(OrderPersistenceMapper::toDomain);
    }

    @Override
    public Flux<Order> findAll() {
        return springDataOrderRepository.findAll()
                .map(OrderPersistenceMapper::toDomain);
    }

    @Override
    public Mono<Order> findById(Long id) {
        return springDataOrderRepository.findById(id)
                .map(OrderPersistenceMapper::toDomain);
    }

    @Override
    public Mono<Order> lockById(Long id) {
        return springDataOrderRepository.lockById(id).map(OrderPersistenceMapper::toDomain);
    }

    @Override
    public Mono<Order> findByTrackingNumber(String trackingNumber) {
        return springDataOrderRepository.findByTrackingNumber(trackingNumber)
                .map(OrderPersistenceMapper::toDomain);
    }

    @Override
    public Flux<Order> findByRouteId(Long routeId) {
        return springDataOrderRepository.findByRouteId(routeId)
                .map(OrderPersistenceMapper::toDomain);
    }

    @Override
    public Mono<Void> deleteById(Long id) {
        return springDataOrderRepository.deleteById(id);
    }

    @Override
    public Mono<Integer> updateStopSequence(Long id, Integer sequence) {
        return springDataOrderRepository.updateStopSequence(id, sequence);
    }
}
