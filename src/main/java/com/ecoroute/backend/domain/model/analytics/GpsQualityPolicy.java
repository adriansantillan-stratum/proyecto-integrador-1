package com.ecoroute.backend.domain.model.analytics;

/** Configurable reporting bounds, not speed limits, scientific standards or proof of GPS authenticity. */
public record GpsQualityPolicy(double maxSpeedKmh, double maxGapSeconds) {
    public static final double DEFAULT_MAX_SPEED_KMH = 160;
    public static final double DEFAULT_MAX_GAP_SECONDS = 900;

    public GpsQualityPolicy {
        if (!Double.isFinite(maxSpeedKmh) || maxSpeedKmh <= 0
                || !Double.isFinite(maxGapSeconds) || maxGapSeconds <= 0)
            throw new IllegalArgumentException("GPS reporting bounds must be finite and positive");
    }

    public static GpsQualityPolicy defaults() {
        return new GpsQualityPolicy(DEFAULT_MAX_SPEED_KMH, DEFAULT_MAX_GAP_SECONDS);
    }
}
