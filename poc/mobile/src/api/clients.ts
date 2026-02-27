import createApiClient from './client';
import { API_CONFIG } from '@/constants/api-config';

export const identityApi = createApiClient(API_CONFIG.IDENTITY_BASE_URL);
export const farmApi = createApiClient(API_CONFIG.FARM_BASE_URL);
export const sensorApi = createApiClient(API_CONFIG.SENSOR_BASE_URL);
export const analyticsApi = createApiClient(API_CONFIG.ANALYTICS_BASE_URL);
