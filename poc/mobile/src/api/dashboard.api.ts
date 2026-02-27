import { sensorApi } from './clients';
import type { SensorReading } from '@/types';

export const dashboardApi = {
  getLatestReadings: async (pageSize = 5): Promise<SensorReading[]> => {
    const response = await sensorApi.get('/api/dashboard/latest', {
      params: { pageNumber: 1, pageSize },
    });
    const data = response.data;
    return data.items || data.data || (Array.isArray(data) ? data : []);
  },

  getLatestByFilter: async (params?: {
    sensorId?: string;
    plotId?: string;
    pageNumber?: number;
    pageSize?: number;
    ownerId?: string;
  }): Promise<SensorReading[]> => {
    const response = await sensorApi.get('/api/readings/latest', { params });
    const data = response.data;
    return data.items || data.data || (Array.isArray(data) ? data : []);
  },
};
