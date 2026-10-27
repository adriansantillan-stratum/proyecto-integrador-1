package com.ecoroute.backend.infrastructure.input.rest;

import java.time.OffsetDateTime;
import jakarta.validation.constraints.*;

public record CreateDeliveryProofRequest(
    @NotNull Long orderId,
    @NotBlank String imageUrl,
    @NotBlank String signatureDataUrl,
    @NotBlank @Size(max=255) String receiverName,
    @NotBlank @Pattern(regexp="[0-9]{8}",message="El DNI debe tener ocho dígitos") String receiverDni,
    OffsetDateTime verifiedAt,
    @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
    @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude
) {}
