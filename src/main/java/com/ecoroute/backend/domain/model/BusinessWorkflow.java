package com.ecoroute.backend.domain.model;
import java.time.OffsetDateTime;

public final class BusinessWorkflow {
    private BusinessWorkflow() {}
    public record Confirmation(Long orderId,String recipientRuc,boolean customerAccepted,boolean addressVerified,
            boolean coverageVerified,String agreementNote,String confirmedBy,OffsetDateTime confirmedAt) {
        public boolean complete() { return customerAccepted && addressVerified && coverageVerified; }
    }
    public record Review(Long routeId,boolean approved,boolean accepted,Double loadWeightKg,String approvedBy,
            OffsetDateTime approvedAt,String acceptedBy,OffsetDateTime acceptedAt,String note) {}
}
