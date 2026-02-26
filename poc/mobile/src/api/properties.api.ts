import { farmApi } from './clients';
import { pascalizeRequest } from './normalize';
import type { Property, PaginatedResponse, PaginatedRequest, CreatePropertyRequest, UpdatePropertyRequest } from '@/types';

export const propertiesApi = {
  list: async (params?: PaginatedRequest): Promise<PaginatedResponse<Property>> => {
    const response = await farmApi.get('/api/properties', { params });
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

  getById: async (id: string): Promise<Property> => {
    const response = await farmApi.get(`/api/properties/${id}`);
    return response.data;
  },

  create: async (data: CreatePropertyRequest): Promise<Property> => {
    const response = await farmApi.post('/api/properties', pascalizeRequest(data));
    return response.data;
  },

  update: async (id: string, data: UpdatePropertyRequest): Promise<Property> => {
    const response = await farmApi.put(`/api/properties/${id}`, pascalizeRequest(data));
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await farmApi.delete(`/api/properties/${id}`);
  },
};
