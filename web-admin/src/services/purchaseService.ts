import api from './api';

export interface Purchase {
  id: number;
  description: string;
  supplier: string;
  amount: number;
  status: string;
  category: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export const getAllPurchases = async (): Promise<Purchase[]> => {
  const response = await api.get<Purchase[]>('/purchases');
  return response.data;
};

export const createPurchase = async (purchase: Partial<Purchase>): Promise<Purchase> => {
  const response = await api.post<Purchase>('/purchases', purchase);
  return response.data;
};

export const updatePurchase = async (id: number, purchase: Partial<Purchase>): Promise<Purchase> => {
  const response = await api.put<Purchase>(`/purchases/${id}`, purchase);
  return response.data;
};

export const deletePurchase = async (id: number): Promise<void> => {
  await api.delete(`/purchases/${id}`);
};
