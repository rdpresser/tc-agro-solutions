import Constants from 'expo-constants';
import { Platform } from 'react-native';

const extra = Constants.expoConfig?.extra ?? {};

const isK8s = String(extra.API_ENV ?? 'k8s').toLowerCase() === 'k8s';

// On Android emulator, localhost refers to the emulator itself, not the host.
// Use 10.0.2.2 to reach the host machine from the Android emulator.
const fallbackHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const API_CONFIG = {
  IDENTITY_BASE_URL: extra.IDENTITY_API_BASE_URL
    || (isK8s ? '/identity' : `http://${fallbackHost}:5001`),
  FARM_BASE_URL: extra.FARM_API_BASE_URL
    || (isK8s ? '/farm' : `http://${fallbackHost}:5002`),
  SENSOR_BASE_URL: extra.SENSOR_API_BASE_URL
    || (isK8s ? '/sensor-ingest' : `http://${fallbackHost}:5003`),
  ANALYTICS_BASE_URL: extra.ANALYTICS_API_BASE_URL
    || (isK8s ? '/analytics-worker' : `http://${fallbackHost}:5004`),
  SIGNALR_ENABLED: extra.SIGNALR_ENABLED !== 'false',
  POLLING_INTERVAL: 15000,
  RETRY_MAX: 2,
  RETRY_BASE_DELAY: 1000,
  RETRY_MAX_DELAY: 5000,
} as const;
