import api from './api';

export const RouteStatus = {
  PLANNED: 'PLANNED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type RouteStatus = typeof RouteStatus[keyof typeof RouteStatus];

export interface Route {
  id: number;
  driverId: number;
  vehicleId: number;
  routeDate: string;
  status: RouteStatus;
  estimatedStartTime: string;
  actualStartTime?: string;
  actualEndTime?: string;
  totalDistanceKm: number;
  createdAt: string;
}

export const getAllRoutes = async (date?: string, status?: string): Promise<Route[]> => {
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  if (status) params.append('status', status);
  
  const response = await api.get<Route[]>(`/routes?${params.toString()}`);
  return response.data;
};

export const createRoute = async (route: Partial<Route>): Promise<Route> => {
  const response = await api.post<Route>('/routes', route);
  return response.data;
};

export const updateRouteStatus = async (id: number, status: RouteStatus): Promise<Route> => {
  const response = await api.patch<Route>(`/routes/${id}/status?status=${status}`);
  return response.data;
};

export interface RoutePath { polyline: string|null;orderedOrderIds:number[];distanceKm:number;durationMin:number;source:string }
export async function getRoutePath(id:number,fromLat?:number,fromLng?:number):Promise<RoutePath> {
  const response=await api.get<RoutePath>(`/routes/${id}/path`,{params:{fromLat,fromLng}});
  return response.data;
}

export interface RouteReview {
  routeId: number; approvedBy?: string | null; approvedAt?: string | null; acceptedBy?: string | null; acceptedAt?: string | null;
  approved: boolean; accepted: boolean; capacityVerified?: boolean; windowsVerified?: boolean;
  vehicleChecked?: boolean; loadWeightKg?: number; note?: string;
}
export interface ReviewRequest { capacityVerified: boolean; windowsVerified: boolean; vehicleChecked: boolean; loadWeightKg: number; note: string }
export async function approveRoute(id: number, review: ReviewRequest): Promise<RouteReview> {
  return (await api.post<RouteReview>(`/routes/${id}/review`, review)).data;
}
