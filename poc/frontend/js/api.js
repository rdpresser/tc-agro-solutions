/**
 * TC Agro Solutions - API Module
 * HTTP client with axios and SignalR integration
 */

import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import axios from 'axios';

import { toast } from './i18n.js';
import { APP_CONFIG, getToken, clearToken, navigateTo } from './utils.js';

// ============================================
// AXIOS INSTANCE WITH INTERCEPTORS
// ============================================

function createApiClient(baseURL) {
  return axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

export const api = createApiClient(APP_CONFIG.apiBaseUrl);
export const identityApi = createApiClient(APP_CONFIG.identityApiBaseUrl);
export const farmApi = createApiClient(APP_CONFIG.farmApiBaseUrl);
export const sensorIngestApi = createApiClient(APP_CONFIG.sensorIngestApiBaseUrl);

// Simple helpers for retry policy
function isIdempotent(method) {
  const m = (method || 'get').toLowerCase();
  return m === 'get' || m === 'head' || m === 'options';
}

function shouldRetry(error) {
  const status = error?.response?.status;
  // Retry network errors (no response) or 5xx responses
  return !error.response || (status >= 500 && status < 600);
}

function getRetryDelay(retryCount) {
  // Exponential backoff capped at 5s
  const base = 1000; // 1s
  return Math.min(base * Math.pow(2, retryCount), 5000);
}

function attachInterceptors(client) {
  // Request interceptor - Add JWT token to all requests
  client.interceptors.request.use(
    (config) => {
      const token = getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor - Handle 401 unauthorized
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        clearToken();
        if (
          !window.location.pathname.endsWith('index.html') &&
          !window.location.pathname.endsWith('/')
        ) {
          navigateTo('index.html');
        }
        return Promise.reject(error);
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return Promise.reject(error);
      }

      const config = error.config || {};
      const maxRetries = 2;
      const attempt = config.__retryCount || 0;

      if (isIdempotent(config.method) && shouldRetry(error) && attempt < maxRetries) {
        config.__retryCount = attempt + 1;
        const delay = getRetryDelay(attempt);
        return new Promise((resolve) => setTimeout(resolve, delay)).then(() =>
          client.request(config)
        );
      }

      return Promise.reject(error);
    }
  );
}

attachInterceptors(api);
attachInterceptors(identityApi);
attachInterceptors(farmApi);
attachInterceptors(sensorIngestApi);

// ============================================
// DASHBOARD API
// ============================================

/**
 * Get dashboard statistics
 * @returns {Promise<Object>} Dashboard stats
 */
export async function getDashboardStats() {
  const { data } = await sensorIngestApi.get('/api/dashboard/stats');
  return data;
}

/**
 * Get latest sensor readings
 * @param {number} limit - Max readings to return (default: 5)
 * @returns {Promise<Array>} Latest readings
 */
export async function getLatestReadings(limit = 5) {
  const { data } = await sensorIngestApi.get('/api/dashboard/latest', { params: { limit } });
  return (data.readings || []).map((r) => ({
    sensorId: r.sensorId,
    plotName: '--',
    temperature: r.temperature,
    humidity: r.humidity,
    soilMoisture: r.soilMoisture,
    timestamp: r.time
  }));
}

/**
 * Get historical sensor data for plotting
 * @param {string} sensorId - Sensor ID
 * @param {number} days - Days of data to retrieve (default: 7)
 * @returns {Promise<Array>} Historical readings
 */
export async function getHistoricalData(sensorId, days = 7) {
  const { data } = await sensorIngestApi.get(`/api/sensors/${sensorId}/readings`, {
    params: { days }
  });
  return (data.readings || []).map((r) => ({
    timestamp: r.time,
    temperature: r.temperature,
    humidity: r.humidity,
    soilMoisture: r.soilMoisture
  }));
}

// ============================================
// PROPERTIES API
// ============================================

/**
 * Get all properties
 * @returns {Promise<Object>} Paginated list of properties
 */
export async function getProperties({
  pageNumber = 1,
  pageSize = 10,
  sortBy = 'name',
  sortDirection = 'asc',
  filter = ''
} = {}) {
  const { data } = await farmApi.get('/api/properties', {
    params: { pageNumber, pageSize, sortBy, sortDirection, filter }
  });
  return data;
}

