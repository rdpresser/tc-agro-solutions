import { analyticsApi } from './clients';
import type { Alert, AlertSummary, PaginatedResponse } from '@/types';

export const alertsApi = {
  getPending: async (params?: {
    pageNumber?: number;
    pageSize?: number;
    severity?: string;
    search?: string;
    ownerId?: string;
  }): Promise<Alert[]> => {
    try {
      const response = await analyticsApi.get('/api/alerts/pending', { params });
      const data = response.data;
      return data.items || (Array.isArray(data) ? data : []);
    } catch {
      return [];
    }
  },

  getAll: async (params?: {
    pageNumber?: number;
    pageSize?: number;
    status?: string;
    severity?: string;
    search?: string;
    ownerId?: string;
  }): Promise<Alert[]> => {
    try {
      const response = await analyticsApi.get('/api/alerts/pending', {
        params: { ...params, status: params?.status || 'all' },
      });
      const data = response.data;
      return data.items || (Array.isArray(data) ? data : []);
    } catch {
      return [];
    }
  },

  getSummary: async (windowHours = 24, ownerId?: string): Promise<AlertSummary | null> => {
    try {
      const response = await analyticsApi.get('/api/alerts/pending/summary', {
        params: { windowHours, ownerId },
      });
      return response.data;
    } catch {
      return null;
    }
  },

  resolve: async (id: string): Promise<void> => {
    await analyticsApi.post(`/api/alerts/${id}/resolve`);
  },
};
