export interface GpsMessage { vehicleId: number; latitude: number; longitude: number; speedKmh: number; timestamp: number }
export function parseGpsMessage(raw: string, vehicleId: number): GpsMessage {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('Mensaje GPS inválido');
  const point = value as Record<string, unknown>;
  if (!['vehicleId', 'latitude', 'longitude', 'speedKmh', 'timestamp'].every(key => typeof point[key] === 'number' && Number.isFinite(point[key]))
    || point.vehicleId !== vehicleId || Math.abs(Number(point.latitude)) > 90 || Math.abs(Number(point.longitude)) > 180
    || (point.latitude === 0 && point.longitude === 0) || Number(point.speedKmh) < 0 || Number(point.timestamp) <= 0 || Number(point.timestamp) > 8640000000000000) {
    throw new Error('Mensaje GPS inválido o ajeno al vehículo');
  }
  return point as unknown as GpsMessage;
}
