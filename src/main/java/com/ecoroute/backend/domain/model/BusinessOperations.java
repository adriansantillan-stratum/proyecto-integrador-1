package com.ecoroute.backend.domain.model;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/** Business records independent of HTTP, SQL and UI frameworks. */
public final class BusinessOperations {
    private BusinessOperations() {}
    public record Incident(Long id, Long routeId, Long orderId, String incidentType, String severity,
                           String description, String status, String outcome, String resolutionReason,
                           Long nextRouteId, Long retryOrderId, String reportedBy, String resolvedBy,
                           OffsetDateTime createdAt, OffsetDateTime resolvedAt) {}
    public record Improvement(Long id, String title, String cause, String ownerName, LocalDate dueDate,
                              String metricCode, Double baselineValue, Double targetValue, Double resultValue,
                              String status, String note, String createdBy, String verifiedBy) {}
}
