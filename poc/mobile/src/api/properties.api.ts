import { farmApi } from './clients';
import { pascalizeRequest } from './normalize';
import type { Property, PaginatedResponse, PaginatedRequest, CreatePropertyRequest, UpdatePropertyRequest } from '@/types';

function readString(source: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return '';
}

function readNumber(source: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return 0;
}

function readBoolean(source: Record<string, unknown>, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'boolean') {
      return value;
    }
  }

  return undefined;
}

function readDateString(source: Record<string, unknown>, ...keys: string[]): string {
  const value = readString(source, ...keys);
  return value || new Date(0).toISOString();
}

function normalizeProperty(item: unknown): Property {
  const source = (item ?? {}) as Record<string, unknown>;

  return {
    id: readString(source, 'id', 'Id'),
    name: readString(source, 'name', 'Name'),
    ownerName: readString(source, 'ownerName', 'OwnerName'),
    ownerId: readString(source, 'ownerId', 'OwnerId') || undefined,
    address: readString(source, 'address', 'Address') || undefined,
    city: readString(source, 'city', 'City'),
    state: readString(source, 'state', 'State'),
    country: readString(source, 'country', 'Country'),
    areaHectares: readNumber(source, 'areaHectares', 'AreaHectares'),
    plotCount: readNumber(source, 'plotCount', 'PlotCount'),
    isActive: readBoolean(source, 'isActive', 'IsActive') ?? false,
    createdAt: readDateString(source, 'createdAt', 'CreatedAt'),
    latitude: readNumber(source, 'latitude', 'Latitude') || undefined,
    longitude: readNumber(source, 'longitude', 'Longitude') || undefined,
  };
}

function readPaginatedNumber(source: Record<string, unknown>, defaultValue: number, ...keys: string[]): number {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return defaultValue;
}

function readPaginatedBoolean(source: Record<string, unknown>, defaultValue: boolean, ...keys: string[]): boolean {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'boolean') {
      return value;
    }
  }

  return defaultValue;
}

export const propertiesApi = {
  list: async (params?: PaginatedRequest & { ownerId?: string }): Promise<PaginatedResponse<Property>> => {
    const response = await farmApi.get('/api/properties', { params });
    const data = (response.data ?? {}) as Record<string, unknown>;
    const rawItems = data.items || data.data || data.results || data.Items || data.Data || data.Results || [];

    return {
      items: Array.isArray(rawItems) ? rawItems.map((item) => normalizeProperty(item)) : [],
      totalCount: readPaginatedNumber(data, 0, 'totalCount', 'TotalCount'),
      pageNumber: readPaginatedNumber(data, 1, 'pageNumber', 'PageNumber'),
      pageSize: readPaginatedNumber(data, 10, 'pageSize', 'PageSize'),
      hasNextPage: readPaginatedBoolean(data, false, 'hasNextPage', 'HasNextPage'),
      hasPreviousPage: readPaginatedBoolean(data, false, 'hasPreviousPage', 'HasPreviousPage'),
    };
  },

  getById: async (id: string): Promise<Property> => {
    const response = await farmApi.get(`/api/properties/${id}`);
    return normalizeProperty(response.data);
  },

  create: async (data: CreatePropertyRequest): Promise<Property> => {
    const response = await farmApi.post('/api/properties', pascalizeRequest(data));
    return normalizeProperty(response.data);
  },

  update: async (id: string, data: UpdatePropertyRequest): Promise<Property> => {
    const response = await farmApi.put(`/api/properties/${id}`, pascalizeRequest(data));
    return normalizeProperty(response.data);
  },

  delete: async (id: string): Promise<void> => {
    await farmApi.delete(`/api/properties/${id}`);
  },
};
