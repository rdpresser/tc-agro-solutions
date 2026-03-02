import { farmApi } from './clients';
import { pascalizeRequest } from './normalize';
import type { Plot, PaginatedResponse, PaginatedRequest, CreatePlotRequest } from '@/types';

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

function normalizePlot(item: unknown): Plot {
  const source = (item ?? {}) as Record<string, unknown>;

  const explicitStatus = readString(source, 'status', 'Status', 'plotStatus', 'PlotStatus');
  const isActive = readBoolean(source, 'isActive', 'IsActive');
  const status = explicitStatus || (isActive === true ? 'Active' : isActive === false ? 'Inactive' : '');

  return {
    id: readString(source, 'id', 'Id'),
    name: readString(source, 'name', 'Name'),
    propertyName: readString(source, 'propertyName', 'PropertyName'),
    propertyId: readString(source, 'propertyId', 'PropertyId'),
    cropType: readString(source, 'cropType', 'CropType'),
    plantingDate: readString(source, 'plantingDate', 'PlantingDate'),
    expectedHarvestDate: readString(source, 'expectedHarvestDate', 'ExpectedHarvestDate'),
    irrigationType: readString(source, 'irrigationType', 'IrrigationType'),
    areaHectares: readNumber(source, 'areaHectares', 'AreaHectares'),
    sensorsCount: readNumber(source, 'sensorsCount', 'sensorCount', 'SensorCount', 'SensorsCount'),
    status,
    healthStatus: readString(source, 'healthStatus', 'HealthStatus') || undefined,
    temperatureMin: readNumber(source, 'temperatureMin', 'TemperatureMin') || undefined,
    temperatureMax: readNumber(source, 'temperatureMax', 'TemperatureMax') || undefined,
    humidityMin: readNumber(source, 'humidityMin', 'HumidityMin') || undefined,
    humidityMax: readNumber(source, 'humidityMax', 'HumidityMax') || undefined,
    soilMoistureMin: readNumber(source, 'soilMoistureMin', 'SoilMoistureMin') || undefined,
    soilMoistureMax: readNumber(source, 'soilMoistureMax', 'SoilMoistureMax') || undefined,
  };
}

export const plotsApi = {
  list: async (params?: PaginatedRequest & { propertyId?: string; cropType?: string; status?: string; ownerId?: string }): Promise<PaginatedResponse<Plot>> => {
    const response = await farmApi.get('/api/plots', { params });
    const data = response.data;
    const rawItems = data.items || data.data || data.results || [];
    return {
      items: Array.isArray(rawItems) ? rawItems.map((item) => normalizePlot(item)) : [],
      totalCount: data.totalCount || 0,
      pageNumber: data.pageNumber || 1,
      pageSize: data.pageSize || 10,
      hasNextPage: data.hasNextPage || false,
      hasPreviousPage: data.hasPreviousPage || false,
    };
  },

  getById: async (id: string): Promise<Plot> => {
    const response = await farmApi.get(`/api/plots/${id}`);
    return normalizePlot(response.data);
  },

  create: async (data: CreatePlotRequest): Promise<Plot> => {
    const response = await farmApi.post('/api/plots', pascalizeRequest(data));
    return normalizePlot(response.data);
  },

  update: async (id: string, data: Partial<CreatePlotRequest>): Promise<Plot> => {
    const response = await farmApi.put(`/api/plots/${id}`, pascalizeRequest(data));
    return normalizePlot(response.data);
  },

  delete: async (id: string): Promise<void> => {
    await farmApi.delete(`/api/plots/${id}`);
  },
};
