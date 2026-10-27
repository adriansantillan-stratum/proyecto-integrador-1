package com.ecoroute.backend.application.usecases;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

public class DistanceCalculationTest {

    // Haversine formula duplicated for unit test verification
    private double haversine(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    @Test
    public void testDistanceBetweenLimaPoints() {
        // From Plaza de Armas to San Isidro (approx)
        double lat1 = -12.046374;
        double lon1 = -77.042793;
        double lat2 = -12.095;
        double lon2 = -77.020;
        
        double distance = haversine(lat1, lon1, lat2, lon2);
        
        // Approx 5.9km
        assertEquals(5.9, Math.round(distance * 10.0) / 10.0);
    }
}
