import api from './api';

export interface Driver {
  id: number;
  externalId: string;
  firstName: string;
  lastName: string;
  licenseNumber: string;
  phoneNumber: string;
  email: string;
  isActive: boolean;
  createdAt: string;
}

export const getAllDrivers = async (): Promise<Driver[]> => {
  const response = await api.get<Driver[]>('/drivers');
  return response.data;
};

export const createDriver = async (driver: Partial<Driver>): Promise<Driver> => {
  const response = await api.post<Driver>('/drivers', driver);
  return response.data;
};

export const updateDriver = async (id: number, driver: Partial<Driver>): Promise<Driver> => {
  const response = await api.put<Driver>(`/drivers/${id}`, driver);
  return response.data;
};

export const deleteDriver = async (id: number): Promise<void> => {
  await api.delete(`/drivers/${id}`);
};
