import api from './api';

export interface UserRole {
  id: number;
  userExternalId: string;
  roleId: number;
}

export const getAllUsers = async (): Promise<UserRole[]> => {
  const response = await api.get<UserRole[]>('/users');
  return response.data;
};

export const assignRole = async (userExternalId: string, roleId: number): Promise<UserRole> => {
  const response = await api.post<UserRole>('/users', { userExternalId, roleId });
  return response.data;
};

export const removeRole = async (id: number): Promise<void> => {
  await api.delete(`/users/${id}`);
};

export type AppRole = 'ADMIN' | 'DISPATCHER' | 'DRIVER';
export interface Identity { id: string; username: string; firstName: string; lastName: string; roles: AppRole[]; driverId: number | null; enabled: boolean }
export async function updateIdentityRoles(id: string, roles: AppRole[], driverId?: number): Promise<void> {
  await api.put(`/users/identities/${encodeURIComponent(id)}/roles`, { roles, driverId });
}
export async function updateIdentityEnabled(id: string, enabled: boolean): Promise<void> {
  await api.put(`/users/identities/${encodeURIComponent(id)}/enabled`, { enabled });
}
