import { apiClient } from './apiClient';

/** One in-app notification. Text is built on the device from eventType + params. */
export interface AppNotification {
  id: string;
  eventType: string;
  aggregateType?: string;
  aggregateId?: string;
  params: Record<string, string>;
  read: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  unreadCount: number;
  notifications: AppNotification[];
}

export const notificationsService = {
  async list(): Promise<NotificationsResponse> {
    const res = await apiClient.get<NotificationsResponse>('/notifications');
    return {
      unreadCount: Number(res?.unreadCount) || 0,
      notifications: Array.isArray(res?.notifications) ? res.notifications : [],
    };
  },
  async markRead(id: string): Promise<void> {
    await apiClient.post(`/notifications/${encodeURIComponent(id)}/read`, {});
  },
  async markAllRead(): Promise<void> {
    await apiClient.post('/notifications/read-all', {});
  },
};
