import { identityApi } from './clients';
import { pascalizeRequest } from './normalize';
import type { User, PaginatedResponse, PaginatedRequest } from '@/types';

export const usersApi = {
  list: async (params?: PaginatedRequest): Promise<PaginatedResponse<User>> => {
    const response = await identityApi.get('/api/user', { params });
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

  getByEmail: async (email: string): Promise<User> => {
    const response = await identityApi.get(`/api/user/by-email/${email}`);
    return response.data;
  },

  update: async (id: string, data: Partial<User>): Promise<User> => {
    const response = await identityApi.put(`/api/user/${id}`, pascalizeRequest(data));
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await identityApi.delete(`/api/user/${id}`);
  },
};
