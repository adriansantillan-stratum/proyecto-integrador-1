package com.ecoroute.backend.domain.ports.out;
import com.ecoroute.backend.domain.model.BusinessWorkflow.*;
import reactor.core.publisher.Mono;
public interface BusinessWorkflowPort {
    Mono<Confirmation> confirmation(Long orderId);
    Mono<Confirmation> saveConfirmation(Confirmation value);
    Mono<Review> review(Long routeId);
    Mono<Void> approve(Long routeId,Double weight,String actor,String note);
    Mono<Void> accept(Long routeId,String actor);
    Mono<Void> invalidate(Long routeId);
    Mono<Void> requireConfirmed(Long orderId);
    Mono<Void> requireDispatchReview(Long routeId);
    Mono<Void> audit(String process,String entity,Long entityId,String action,String actor,String details);
}
