import api from './api';

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  orderId: number | null;
  isRead: boolean;
  createdAt: string;
}

export const getUnreadNotifications = async (): Promise<Notification[]> => {
  const response = await api.get<Notification[]>('/notifications/unread');
  return response.data;
};

export const getUnreadCount = async (): Promise<number> => {
  const response = await api.get<{ count: number }>('/notifications/unread/count');
  return response.data.count;
};

export const markAsRead = async (id: number): Promise<void> => {
  await api.patch(`/notifications/${id}/read`);
};
