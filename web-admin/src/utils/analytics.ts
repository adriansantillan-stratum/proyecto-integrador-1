import type { BiReport, MetricCode, RouteEfficiency } from '../services/analyticsTypes';
import { csvContent } from './operation.ts';
export const metricCodes: MetricCode[] = ['IID', 'CHR', 'TDE', 'SUCCESS', 'ONTIME'];
export const formulas: Record<MetricCode, string> = {
  IID: 'Pedidos con RUC de 11 dígitos, destinatario/dirección y GPS válido / todos los pedidos.',
  CHR: 'Pedidos programados DELIVERED / pedidos con ruta.',
  TDE: 'Pedidos programados con foto O firma / pedidos con ruta. No equivale a POD completo.',
  SUCCESS: 'Pedidos DELIVERED / todos los pedidos.',
  ONTIME: 'Entregas con POD dentro de ventana / entregas con POD y fin de ventana evaluables.',
};
function nonNegativeFinite(value: number | null): number | null {
  return value != null && Number.isFinite(value) && value >= 0 ? value : null;
}
/** One presentation rule for the table, charts and CSV; no client-side distance calculation. */
export function routeGpsMetrics(route: RouteEfficiency): Pick<RouteEfficiency, 'actualGpsDistanceKm' | 'kmPerDelivery' | 'distanceSource'> {
  const actual = route.gpsQuality?.status === 'AVAILABLE' && route.distanceSource === 'GPS_HAVERSINE'
    ? nonNegativeFinite(route.actualGpsDistanceKm) : null;
  return {
    actualGpsDistanceKm: actual,
    kmPerDelivery: actual == null ? null : nonNegativeFinite(route.kmPerDelivery),
    distanceSource: actual == null ? 'UNAVAILABLE' : 'GPS_HAVERSINE',
  };
}
export function gpsQualityMessages(route: RouteEfficiency): string[] {
  const q = route.gpsQuality;
  if (!q) return ['Calidad GPS no informada por la API; distancia no evaluable.'];
  const messages: string[] = [];
  switch (q.status) {
    case 'AVAILABLE':
      messages.push(routeGpsMetrics(route).actualGpsDistanceKm == null
        ? 'Controles indicados como disponibles, pero sin distancia GPS evaluable.'
        : 'Pasó los controles configurados; no acredita movimiento real del vehículo ni el origen de las muestras.');
      break;
    case 'INSUFFICIENT_SAMPLES': messages.push('Muestras insuficientes: se requieren al menos dos dentro del intervalo de operación.'); break;
    case 'INVALID_COORDINATES': messages.push('Coordenadas GPS inválidas; distancia no evaluable.'); break;
    case 'NON_POSITIVE_TIME': messages.push('Timestamps sin avance: tiempo entre muestras nulo o negativo.'); break;
    case 'IMPLAUSIBLE_SPEED': messages.push('Velocidad inverosímil entre muestras; distancia no evaluable.'); break;
    case 'EXCESSIVE_GAP': messages.push('Intervalo excesivo entre muestras (gap); distancia no evaluable.'); break;
    case 'INVALID_CONFIGURATION': messages.push('Configuración de controles GPS inválida; distancia no evaluable.'); break;
    default: messages.push('Calidad GPS no reconocida; distancia no evaluable.');
  }
  messages.push(`Muestras: ${q.sampleCount} totales, ${q.validSampleCount} válidas y ${q.invalidSampleCount} inválidas. Segmentos: ${q.segmentCount}; rechazados: ${q.rejectedSegmentCount}.`);
  if (q.implausibleSpeedSegmentCount > 0) messages.push(`Segmentos con velocidad inverosímil: ${q.implausibleSpeedSegmentCount}.`);
  if (q.nonPositiveTimeSegmentCount > 0) messages.push(`Segmentos con timestamp sin avance (tiempo nulo o negativo): ${q.nonPositiveTimeSegmentCount}.`);
  if (q.excessiveGapSegmentCount > 0) messages.push(`Segmentos con intervalo excesivo (gap): ${q.excessiveGapSegmentCount}.`);
  if (Number.isFinite(q.maxSpeedKmh) && q.maxSpeedKmh > 0 && Number.isFinite(q.maxGapSeconds) && q.maxGapSeconds > 0) {
    messages.push(`Límites configurados: velocidad ≤ ${q.maxSpeedKmh} km/h; intervalo ≤ ${q.maxGapSeconds} s.`);
  }
  return messages;
}
export function efficiencyCsv(rows: RouteEfficiency[]): string {
  return csvContent([
    ['routeId', 'label', 'orderCount', 'plannedDistanceKm', 'actualGpsDistanceKm', 'operationMinutes', 'kmPerDelivery', 'timePerStopMin', 'distanceSource'],
    ...rows.map(r => {
      const gps = routeGpsMetrics(r);
      return [r.routeId, r.label, r.orderCount, r.plannedDistanceKm, gps.actualGpsDistanceKm, r.operationMinutes, gps.kmPerDelivery, r.timePerStopMin, gps.distanceSource];
    }),
  ]);
}
export function biCsv(report: BiReport): string {
  return csvContent([
    ['scope', 'date', 'driverId', 'startDate', 'endDate', 'timezone', 'code', 'numerator', 'denominator', 'percentage', 'target', 'gap', 'status', 'formula'],
    ...report.kpis.map(k => ['PERIOD', '', report.driverId, report.startDate, report.endDate, report.timezone, k.code, k.numerator, k.denominator, k.percentage, k.target, k.gap, k.status, formulas[k.code]]),
    ...report.trends.flatMap(day => day.kpis.map(k => ['DAY', day.date, report.driverId, report.startDate, report.endDate, report.timezone, k.code, k.numerator, k.denominator, k.percentage, k.target, k.gap, k.status, formulas[k.code]])),
  ]);
}
