import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

const isK8s = extra.API_ENV === 'k8s';

export const API_CONFIG = {
  IDENTITY_BASE_URL: extra.IDENTITY_API_BASE_URL
    || (isK8s ? '/identity' : 'http://localhost:5001'),
  FARM_BASE_URL: extra.FARM_API_BASE_URL
    || (isK8s ? '/farm' : 'http://localhost:5002'),
  SENSOR_BASE_URL: extra.SENSOR_API_BASE_URL
    || (isK8s ? '/sensor-ingest' : 'http://localhost:5003'),
  ANALYTICS_BASE_URL: extra.ANALYTICS_API_BASE_URL
    || (isK8s ? '/analytics-worker' : 'http://localhost:5004'),
  SIGNALR_ENABLED: extra.SIGNALR_ENABLED !== 'false',
  POLLING_INTERVAL: 15000,
  RETRY_MAX: 2,
  RETRY_BASE_DELAY: 1000,
  RETRY_MAX_DELAY: 5000,
} as const;
