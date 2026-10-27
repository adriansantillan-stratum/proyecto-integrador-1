package com.ecoroute.backend.application.usecases;
import com.ecoroute.backend.application.services.*;
import com.ecoroute.backend.domain.model.*;
import com.ecoroute.backend.domain.exception.BusinessRuleException;
import com.ecoroute.backend.domain.ports.out.*;
import com.ecoroute.backend.domain.ports.in.UpdateRouteStatusUseCase;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;
import java.time.OffsetDateTime;
import static org.mockito.Mockito.*;
@ExtendWith(MockitoExtension.class)
class DeliveryProofRulesTest {
    @Mock DeliveryProofRepository proofs;
    @Mock OrderRepository orders;
    @Mock NotificationService notification;
    @Mock S3Service s3;
    @Mock UpdateRouteStatusUseCase routes;
    @Mock OrderAuditPort audit;
    @Mock ProofIntegrityPort integrity;
    @InjectMocks CreateDeliveryProofUseCaseImpl service;
    String png="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKma1gAAAABJRU5ErkJggg==";
    DeliveryProof proof(double lat,double lon) {return new DeliveryProof(null,1L,png,png,"Receptor","12345678",OffsetDateTime.now(),lat,lon);}
    @Test void zeroCoordinatesRejectedBeforeStorage() {
        StepVerifier.create(service.createDeliveryProof(proof(0,0))).expectError(IllegalArgumentException.class).verify();
        verifyNoInteractions(s3,orders,proofs);
    }
    @Test void deliveredRetryReturnsExistingProofWithoutUploads() {
        when(orders.lockById(1L)).thenReturn(Mono.just(OrderUseCasesImplTest.order(1L,2L,OrderStatus.DELIVERED)));
        var existing=proof(-12.04,-77.04);when(proofs.findByOrderId(1L)).thenReturn(Mono.just(existing));
        StepVerifier.create(service.createDeliveryProof(existing)).expectNext(existing).verifyComplete();verifyNoInteractions(s3,notification,integrity);
    }
    @Test void pendingOrderCannotAcquireDeliveredProof() {
        when(orders.lockById(1L)).thenReturn(Mono.just(OrderUseCasesImplTest.order(1L,null,OrderStatus.PENDING)));
        StepVerifier.create(service.createDeliveryProof(proof(-12.04,-77.04))).expectError(BusinessRuleException.class).verify();
        verifyNoInteractions(s3,notification,integrity);
    }
}
