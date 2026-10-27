import api from './api';
import { parseGpsMessage } from '../utils/gpsMessage';
import type { GpsMessage } from '../utils/gpsMessage';

export interface VehicleGpsHistory {
  id: number;
  vehicleId: number;
  driverId: number;
  latitude: number;
  longitude: number;
  speedKmh: number;
  headingDegrees: number;
  pingTime: string;
}

export const getVehicleHistory = async (vehicleId: number): Promise<VehicleGpsHistory[]> => {
  const response = await api.get<VehicleGpsHistory[]>(`/gps/history/${vehicleId}`);
  return response.data;
};

export const pingGps = async (data: Omit<VehicleGpsHistory, 'id' | 'pingTime'>): Promise<VehicleGpsHistory> => {
  const response = await api.post('/gps/ping', data);
  return response.data;
};

export type GpsWebSocketMessage = GpsMessage;

export const connectGpsWebSocket = (
  vehicleId: number,
  onMessage: (data: GpsWebSocketMessage) => void
): WebSocket => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = import.meta.env.VITE_WS_HOST || window.location.host;
  const ws = new WebSocket(`${protocol}//${host}/ws/gps`);

  ws.onopen = () => {
    const accessToken = localStorage.getItem('token');
    if (!accessToken) { ws.close(1008, 'Sesión requerida'); return; }
    ws.send(JSON.stringify({ vehicleId, accessToken }));
  };

  ws.onmessage = (event) => {
    try {
      const data = parseGpsMessage(String(event.data), vehicleId);
      onMessage(data);
    } catch (e) {
      console.error('GPS WebSocket parse error:', e);
    }
  };

  ws.onerror = (error) => {
    console.error('GPS WebSocket error:', error);
  };

  return ws;
};
