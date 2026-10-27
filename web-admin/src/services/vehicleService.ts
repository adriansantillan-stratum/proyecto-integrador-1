import api from './api';

export interface Vehicle {
  id: number;
  plateNumber: string;
  model: string;
  brand: string;
  capacityKg: number;
  capacityM3: number;
  isActive: boolean;
  createdAt: string;
}

export const getAllVehicles = async (): Promise<Vehicle[]> => {
  const response = await api.get<Vehicle[]>('/vehicles');
  return response.data;
};

export const createVehicle = async (vehicle: Partial<Vehicle>): Promise<Vehicle> => {
  const response = await api.post<Vehicle>('/vehicles', vehicle);
  return response.data;
};

export const updateVehicle = async (id: number, vehicle: Partial<Vehicle>): Promise<Vehicle> => {
  const response = await api.put<Vehicle>(`/vehicles/${id}`, vehicle);
  return response.data;
};

export const deleteVehicle = async (id: number): Promise<void> => {
  await api.delete(`/vehicles/${id}`);
};
