import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getToken, clearAll } from '@/lib/secure-store';
import { camelizeResponse } from './normalize';
import { API_CONFIG } from '@/constants/api-config';
import { router } from 'expo-router';

interface RetryConfig extends InternalAxiosRequestConfig {
  _retryCount?: number;
}

function createApiClient(baseURL: string): AxiosInstance {
  const instance = axios.create({
    baseURL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  });

  // Request interceptor: attach JWT
  instance.interceptors.request.use(async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Response interceptor: normalize + retry + 401 redirect
  instance.interceptors.response.use(
    (response) => {
      if (response.data) {
        response.data = camelizeResponse(response.data);
      }
      return response;
    },
    async (error: AxiosError) => {
      const config = error.config as RetryConfig | undefined;

      // 401: clear auth and redirect to login
      if (error.response?.status === 401) {
        await clearAll();
        router.replace('/(auth)/login');
        return Promise.reject(error);
      }

      // Retry logic for idempotent methods on network/5xx errors
      if (config) {
        const method = (config.method || '').toUpperCase();
        const isIdempotent = ['GET', 'HEAD', 'OPTIONS'].includes(method);
        const isRetryable = !error.response || (error.response.status >= 500);

        if (isIdempotent && isRetryable) {
          config._retryCount = (config._retryCount || 0) + 1;
          if (config._retryCount <= API_CONFIG.RETRY_MAX) {
            const delay = Math.min(
              API_CONFIG.RETRY_BASE_DELAY * Math.pow(2, config._retryCount - 1),
              API_CONFIG.RETRY_MAX_DELAY
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            return instance(config);
          }
        }
      }

      return Promise.reject(error);
    }
  );

  return instance;
}

export default createApiClient;
