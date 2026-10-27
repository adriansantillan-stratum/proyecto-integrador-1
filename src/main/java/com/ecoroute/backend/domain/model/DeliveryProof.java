package com.ecoroute.backend.domain.model;

import java.time.OffsetDateTime;

public record DeliveryProof(
    Long id,
    Long orderId,
    String imageUrl,
    String signatureDataUrl,
    String receiverName,
    String receiverDni,
    OffsetDateTime verifiedAt,
    Double latitude,
    Double longitude
) {}
