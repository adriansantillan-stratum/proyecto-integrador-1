package com.ecoroute.backend.infrastructure.output.persistence;

import com.ecoroute.backend.domain.model.Route;
import com.ecoroute.backend.domain.ports.out.RouteRepository;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDate;

@Component
public class R2dbcRouteRepository implements RouteRepository {

    private final SpringDataRouteRepository springDataRouteRepository;

    public R2dbcRouteRepository(SpringDataRouteRepository springDataRouteRepository) {
        this.springDataRouteRepository = springDataRouteRepository;
    }

    @Override
    public Mono<Route> save(Route route) {
        RouteEntity entity = RoutePersistenceMapper.toEntity(route);
        return springDataRouteRepository.save(entity)
                .map(RoutePersistenceMapper::toDomain);
    }

    @Override
    public Mono<Route> findById(Long id) {
        return springDataRouteRepository.findById(id)
                .map(RoutePersistenceMapper::toDomain);
    }

    @Override
    public Mono<Route> lockById(Long id) {
        return springDataRouteRepository.lockById(id).map(RoutePersistenceMapper::toDomain);
    }

    @Override
    public Flux<Route> findByDriverIdAndDate(Long driverId, LocalDate date) {
        return springDataRouteRepository.findByDriverIdAndRouteDate(driverId, date)
                .map(RoutePersistenceMapper::toDomain);
    }

    @Override
    public Flux<Route> findAll() {
        return springDataRouteRepository.findAll()
                .map(RoutePersistenceMapper::toDomain);
    }

    @Override
    public Flux<Route> findByFilters(LocalDate date, com.ecoroute.backend.domain.model.RouteStatus status) {
        return springDataRouteRepository.findByFilters(date, status != null ? status.name() : null)
                .map(RoutePersistenceMapper::toDomain);
    }

    @Override
    public Mono<Void> deleteById(Long id) {
        return springDataRouteRepository.deleteById(id);
    }

    @Override
    public Mono<Integer> updatePathInfo(Long id, String geometry, Double durationMin) {
        return springDataRouteRepository.updatePathInfo(id, geometry, durationMin);
    }
}
