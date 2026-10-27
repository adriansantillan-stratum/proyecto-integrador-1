package com.ecoroute.backend.infrastructure.output.persistence;

import com.ecoroute.backend.domain.model.Order;
import com.ecoroute.backend.domain.ports.out.OrderAuditPort;
import lombok.RequiredArgsConstructor;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

@Component
@RequiredArgsConstructor
public class R2dbcOrderAuditAdapter implements OrderAuditPort {
    private final DatabaseClient db;
    public Mono<Void> record(Order order, String reason) {
        return ReactiveSecurityContextHolder.getContext().map(c -> c.getAuthentication().getName())
                .defaultIfEmpty("SYSTEM").flatMap(actor -> db.sql("""
                    INSERT INTO order_status_history(order_id,status,reason,changed_by)
                    VALUES(:id,:status,:reason,:actor)
                    """).bind("id",order.id()).bind("status",order.status().name())
                    .bind("reason",reason == null ? "" : reason.trim()).bind("actor",actor)
                    .fetch().rowsUpdated()).then();
    }
}
