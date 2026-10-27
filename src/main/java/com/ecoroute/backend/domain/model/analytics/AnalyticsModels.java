package com.ecoroute.backend.domain.model.analytics;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/** Domain projections independent of REST DTOs and persistence implementations. */
public final class AnalyticsModels {
    private AnalyticsModels() {}

    public enum Indicator {
        IID("Integridad de Datos Registrados"), CHR("Cumplimiento de Hoja de Ruta"),
        TDE("Tasa de Disponibilidad de Evidencias Digitales"),
        SUCCESS("Entregas exitosas"), ONTIME("Puntualidad de entregas evaluables");
        public final String label;
        Indicator(String label) { this.label = label; }
        public static Indicator parse(String code) {
            try { return valueOf(code.toUpperCase(java.util.Locale.ROOT)); }
            catch (RuntimeException ex) { throw new IllegalArgumentException("Indicador desconocido: " + code); }
        }
    }
    public record StatusCount(String status, Long count) {}
    public record NameCount(String name, Long count) {}
    public record DriverCount(Long driverId, String name, long count, long total, long failed) {}
    public record Cause(String source, String reason, long count) {}
    public record Totals(long total, long valid, long scheduled, long deliveredScheduled,
                         long evidenceScheduled, long delivered, long onTime, long delayed,
                         long evaluable, long completePod, long missingRuc, long invalidGps, long missingWindow,
                         long unconfirmed, long unverifiedAddress, long unverifiedCoverage) {
        public static Totals empty() { return new Totals(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0); }
    }
    public record DailyTotals(LocalDate date, Totals totals) {}
    public record Goal(String code, BigDecimal target, String updatedBy, OffsetDateTime updatedAt) {}
    public record Kpi(String code, String name, long numerator, long denominator, BigDecimal percentage,
                      BigDecimal target, BigDecimal gap, String status) {
        public static Kpi of(Indicator indicator, long numerator, long denominator, BigDecimal target) {
            BigDecimal value = denominator == 0 ? null : BigDecimal.valueOf(numerator)
                    .multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(denominator), 2, RoundingMode.HALF_UP);
            BigDecimal gap = value == null || target == null ? null : value.subtract(target);
            String status = value == null ? "NO_DATA" : target == null ? "NO_TARGET" : gap.signum() >= 0 ? "MET" : "BELOW_TARGET";
            return new Kpi(indicator.name(), indicator.label, numerator, denominator, value, target, gap, status);
        }
    }
    public record DailyTrend(LocalDate date, List<Kpi> kpis) {}
    public record GpsQuality(String status, long sampleCount, long validSampleCount, long invalidSampleCount,
                             long segmentCount, long rejectedSegmentCount, long implausibleSpeedSegmentCount,
                             long nonPositiveTimeSegmentCount, long excessiveGapSegmentCount,
                             Double observedDistanceKm, double maxSpeedKmh, double maxGapSeconds) {}
    public record RouteEfficiency(Long routeId, String label, long orderCount, Double plannedDistanceKm,
                                  Double actualGpsDistanceKm, Double operationMinutes, Double kmPerDelivery,
                                  Double timePerStopMin, String distanceSource, GpsQuality gpsQuality) {
        /** Preserve existing Java callers; new SQL projections always supply quality. */
        public RouteEfficiency(Long routeId, String label, long orderCount, Double plannedDistanceKm,
                               Double actualGpsDistanceKm, Double operationMinutes, Double kmPerDelivery,
                               Double timePerStopMin, String distanceSource) {
            this(routeId,label,orderCount,plannedDistanceKm,actualGpsDistanceKm,operationMinutes,
                    kmPerDelivery,timePerStopMin,distanceSource,null);
        }
    }
    public record Quality(long totalOrders, long scheduledOrders, long completePodOrders, long missingRucOrders,
                          long invalidGpsOrders, long missingWindowOrders, long routesWithoutGps,
                          long unconfirmedOrders, long unverifiedAddressOrders, long unverifiedCoverageOrders) {}
    public record BiReport(Long driverId, LocalDate startDate, LocalDate endDate, String timezone,
                           List<Kpi> kpis, List<DailyTrend> trends, List<DriverCount> byDriver,
                           List<NameCount> byDistrict, List<Cause> causes, List<RouteEfficiency> efficiency,
                           List<Goal> goals, Quality quality) {}
    public record OrderSummary(List<StatusCount> ordersByStatus, long onTimeDeliveries, long delayedDeliveries) {}
    public record DeliveryPerformance(long onTime, long delayed) {}
}
