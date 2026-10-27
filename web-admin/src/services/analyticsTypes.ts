/** Base contract tools/audit_e2e/analytics_api_contract.json; GPS extension tools/control_actualizacion/analytics_gps_contract.json. */
export type MetricCode = 'IID' | 'CHR' | 'TDE' | 'SUCCESS' | 'ONTIME';
export interface NameCount { name: string | null; count: number }
export interface StatusCount { status: string; count: number }
export interface OrdersSummary { ordersByStatus: StatusCount[]; onTimeDeliveries: number; delayedDeliveries: number }
export interface DeliveryPerformance { onTime: number; delayed: number }
export type GpsQualityStatus = 'INVALID_CONFIGURATION' | 'INSUFFICIENT_SAMPLES' | 'INVALID_COORDINATES' |
  'NON_POSITIVE_TIME' | 'IMPLAUSIBLE_SPEED' | 'EXCESSIVE_GAP' | 'AVAILABLE';
export interface GpsQuality {
  status: GpsQualityStatus; sampleCount: number; validSampleCount: number; invalidSampleCount: number;
  segmentCount: number; rejectedSegmentCount: number; implausibleSpeedSegmentCount: number;
  nonPositiveTimeSegmentCount: number; excessiveGapSegmentCount: number;
  /** Unvalidated audit sum, never an operational distance or fallback. */
  observedDistanceKm: number | null; maxSpeedKmh: number; maxGapSeconds: number;
}
export interface RouteEfficiency {
  routeId: number; label: string; orderCount: number; plannedDistanceKm: number | null;
  actualGpsDistanceKm: number | null; operationMinutes: number | null; kmPerDelivery: number | null;
  timePerStopMin: number | null; distanceSource: 'GPS_HAVERSINE' | 'UNAVAILABLE';
  /** Missing/null on an older API: quality has not been reported, not implicitly AVAILABLE. */
  gpsQuality?: GpsQuality | null;
}
export interface Goal { code: MetricCode; target: number | null; updatedBy: string | null; updatedAt: string | null }
export interface Kpi {
  code: MetricCode; name: string; numerator: number; denominator: number; percentage: number | null;
  target: number | null; gap: number | null; status: 'NO_DATA' | 'NO_TARGET' | 'MET' | 'BELOW_TARGET';
}
export interface BiQuality {
  totalOrders: number; scheduledOrders: number; completePodOrders: number; missingRucOrders: number;
  invalidGpsOrders: number; missingWindowOrders: number; routesWithoutGps: number;
  unconfirmedOrders: number; unverifiedAddressOrders: number; unverifiedCoverageOrders: number;
}
export interface BiReport {
  driverId: number | null; startDate: string | null; endDate: string | null; timezone: string;
  kpis: Kpi[]; trends: { date: string; kpis: Kpi[] }[];
  byDriver: { driverId: number | null; name: string; count: number; total: number; failed: number }[];
  byDistrict: NameCount[]; causes: { source: 'STATUS_HISTORY' | 'INCIDENT'; reason: string; count: number }[];
  efficiency: RouteEfficiency[]; goals: Goal[]; quality: BiQuality;
}
