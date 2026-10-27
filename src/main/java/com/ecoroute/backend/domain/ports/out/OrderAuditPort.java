package com.ecoroute.backend.domain.ports.out;

import com.ecoroute.backend.domain.model.Order;
import reactor.core.publisher.Mono;

public interface OrderAuditPort {
    Mono<Void> record(Order order, String reason);
}
