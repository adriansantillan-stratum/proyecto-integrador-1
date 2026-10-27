package com.ecoroute.backend.infrastructure.output.persistence;

import com.ecoroute.backend.infrastructure.input.rest.OrderStatusCount;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Repository
public interface SpringDataOrderRepository extends R2dbcRepository<OrderEntity, Long> {
    Mono<OrderEntity> findByTrackingNumber(String trackingNumber);
    @Query("SELECT * FROM orders WHERE id = :id FOR UPDATE")
    Mono<OrderEntity> lockById(Long id);
    Flux<OrderEntity> findByRouteId(Long routeId);

    @org.springframework.data.r2dbc.repository.Modifying
    @Query("UPDATE orders SET stop_sequence = :sequence WHERE id = :id")
    Mono<Integer> updateStopSequence(Long id, Integer sequence);

            @Query("SELECT status, COUNT(*) as count FROM orders WHERE (:driverId IS NULL OR route_id IN (SELECT id FROM routes WHERE driver_id = :driverId)) AND (CAST(:startDate AS TIMESTAMP) IS NULL OR created_at >= :startDate) AND (CAST(:endDate AS TIMESTAMP) IS NULL OR created_at <= :endDate) GROUP BY status")
            Flux<OrderStatusCount> countOrdersByStatusFiltered(Long driverId, java.time.OffsetDateTime startDate, java.time.OffsetDateTime endDate);
        
            @Query("SELECT COUNT(*) FROM delivery_proofs dp JOIN orders o ON dp.order_id = o.id WHERE dp.verified_at <= o.estimated_delivery_window_end AND (:driverId IS NULL OR o.route_id IN (SELECT id FROM routes WHERE driver_id = :driverId))")
            Mono<Long> countOnTimeDeliveriesFiltered(Long driverId);
        
            @Query("SELECT COUNT(*) FROM delivery_proofs dp JOIN orders o ON dp.order_id = o.id WHERE dp.verified_at > o.estimated_delivery_window_end AND (:driverId IS NULL OR o.route_id IN (SELECT id FROM routes WHERE driver_id = :driverId))")
            Mono<Long> countDelayedDeliveriesFiltered(Long driverId);
        
                @Query("SELECT d.first_name || ' ' || d.last_name as name, COUNT(o.id) as count FROM orders o JOIN routes r ON o.route_id = r.id JOIN drivers d ON r.driver_id = d.id WHERE o.status = 'DELIVERED' AND (:driverId IS NULL OR d.id = :driverId) GROUP BY d.first_name, d.last_name")
                Flux<DriverPerformanceDTO> countDeliveriesByDriverFiltered(Long driverId);
            
                @Query("SELECT delivery_district as name, COUNT(*) as count FROM orders GROUP BY delivery_district")
                Flux<DriverPerformanceDTO> countOrdersByDistrict();
            }
            
