package com.ecoroute.backend.domain.model.analytics;

import java.time.LocalDate;

/** Inclusive local operation dates, never UTC timestamp boundaries. */
public record AnalyticsFilter(Long driverId, LocalDate startDate, LocalDate endDate) {
    public AnalyticsFilter {
        if (driverId != null && driverId <= 0) throw new IllegalArgumentException("driverId debe ser positivo");
        if (startDate != null && endDate != null && startDate.isAfter(endDate))
            throw new IllegalArgumentException("startDate no puede superar endDate");
    }
}