export async function getProperty(id) {
  const { data } = await farmApi.get(`/api/properties/${id}`);
  return data;
}

/**
 * Create new property
 * @param {Object} propertyData - Property data
 * @returns {Promise<Object>} Created property
 */
export async function createProperty(propertyData) {
  const { data } = await farmApi.post('/api/properties', propertyData);
  return data;
}

/**
 * Update existing property
 * @param {string} id - Property ID
 * @param {Object} propertyData - Updated property data
 * @returns {Promise<Object>} Updated property
 */
export async function updateProperty(id, propertyData) {
  const { data } = await farmApi.put(`/api/properties/${id}`, propertyData);
  return data;
}

/**
 * Delete property
 * @param {string} id - Property ID to delete
 * @returns {Promise<boolean>} Success status
 */
export async function deleteProperty(id) {
  await farmApi.delete(`/api/properties/${id}`);
  return true;
}

// ============================================
// PLOTS API
// ============================================

/**
 * Get plots filtered by property
 * @param {string|null} propertyId - Property ID to filter by (default: null = all)
 * @returns {Promise<Array>} List of plots
 */
export async function getPlots(propertyId = null) {
  const params = { pageSize: 100 };
  if (propertyId) params.propertyId = propertyId;

  const { data } = await farmApi.get('/api/plots', { params });
  return data.data || data;
}

export async function getPlot(id) {
  const { data } = await farmApi.get(`/api/plots/${id}`);
  return data;
}

/**
 * Create new plot
 * @param {Object} plotData - Plot data
 * @returns {Promise<Object>} Created plot
 */
export async function createPlot(plotData) {
  const { data } = await farmApi.post('/api/plots', plotData);
  return data;
}

/**
 * Update existing plot
 * @param {string} id - Plot ID
 * @param {Object} plotData - Updated plot data
 * @returns {Promise<Object>} Updated plot
 */
export async function updatePlot(id, plotData) {
  const { data } = await farmApi.put(`/api/plots/${id}`, plotData);
  return data;
}

/**
 * Delete plot
 * @param {string} id - Plot ID to delete
 * @returns {Promise<boolean>} Success status
 */
export async function deletePlot(id) {
  await farmApi.delete(`/api/plots/${id}`);
  return true;
}

// ============================================
// SENSORS API
// ============================================

/**
 * Get sensors filtered by plot
 * @param {string|null} plotId - Plot ID to filter by (default: null = all)
 * @returns {Promise<Array>} List of sensors
 */
export async function getSensors(plotId = null) {
  const params = { pageSize: 100 };
  if (plotId) params.plotId = plotId;

  const { data } = await sensorIngestApi.get('/api/sensors', { params });
  return (data.data || []).map((s) => ({
    id: s.sensorId || s.id,
    plotId: s.plotId,
    plotName: s.plotName,
    status: (s.status || 'offline').toLowerCase(),
    battery: s.battery ?? 0,
    lastReading: s.lastReadingAt,
    temperature: s.temperature,
    humidity: s.humidity,
    soilMoisture: s.soilMoisture
  }));
}

// ============================================
// ALERTS API
// ============================================

/**
 * Get alerts filtered by status
 * @param {string|null} status - Alert status filter (default: null = all)
 * @returns {Promise<Array>} List of alerts
 */
export async function getAlerts(status = null) {
  const params = { pageSize: 50 };
  if (status) params.status = status;

  const { data } = await sensorIngestApi.get('/api/alerts', { params });
  return (data.data || []).map((a) => ({
    id: a.id,
    severity: (a.severity || 'warning').toLowerCase(),
    title: a.title,
    message: a.message,
    plotId: a.plotId,
    plotName: a.plotName,
    sensorId: a.sensorId,
    status: (a.status || 'pending').toLowerCase(),
    createdAt: a.createdAt,
    resolvedAt: a.resolvedAt
  }));
}

/**
 * Resolve/close alert
 * @param {string} alertId - Alert ID to resolve
 * @returns {Promise<boolean>} Success status
 */
export async function resolveAlert(alertId) {
  await sensorIngestApi.post(`/api/alerts/${alertId}/resolve`);
  return true;
}

// ============================================
// IDENTITY API - USERS
// ============================================

