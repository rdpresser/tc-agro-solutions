import { farmApi, sensorApi } from './clients';
import { pascalizeRequest } from './normalize';
import type { Sensor, SensorReading, PaginatedResponse, PaginatedRequest } from '@/types';

export const sensorsApi = {
  list: async (params?: PaginatedRequest & { type?: string; status?: string; propertyId?: string; plotId?: string }): Promise<PaginatedResponse<Sensor>> => {
    const response = await farmApi.get('/api/sensors', { params });
    const data = response.data;
    return {
      items: data.items || data.data || data.results || [],
      totalCount: data.totalCount || 0,
      pageNumber: data.pageNumber || 1,
      pageSize: data.pageSize || 10,
      hasNextPage: data.hasNextPage || false,
      hasPreviousPage: data.hasPreviousPage || false,
    };
  },

  getById: async (id: string): Promise<Sensor> => {
    const response = await farmApi.get(`/api/sensors/${id}`);
    return response.data;
  },

  create: async (data: { label: string; type: string; plotId: string }): Promise<Sensor> => {
    const response = await farmApi.post('/api/sensors', pascalizeRequest(data));
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await farmApi.delete(`/api/sensors/${id}`);
  },

  getReadings: async (sensorId: string, days = 7): Promise<SensorReading[]> => {
    try {
      const response = await sensorApi.get(`/api/sensors/${sensorId}/readings`, {
        params: { days },
      });
      const items = Array.isArray(response.data) ? response.data : response.data.items || response.data.data || [];
      if (items.length > 0) return items;
    } catch {
      // fallback below
    }

    const latestResponse = await sensorApi.get('/api/readings/latest', {
      params: { sensorId, pageNumber: 1, pageSize: 50 },
    });
    const latestItems = Array.isArray(latestResponse.data)
      ? latestResponse.data
      : latestResponse.data.items || latestResponse.data.data || [];
    return latestItems.filter((r: SensorReading) => r.sensorId === sensorId);
  },
};
