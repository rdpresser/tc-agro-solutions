import { farmApi } from './clients';
import type { Owner, PaginatedResponse } from '@/types';

export const ownersApi = {
  list: async (): Promise<Owner[]> => {
    const response = await farmApi.get('/api/owners', {
      params: { pageSize: 100 },
    });
    const data = response.data;
    const items = data.items || data.data || data.results || [];
    return items as Owner[];
  },
};