export async function fetchIdentitySwagger() {
  const { data } = await identityApi.get('/swagger/v1/swagger.json');
  return data;
}

export async function registerUser(payload) {
  const { data } = await identityApi.post('/auth/register', payload);
  return data;
}

export async function getUsers({
  pageNumber = 1,
  pageSize = 10,
  sortBy = 'id',
  sortDirection = 'asc',
  filter = ''
} = {}) {
  const { data } = await identityApi.get('/api/user', {
    params: { pageNumber, pageSize, sortBy, sortDirection, filter }
  });
  return data;
}

export async function getUserByEmail(email) {
  const { data } = await identityApi.get(`/api/user/by-email/${encodeURIComponent(email)}`);
  return data;
}

export async function updateUser(id, payload) {
  const { data } = await identityApi.put(`/api/user/${encodeURIComponent(id)}`, payload);
  return data;
}

export async function deleteUser(id) {
  const { data } = await identityApi.delete(`/api/user/${encodeURIComponent(id)}`);
  return data;
}

// ============================================
// SIGNALR REAL-TIME CONNECTION
// ============================================

let signalRConnection = null;

export async function initSignalRConnection(handlers = {}) {
  // Use mock if SignalR is disabled
  if (!APP_CONFIG.signalREnabled) {
    return initMockSignalR(handlers);
  }

  try {
    signalRConnection = new HubConnectionBuilder()
      .withUrl(`${APP_CONFIG.sensorIngestApiBaseUrl}/sensorHub`, {
        accessTokenFactory: () => getToken()
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();

    // Register event handlers
    if (handlers.onSensorReading) {
      signalRConnection.on('SensorReading', handlers.onSensorReading);
    }

    if (handlers.onAlert) {
      signalRConnection.on('NewAlert', handlers.onAlert);
    }

    if (handlers.onSensorStatus) {
      signalRConnection.on('SensorStatusChanged', handlers.onSensorStatus);
    }

    // Connection state handlers
    signalRConnection.onreconnecting(() => {
      handlers.onConnectionChange?.('reconnecting');
    });

    signalRConnection.onreconnected(() => {
      handlers.onConnectionChange?.('connected');
      toast('realtime.restored', 'success');
    });

    signalRConnection.onclose(() => {
      handlers.onConnectionChange?.('disconnected');
    });

    // Start connection
    await signalRConnection.start();
    handlers.onConnectionChange?.('connected');

    return signalRConnection;
  } catch {
    toast('realtime.mock_fallback', 'warning');
    // Fallback to mock
    return initMockSignalR(handlers);
  }
}

// Mock SignalR for demo purposes
function initMockSignalR(handlers = {}) {
  // Simulate sensor readings every 5 seconds
  const mockInterval = setInterval(() => {
    if (handlers.onSensorReading) {
      const mockReading = {
        sensorId: `SENSOR-00${Math.floor(Math.random() * 4) + 1}`,
        temperature: 25 + Math.random() * 12,
        humidity: 40 + Math.random() * 40,
        soilMoisture: 25 + Math.random() * 50,
        timestamp: new Date().toISOString()
      };
      handlers.onSensorReading(mockReading);
    }
  }, 5000);

  // Return mock connection object
  return {
    stop: () => clearInterval(mockInterval),
    state: 'Connected',
    isMock: true
  };
}

export function stopSignalRConnection() {
  if (signalRConnection) {
    signalRConnection.stop();
    signalRConnection = null;
  }
}

// ============================================
// ERROR NORMALIZATION UTIL
// ============================================

/**
 * Normalize Axios error to a simple, consumable shape.
 */
export function normalizeError(err) {
  const isAxios = !!err?.isAxiosError || !!err?.config;
  if (!isAxios) {
    return {
      message: err?.message || 'Unexpected error',
      status: undefined,
      code: err?.code,
      details: err
    };
  }

  const status = err?.response?.status;
  const data = err?.response?.data;
  const method = err?.config?.method?.toUpperCase();
  const url = err?.config?.url;

  let message = 'Request failed';
  if (typeof data === 'string') message = data;
  else if (data?.message) message = data.message;
  else if (status) message = `HTTP ${status}`;
  else if (err?.message) message = err.message;

  return {
    message,
    status,
    code: err?.code,
    url,
    method,
    details: data ?? err?.response ?? err
  };
}
