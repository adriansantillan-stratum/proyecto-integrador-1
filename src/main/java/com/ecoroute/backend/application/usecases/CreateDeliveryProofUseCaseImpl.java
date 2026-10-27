package com.ecoroute.backend.application.usecases;

import com.ecoroute.backend.application.services.NotificationService;
import com.ecoroute.backend.application.services.S3Service;
import com.ecoroute.backend.domain.exception.ResourceNotFoundException;
import com.ecoroute.backend.domain.model.DeliveryProof;
import com.ecoroute.backend.domain.model.Order;
import com.ecoroute.backend.domain.model.OrderStatus;
import com.ecoroute.backend.domain.model.OrderLifecycle;
import com.ecoroute.backend.domain.exception.BusinessRuleException;
import com.ecoroute.backend.domain.ports.out.OrderAuditPort;
import com.ecoroute.backend.domain.ports.out.ProofIntegrityPort;
import com.ecoroute.backend.domain.model.RouteStatus;
import com.ecoroute.backend.domain.ports.in.CreateDeliveryProofUseCase;
import com.ecoroute.backend.domain.ports.in.UpdateRouteStatusUseCase;
import com.ecoroute.backend.domain.ports.out.DeliveryProofRepository;
import com.ecoroute.backend.domain.ports.out.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Mono;

import java.time.OffsetDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class CreateDeliveryProofUseCaseImpl implements CreateDeliveryProofUseCase {

    private final DeliveryProofRepository deliveryProofRepository;
    private final OrderRepository orderRepository;
    private final NotificationService notificationService;
    private final S3Service s3Service;
    private final UpdateRouteStatusUseCase updateRouteStatusUseCase;
    private final OrderAuditPort audit;
    private final ProofIntegrityPort integrity;

    @Override
    @Transactional
    public Mono<DeliveryProof> createDeliveryProof(DeliveryProof deliveryProof) {
        if (deliveryProof.latitude()==null || deliveryProof.longitude()==null
                || !Double.isFinite(deliveryProof.latitude()) || !Double.isFinite(deliveryProof.longitude())
                || Math.abs(deliveryProof.latitude())>90 || Math.abs(deliveryProof.longitude())>180
                || (deliveryProof.latitude()==0 && deliveryProof.longitude()==0))
            return Mono.error(new IllegalArgumentException("Se requiere una ubicación GPS válida, no el punto 0,0"));
        if (deliveryProof.receiverName()==null || deliveryProof.receiverName().isBlank()
                || deliveryProof.receiverDni()==null || !deliveryProof.receiverDni().matches("[0-9]{8}"))
            return Mono.error(new IllegalArgumentException("Complete el receptor y su DNI de ocho dígitos"));
        if (deliveryProof.verifiedAt()!=null && deliveryProof.verifiedAt().isAfter(OffsetDateTime.now().plusMinutes(5)))
            return Mono.error(new IllegalArgumentException("La fecha de captura no puede estar en el futuro"));
        try { S3Service.decodeImage(deliveryProof.imageUrl(),10); S3Service.decodeImage(deliveryProof.signatureDataUrl(),2); }
        catch (IllegalArgumentException ex) { return Mono.error(ex); }
        return orderRepository.lockById(deliveryProof.orderId())
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Order not found with id: " + deliveryProof.orderId())))
                .flatMap(order -> {
                    if (order.status() == OrderStatus.DELIVERED)
                        return deliveryProofRepository.findByOrderId(order.id())
                                .switchIfEmpty(Mono.error(new BusinessRuleException("El pedido figura entregado sin prueba; requiere conciliación")));
                    if (order.status()!=OrderStatus.IN_TRANSIT)
                        return Mono.error(new BusinessRuleException("Solo se confirma una entrega de un pedido en tránsito"));
                    log.info("Creating delivery proof for order: {}", order.trackingNumber());
                    
                    // 1. Upload files to S3
                    Mono<String> imageUpload = s3Service.uploadBase64("photos", deliveryProof.imageUrl());
                    Mono<String> signatureUpload = s3Service.uploadBase64("signatures", deliveryProof.signatureDataUrl());

                    return Mono.zip(imageUpload.defaultIfEmpty(""), signatureUpload.defaultIfEmpty(""))
                            .flatMap(tuple -> {
                                String s3ImageUrl = tuple.getT1();
                                String s3SignatureUrl = tuple.getT2();

                                // 2. Create updated delivery proof with S3 URIs
                                DeliveryProof proofWithS3 = new DeliveryProof(
                                        null,
                                        deliveryProof.orderId(),
                                        s3ImageUrl,
                                        s3SignatureUrl,
                                        deliveryProof.receiverName(),
                                        deliveryProof.receiverDni(),
                                        OffsetDateTime.now(),
                                        deliveryProof.latitude(),
                                        deliveryProof.longitude()
                                );

                                // 3. Update order status to DELIVERED
                                var updatedOrder = new Order(
                                        order.id(),
                                        order.trackingNumber(),
                                        order.externalReference(),
                                        order.routeId(),
                                        OrderStatus.DELIVERED,
                                        order.recipientName(),
                                        order.recipientPhone(),
                                        order.recipientEmail(),
                                        order.deliveryAddress(),
                                        order.deliveryCity(),
                                        order.deliveryDistrict(),
                                        order.latitude(),
                                        order.longitude(),
                                        order.priority(),
                                        order.estimatedDeliveryWindowStart(),
                                        order.estimatedDeliveryWindowEnd(),
                                        order.createdAt(),
                                        OffsetDateTime.now()
                                );

                                return orderRepository.save(updatedOrder)
                                        .then(deliveryProofRepository.save(proofWithS3))
                                        .flatMap(savedProof ->
                                        integrity.record(savedProof.id(),hash(deliveryProof.imageUrl(),10),hash(deliveryProof.signatureDataUrl(),2),
                                                        deliveryProof.verifiedAt()==null ? OffsetDateTime.now() : deliveryProof.verifiedAt())
                                                .then(audit.record(updatedOrder,"Entrega confirmada con foto, firma y GPS"))
                                                .then(notificationService.sendDeliveryNotification(updatedOrder))
                                                        .then(checkAndCompleteRoute(updatedOrder.routeId()))
                                                        .thenReturn(savedProof)
                                        );
                            });
                });
    }

    private String hash(String input,int maxMb) {
        try { return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                .digest(S3Service.decodeImage(input,maxMb))); }
        catch (java.security.NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }

    private Mono<Void> checkAndCompleteRoute(Long routeId) {
        if (routeId == null) return Mono.empty();

        return orderRepository.findByRouteId(routeId)
                .collectList()
                .flatMap(orders -> {
                    boolean allDelivered = orders.stream()
                            .allMatch(o -> OrderLifecycle.terminal(o.status()));
                    
                    if (allDelivered && !orders.isEmpty()) {
                        log.info("🏁 All orders delivered for route {}. Completing route.", routeId);
                        return updateRouteStatusUseCase.updateRouteStatusOnly(routeId, RouteStatus.COMPLETED);
                    }
                    return Mono.empty();
                });
    }
}
