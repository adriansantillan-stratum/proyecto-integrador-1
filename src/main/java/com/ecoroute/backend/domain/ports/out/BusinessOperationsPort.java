package com.ecoroute.backend.domain.ports.out;

import com.ecoroute.backend.domain.model.BusinessOperations.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface BusinessOperationsPort {
    Flux<Incident> incidents();
    Mono<Incident> incident(Long id, boolean lock);
    Mono<Incident> createIncident(Incident incident);
    Mono<Incident> resolve(Long id, String outcome, String reason, String actor, Long nextRouteId, Long retryOrderId);
    Mono<Void> linkAttempt(Long originalId, Long retryId, Long incidentId);
    Flux<Improvement> improvements();
    Mono<Improvement> improvement(Long id, boolean lock);
    Mono<Improvement> createImprovement(Improvement improvement);
    Mono<Improvement> updateImprovement(Long id, String status, Double resultValue, String note, String verifiedBy);
}
