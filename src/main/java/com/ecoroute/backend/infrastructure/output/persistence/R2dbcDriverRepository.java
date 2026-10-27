package com.ecoroute.backend.infrastructure.output.persistence;

import com.ecoroute.backend.domain.model.Driver;
import com.ecoroute.backend.domain.ports.out.DriverRepository;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Component
public class R2dbcDriverRepository implements DriverRepository {

    private final SpringDataDriverRepository springDataDriverRepository;

    public R2dbcDriverRepository(SpringDataDriverRepository springDataDriverRepository) {
        this.springDataDriverRepository = springDataDriverRepository;
    }

    @Override
    public Mono<Driver> save(Driver driver) {
        DriverEntity driverEntity = DriverPersistenceMapper.toEntity(driver);
        return springDataDriverRepository.save(driverEntity)
                .map(DriverPersistenceMapper::toDomain);
    }

    @Override
    public Flux<Driver> findAll() {
        return springDataDriverRepository.findAll()
                .map(DriverPersistenceMapper::toDomain);
    }

    @Override
    public Mono<Driver> findById(Long id) {
        return springDataDriverRepository.findById(id)
                .map(DriverPersistenceMapper::toDomain);
    }

    @Override
    public Mono<Void> deleteById(Long id) {
        return springDataDriverRepository.deleteById(id);
    }
}
