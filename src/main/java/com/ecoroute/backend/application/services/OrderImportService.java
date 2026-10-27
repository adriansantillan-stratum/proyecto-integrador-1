package com.ecoroute.backend.application.services;
import com.ecoroute.backend.domain.model.Order;
import com.ecoroute.backend.domain.ports.in.CreateOrderUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Flux;
import java.util.List;
@Service
@RequiredArgsConstructor
public class OrderImportService {
    private final CreateOrderUseCase create;
    /** One reactive transaction for the entire batch; no silent partial import. */
    @Transactional
    public Flux<Order> importOrders(List<Order> validated) {
        return Flux.fromIterable(validated).concatMap(create::createOrder);
    }
}
