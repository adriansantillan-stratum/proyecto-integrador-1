package com.ecoroute.backend.infrastructure.input.rest;

import com.ecoroute.backend.application.services.PdfService;
import com.ecoroute.backend.application.services.S3Service;
import com.ecoroute.backend.infrastructure.security.OperationalAccess;
import jakarta.validation.Valid;
import com.ecoroute.backend.domain.exception.ResourceNotFoundException;
import com.lowagie.text.pdf.PdfWriter;
import com.ecoroute.backend.domain.model.DeliveryProof;
import com.ecoroute.backend.domain.ports.in.CreateDeliveryProofUseCase;
import com.ecoroute.backend.domain.ports.out.DeliveryProofRepository;
import com.ecoroute.backend.domain.ports.out.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.time.OffsetDateTime;

@RestController
@RequestMapping("/delivery-proofs")
@RequiredArgsConstructor
public class DeliveryProofController {

    private final CreateDeliveryProofUseCase createDeliveryProofUseCase;
    private final OrderRepository orderRepository;
    private final DeliveryProofRepository deliveryProofRepository;
    private final PdfService pdfService;
    private final S3Service files;
    private final OperationalAccess access;

    @PostMapping
    public Mono<DeliveryProof> createDeliveryProof(@Valid @RequestBody CreateDeliveryProofRequest request) {
        DeliveryProof domain = new DeliveryProof(
                null,
                request.orderId(),
                request.imageUrl(),
                request.signatureDataUrl(),
                request.receiverName(),
                request.receiverDni(),
                request.verifiedAt() != null ? request.verifiedAt() : OffsetDateTime.now(),
                request.latitude(),
                request.longitude()
        );
        return access.requireOrder(request.orderId()).then(createDeliveryProofUseCase.createDeliveryProof(domain));
    }

    @GetMapping("/{orderId}")
    public Mono<DeliveryProof> getProof(@PathVariable Long orderId) {
        return access.requireOrder(orderId).then(deliveryProofRepository.findByOrderId(orderId))
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Prueba no encontrada")));
    }

    @GetMapping("/{orderId}/photo")
    public Mono<ResponseEntity<byte[]>> photo(@PathVariable Long orderId) {
        return getProof(orderId).flatMap(proof -> image(proof.imageUrl()));
    }
    @GetMapping("/{orderId}/signature")
    public Mono<ResponseEntity<byte[]>> signature(@PathVariable Long orderId) {
        return getProof(orderId).flatMap(proof -> image(proof.signatureDataUrl()));
    }
    private Mono<ResponseEntity<byte[]>> image(String uri) {
        return files.read(uri).map(bytes -> ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore())
                .contentType(bytes[0]==(byte)0x89 ? MediaType.IMAGE_PNG : MediaType.IMAGE_JPEG).body(bytes));
    }

    @GetMapping("/{orderId}/pdf")
    public Mono<ResponseEntity<byte[]>> downloadPdf(@PathVariable Long orderId) {
        return access.requireOrder(orderId)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Pedido no encontrado")))
                .flatMap(order -> deliveryProofRepository.findByOrderId(orderId)
                        .flatMap(proof -> Mono.zip(files.read(proof.imageUrl()),files.read(proof.signatureDataUrl()))
                            .publishOn(reactor.core.scheduler.Schedulers.boundedElastic()).map(images -> {
                            byte[] pdfContent = pdfService.generateDeliveryReceipt(order, proof,images.getT1(),images.getT2());
                            return ResponseEntity.ok()
                                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=receipt_" + order.trackingNumber() + ".pdf")
                                    .contentType(MediaType.APPLICATION_PDF)
                                    .body(pdfContent);
                        }))
                        .switchIfEmpty(Mono.error(new ResourceNotFoundException("Este pedido no tiene prueba de entrega"))));
    }
}
