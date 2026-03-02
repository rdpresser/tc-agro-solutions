import { farmApi, sensorApi } from './clients';
import { pascalizeRequest } from './normalize';
import type { Sensor, SensorReading, PaginatedResponse, PaginatedRequest, CreateSensorRequest } from '@/types';

function readString(source: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return '';
}

function readNumber(source: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
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

function normalizeSensor(item: unknown): Sensor {
  const source = (item ?? {}) as Record<string, unknown>;

  return {
    id: readString(source, 'id', 'Id'),
    label: readString(source, 'label', 'Label') || readString(source, 'id', 'Id'),
    type: readString(source, 'type', 'Type'),
    status: readString(source, 'status', 'Status'),
    plotId: readString(source, 'plotId', 'PlotId'),
    plotName: readString(source, 'plotName', 'PlotName'),
    propertyName: readString(source, 'propertyName', 'PropertyName') || undefined,
    installedAt: readString(source, 'installedAt', 'InstalledAt') || new Date(0).toISOString(),
    batteryLevel: readNumber(source, 'batteryLevel', 'BatteryLevel'),
  };
}

function normalizeSensorReading(item: unknown): SensorReading {
  const source = (item ?? {}) as Record<string, unknown>;

  return {
    id: readString(source, 'id', 'Id') || undefined,
    sensorId: readString(source, 'sensorId', 'SensorId'),
    plotId: readString(source, 'plotId', 'PlotId') || undefined,
    plotName: readString(source, 'plotName', 'PlotName') || undefined,
    propertyName: readString(source, 'propertyName', 'PropertyName') || undefined,
    sensorLabel: readString(source, 'sensorLabel', 'SensorLabel', 'label', 'Label') || undefined,
    temperature: readNumber(source, 'temperature', 'Temperature') ?? 0,
    humidity: readNumber(source, 'humidity', 'Humidity') ?? 0,
    soilMoisture: readNumber(source, 'soilMoisture', 'SoilMoisture') ?? 0,
    rainfall: readNumber(source, 'rainfall', 'Rainfall') ?? 0,
    batteryLevel: readNumber(source, 'batteryLevel', 'BatteryLevel'),
    timestamp: readString(source, 'timestamp', 'Timestamp', 'time', 'Time') || new Date(0).toISOString(),
  };
}

export const sensorsApi = {
  list: async (params?: PaginatedRequest & { type?: string; status?: string; propertyId?: string; plotId?: string; ownerId?: string }): Promise<PaginatedResponse<Sensor>> => {
    const response = await farmApi.get('/api/sensors', { params });
    const data = (response.data ?? {}) as Record<string, unknown>;
    const rawItems = data.items || data.data || data.results || data.Items || data.Data || data.Results || [];
    return {
      items: Array.isArray(rawItems) ? rawItems.map((item) => normalizeSensor(item)) : [],
      totalCount: readPaginatedNumber(data, 0, 'totalCount', 'TotalCount'),
      pageNumber: readPaginatedNumber(data, 1, 'pageNumber', 'PageNumber'),
      pageSize: readPaginatedNumber(data, 10, 'pageSize', 'PageSize'),
      hasNextPage: readPaginatedBoolean(data, false, 'hasNextPage', 'HasNextPage'),
      hasPreviousPage: readPaginatedBoolean(data, false, 'hasPreviousPage', 'HasPreviousPage'),
    };
  },

  getById: async (id: string): Promise<Sensor> => {
    const response = await farmApi.get(`/api/sensors/${id}`);
    return normalizeSensor(response.data);
  },

  create: async (data: CreateSensorRequest): Promise<Sensor> => {
    const response = await farmApi.post('/api/sensors', pascalizeRequest(data));
    return normalizeSensor(response.data);
  },

  changeStatus: async (id: string, data: { newStatus: string; reason?: string }): Promise<void> => {
    await farmApi.put(`/api/sensors/${id}/status-change`, data);
  },

  delete: async (id: string): Promise<void> => {
    await farmApi.delete(`/api/sensors/${id}`);
  },

  getReadings: async (sensorId: string, days = 7): Promise<SensorReading[]> => {
    try {
      const response = await sensorApi.get(`/api/sensors/${sensorId}/readings`, {
        params: { days },
      });
      const data = (response.data ?? {}) as Record<string, unknown>;
      const rawItems = Array.isArray(response.data)
        ? response.data
        : data.items || data.data || data.results || data.Items || data.Data || data.Results || [];
      if (Array.isArray(rawItems) && rawItems.length > 0) {
        return rawItems.map((item) => normalizeSensorReading(item));
      }
    } catch {
      // fallback below
    }

    const latestResponse = await sensorApi.get('/api/readings/latest', {
      params: { sensorId, pageNumber: 1, pageSize: 50 },
    });
    const latestData = (latestResponse.data ?? {}) as Record<string, unknown>;
    const latestRawItems = Array.isArray(latestResponse.data)
      ? latestResponse.data
      : latestData.items || latestData.data || latestData.results || latestData.Items || latestData.Data || latestData.Results || [];

    if (!Array.isArray(latestRawItems)) {
      return [];
    }

    return latestRawItems
      .map((item) => normalizeSensorReading(item))
      .filter((reading) => reading.sensorId === sensorId);
  },
};
