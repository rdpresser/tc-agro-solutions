import { sensorApi } from './clients';
import type { SensorReading } from '@/types';

export const dashboardApi = {
  getLatestReadings: async (limit = 5): Promise<SensorReading[]> => {
    const response = await sensorApi.get('/api/dashboard/latest', {
      params: { limit },
    });
    return Array.isArray(response.data) ? response.data : response.data.items || [];
  },

  getLatestByFilter: async (params?: { sensorId?: string; plotId?: string }): Promise<SensorReading[]> => {
    const response = await sensorApi.get('/api/readings/latest', { params });
    return Array.isArray(response.data) ? response.data : response.data.items || [];
  },
};
