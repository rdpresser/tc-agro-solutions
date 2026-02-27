import { farmApi } from './clients';
import { pascalizeRequest } from './normalize';
import type { Plot, PaginatedResponse, PaginatedRequest, CreatePlotRequest } from '@/types';

export const plotsApi = {
  list: async (params?: PaginatedRequest & { propertyId?: string; cropType?: string; status?: string; ownerId?: string }): Promise<PaginatedResponse<Plot>> => {
    const response = await farmApi.get('/api/plots', { params });
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

  getById: async (id: string): Promise<Plot> => {
    const response = await farmApi.get(`/api/plots/${id}`);
    return response.data;
  },

  create: async (data: CreatePlotRequest): Promise<Plot> => {
    const response = await farmApi.post('/api/plots', pascalizeRequest(data));
    return response.data;
  },

  update: async (id: string, data: Partial<CreatePlotRequest>): Promise<Plot> => {
    const response = await farmApi.put(`/api/plots/${id}`, pascalizeRequest(data));
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await farmApi.delete(`/api/plots/${id}`);
  },
};
