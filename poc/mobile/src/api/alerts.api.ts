import { analyticsApi } from './clients';
import type { Alert } from '@/types';

export const alertsApi = {
  getPending: async (): Promise<Alert[]> => {
    try {
      const response = await analyticsApi.get('/api/alerts/pending');
      return Array.isArray(response.data) ? response.data : response.data.items || [];
    } catch {
      return [];
    }
  },

  getAll: async (): Promise<Alert[]> => {
    try {
      const response = await analyticsApi.get('/api/alerts');
      return Array.isArray(response.data) ? response.data : response.data.items || [];
    } catch {
      return [];
    }
  },

  resolve: async (id: string): Promise<void> => {
    await analyticsApi.post(`/api/alerts/${id}/resolve`);
  },
};
