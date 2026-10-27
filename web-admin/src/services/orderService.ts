import api from './api';
import type { DeliveryWindowRequest } from '../utils/deliveryWindow';

export const OrderStatus = {
  PENDING: 'PENDING',
  ASSIGNED: 'ASSIGNED',
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  RETURNED: 'RETURNED',
} as const;

export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];

export interface Order {
  id: number;
  trackingNumber: string;
  externalReference: string;
  routeId: number | null;
  status: OrderStatus;
  recipientName: string;
  recipientPhone: string;
  recipientEmail: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryDistrict: string;
  latitude: number;
  longitude: number;
  priority: number;
  estimatedDeliveryWindowStart?: string | null;
  estimatedDeliveryWindowEnd?: string | null;
  createdAt: string;
}

export const getAllOrders = async (): Promise<Order[]> => {
  const response = await api.get<Order[]>('/orders');
  return response.data;
};

export const createOrder = async (order: Partial<Order>): Promise<Order> => {
  const response = await api.post<Order>('/orders', order);
  return response.data;
};

export const getOrderById = async (id: number): Promise<Order> => {
  const response = await api.get<Order>(`/orders/${id}`);
  return response.data;
};

export const deleteOrder = async (id: number): Promise<void> => {
  await api.delete(`/orders/${id}`);
};

export const updateOrderStatus = async (id: number, status: string, reason: string): Promise<Order> => {
  const response = await api.patch<Order>(`/orders/${id}/status`, { status, reason });
  return response.data;
};

export async function assignOrder(id:number,routeId:number):Promise<Order> {
  return (await api.patch<Order>(`/orders/${id}/route`,{routeId})).data;
}

export interface BusinessData {
  recipientRuc?: string | null; customerAccepted: boolean; addressVerified: boolean; coverageVerified: boolean;
  agreementNote: string; confirmedBy?: string | null; confirmedAt?: string | null;
}
export async function saveBusinessData(id: number, data: BusinessData): Promise<BusinessData> {
  return (await api.patch<BusinessData>(`/orders/${id}/business-data`, data)).data;
}
export async function updateDeliveryWindow(id: number, data: DeliveryWindowRequest): Promise<Order> {
  return (await api.patch<Order>(`/orders/${id}/delivery-window`, data)).data;
}
export interface DeliveryProof {
  id: number; orderId: number; receiverName: string; receiverDni: string;
  verifiedAt: string; latitude: number; longitude: number;
}
export async function proofBlob(orderId: number, kind: 'photo' | 'signature' | 'pdf'): Promise<Blob> {
  return (await api.get<Blob>(`/delivery-proofs/${orderId}/${kind}`, { responseType: 'blob' })).data;
}
