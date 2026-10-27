package com.ecoroute.backend.application.usecases;

import com.ecoroute.backend.application.services.*;
import com.ecoroute.backend.domain.exception.BusinessRuleException;
import com.ecoroute.backend.domain.model.*;
import com.ecoroute.backend.domain.ports.in.UpdateRouteStatusUseCase;
import com.ecoroute.backend.domain.ports.out.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;
import java.time.OffsetDateTime;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProofIdempotencyExceptionsTest {
    @Mock DeliveryProofRepository proofs;
    @Mock OrderRepository orders;
    @Mock NotificationService notifications;
    @Mock S3Service storage;
    @Mock UpdateRouteStatusUseCase routes;
    @Mock OrderAuditPort audit;
    @Mock ProofIntegrityPort integrity;
    @InjectMocks CreateDeliveryProofUseCaseImpl service;
    static final String PNG="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKma1gAAAABJRU5ErkJggg==";
    DeliveryProof request() {
        return new DeliveryProof(null,11L,PNG,PNG,"Receptor sintético","00000001",OffsetDateTime.now(),-12.04,-77.04);
    }
    @Test void repeatedDeliveredRequestsReturnStoredProofWithoutSecondBusinessEffect() {
        when(orders.lockById(11L)).thenReturn(Mono.just(WorkflowExceptionUseCasesTest.order(OrderStatus.DELIVERED)));
        var existing = new DeliveryProof(71L,11L,"s3://proof/photo","s3://proof/signature","Receptor original","00000001",OffsetDateTime.now(),-12.04,-77.04);
        when(proofs.findByOrderId(11L)).thenReturn(Mono.just(existing));
        StepVerifier.create(service.createDeliveryProof(request())).expectNext(existing).verifyComplete();
        StepVerifier.create(service.createDeliveryProof(request())).expectNext(existing).verifyComplete();
        verify(proofs,times(2)).findByOrderId(11L);
        verify(proofs,never()).save(any()); verify(orders,never()).save(any());
        verifyNoInteractions(storage,notifications,integrity,audit,routes);
    }
    @Test void deliveredWithoutStoredProofRequiresReconciliationAndDoesNotReupload() {
        when(orders.lockById(11L)).thenReturn(Mono.just(WorkflowExceptionUseCasesTest.order(OrderStatus.DELIVERED)));
        when(proofs.findByOrderId(11L)).thenReturn(Mono.empty());
        StepVerifier.create(service.createDeliveryProof(request())).expectErrorMatches(error ->
                error instanceof BusinessRuleException && error.getMessage().contains("conciliación")).verify();
        verify(proofs,never()).save(any()); verify(orders,never()).save(any());
        verifyNoInteractions(storage,notifications,integrity,audit,routes);
    }
}
