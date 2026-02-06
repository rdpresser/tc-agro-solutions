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

// ============================================
// DASHBOARD API
// ============================================

/**
 * Get dashboard statistics
 * @returns {Promise<Object>} Dashboard stats (mock data)
 * NOTE: When integrating real API, add 'async' back and uncomment REAL API section
 */
export function getDashboardStats() {
  // MOCK DATA (for demo)
  return Promise.resolve({
    properties: 4,
    plots: 5,
    sensors: 12,
    alerts: 3
  });

  /* REAL API (uncomment when backend ready)
  const { data } = await api.get('/dashboard/stats');
  return data;
  */
}

/**
 * Get latest sensor readings
 * @param {number} _limit - Max readings to return (default: 5)
 * @returns {Promise<Array>} Latest readings (mock data)
 * NOTE: When integrating real API, add 'async' back and uncomment REAL API section
 */
export function getLatestReadings(_limit = 5) {
  // MOCK DATA (for demo)
  return [
    {
      sensorId: 'SENSOR-001',
      plotName: 'North Field',
      temperature: 28.5,
      humidity: 65,
      soilMoisture: 42,
      timestamp: new Date().toISOString()
    },
    {
      sensorId: 'SENSOR-002',
      plotName: 'South Valley',
      temperature: 27.8,
      humidity: 68,
      soilMoisture: 45,
      timestamp: new Date(Date.now() - 300000).toISOString()
    },
    {
      sensorId: 'SENSOR-003',
      plotName: 'East Ridge',
      temperature: 36.2,
      humidity: 38,
      soilMoisture: 22,
      timestamp: new Date(Date.now() - 900000).toISOString()
    },
    {
      sensorId: 'SENSOR-004',
      plotName: 'West Grove',
      temperature: 29.1,
      humidity: 62,
      soilMoisture: 48,
      timestamp: new Date(Date.now() - 600000).toISOString()
    },
    {
      sensorId: 'SENSOR-006',
      plotName: 'Central Plain',
      temperature: 30.4,
      humidity: 55,
      soilMoisture: 38,
      timestamp: new Date(Date.now() - 600000).toISOString()
    }
  ];

  /* REAL API (uncomment when backend ready)
  const { data } = await api.get('/dashboard/latest', { params: { limit } });
  return data;
  */
}

/**
 * Get historical sensor data for plotting
 * @param {string} sensorId - Sensor ID
 * @param {number} days - Days of data to retrieve (default: 7)
 * @returns {Promise<Array>} Historical readings (mock data)
 * NOTE: When integrating real API, add 'async' back and uncomment REAL API section
 */
export function getHistoricalData(sensorId, days = 7) {
  // MOCK DATA - Generate 7 days of hourly readings
  const data = [];
  const now = Date.now();

  for (let d = days; d >= 0; d--) {
    for (let h = 0; h < 24; h += 4) {
      // Every 4 hours
      const timestamp = new Date(now - (d * 24 + h) * 3600000);
      data.push({
        timestamp: timestamp.toISOString(),
        temperature: 25 + Math.random() * 10,
        humidity: 50 + Math.random() * 30,
        soilMoisture: 30 + Math.random() * 40
      });
    }
  }

  return data;

  /* REAL API (uncomment when backend ready)
  const { data } = await api.get(`/sensors/${sensorId}/readings`, { params: { days } });
  return data;
  */
}

// ============================================
// PROPERTIES API
// ============================================

/**
 * Get all properties
 * @returns {Promise<Array>} List of properties (mock data)
 * NOTE: When integrating real API, add 'async' back and uncomment REAL API section
 */
export function getProperties() {
  // MOCK DATA
  return [
    {
      id: 'prop-001',
      name: 'Green Valley Farm',
      location: 'São Paulo, SP',
      areaHectares: 350.5,
      status: 'active',
      plotsCount: 2
    },
    {
      id: 'prop-002',
      name: 'Sunrise Ranch',
      location: 'Minas Gerais, MG',
      areaHectares: 180.0,
      status: 'active',
      plotsCount: 2
    },
    {
      id: 'prop-003',
      name: 'Highland Estate',
      location: 'Goiás, GO',
      areaHectares: 250.0,
      status: 'active',
      plotsCount: 1
    },
    {
      id: 'prop-004',
      name: 'River Bend Farm',
      location: 'Paraná, PR',
      areaHectares: 120.0,
      status: 'inactive',
      plotsCount: 0
    }
  ];

  /* REAL API
  const { data } = await api.get('/properties');
  return data;
  */
}

export async function getProperty(id) {
  const properties = await getProperties();
  return properties.find((p) => p.id === id);

  /* REAL API
  const { data } = await api.get(`/properties/${id}`);
  return data;
  */
}

/**
 * Create new property
 * @param {Object} propertyData - Property data
 * @returns {Promise<Object>} Created property (mock data)
 * NOTE: When integrating real API, add 'async' back and uncomment REAL API section
 */
export function createProperty(propertyData) {
  // MOCK - Return created property
  return { id: `prop-${Date.now()}`, ...propertyData };

  /* REAL API
  const { data } = await api.post('/properties', propertyData);
  return data;
  */
}

/**
 * Update existing property
 * @param {string} id - Property ID
 * @param {Object} propertyData - Updated property data
 * @returns {Promise<Object>} Updated property (mock data)
 * NOTE: When integrating real API, add 'async' back and uncomment REAL API section
 */
export function updateProperty(id, propertyData) {
  // MOCK
  return { id, ...propertyData };

  /* REAL API
  const { data } = await api.put(`/properties/${id}`, propertyData);
  return data;
  */
}

/**
 * Delete property
 * @param {string} _id - Property ID to delete
 * @returns {Promise<boolean>} Success status (mock data)
 * NOTE: When integrating real API, add 'async' back and uncomment REAL API section
 */
export function deleteProperty(_id) {
  // MOCK
  return true;

  /* REAL API
  await api.delete(`/properties/${id}`);
  return true;
  */
}

// ============================================
// PLOTS API
// ============================================

/**
 * Get plots filtered by property
 * @param {string|null} propertyId - Property ID to filter by (default: null = all)
 * @returns {Promise<Array>} List of plots (mock data)
 * NOTE: When integrating real API, add 'async' back and uncomment REAL API section
 */
export function getPlots(propertyId = null) {
  // MOCK DATA
  const plots = [
    {
      id: 'plot-001',
      propertyId: 'prop-001',
      propertyName: 'Green Valley Farm',
      name: 'North Field',
      cropType: 'soybean',
      areaHectares: 85.5,
      status: 'healthy',
      sensorsCount: 4
    },
    {
      id: 'plot-002',
      propertyId: 'prop-001',
      propertyName: 'Green Valley Farm',
      name: 'South Valley',
      cropType: 'corn',
      areaHectares: 120.0,
      status: 'healthy',
      sensorsCount: 6
    },
    {
      id: 'plot-003',
      propertyId: 'prop-002',
      propertyName: 'Sunrise Ranch',
      name: 'East Ridge',
      cropType: 'coffee',
      areaHectares: 45.2,
      status: 'warning',
      sensorsCount: 3
    },
    {
      id: 'plot-004',
      propertyId: 'prop-002',
      propertyName: 'Sunrise Ranch',
      name: 'West Grove',
      cropType: 'sugarcane',
      areaHectares: 95.8,
      status: 'healthy',
      sensorsCount: 5
    },
    {
      id: 'plot-005',
      propertyId: 'prop-003',
      propertyName: 'Highland Estate',
      name: 'Central Plain',
      cropType: 'cotton',
      areaHectares: 200.0,
      status: 'alert',
      sensorsCount: 8
    }
  ];

  return propertyId ? plots.filter((p) => p.propertyId === propertyId) : plots;

  /* REAL API
  const { data } = await api.get('/plots', { params: { propertyId } });
  return data;
  */
}

export async function getPlot(id) {
  const plots = await getPlots();
  return plots.find((p) => p.id === id);

  /* REAL API
  const { data } = await api.get(`/plots/${id}`);
  return data;
  */
}

/**
 * Create new plot
 * @param {Object} plotData - Plot data
 * @returns {Promise<Object>} Created plot (mock data)
 * NOTE: When integrating real API, add 'async' back and uncomment REAL API section
 */
export function createPlot(plotData) {
  return { id: `plot-${Date.now()}`, ...plotData };

  /* REAL API
  const { data } = await api.post('/plots', plotData);
  return data;
  */
}

/**
 * Update existing plot
 * @param {string} id - Plot ID
 * @param {Object} plotData - Updated plot data
 * @returns {Promise<Object>} Updated plot (mock data)
 * NOTE: When integrating real API, add 'async' back and uncomment REAL API section
 */
export function updatePlot(id, plotData) {
  return { id, ...plotData };

  /* REAL API
  const { data } = await api.put(`/plots/${id}`, plotData);
  return data;
  */
}

/**
 * Delete plot
 * @param {string} _id - Plot ID to delete
 * @returns {Promise<boolean>} Success status (mock data)
 * NOTE: When integrating real API, add 'async' back and uncomment REAL API section
 */
export function deletePlot(_id) {
  return true;

  /* REAL API
  await api.delete(`/plots/${id}`);
  return true;
  */
}

// ============================================
// SENSORS API
// ============================================

/**
 * Get sensors filtered by plot
 * @param {string|null} plotId - Plot ID to filter by (default: null = all)
 * @returns {Promise<Array>} List of sensors (mock data)
 * NOTE: When integrating real API, add 'async' back and uncomment REAL API section
 */
export function getSensors(plotId = null) {
  // MOCK DATA
  const sensors = [
    {
      id: 'SENSOR-001',
      plotId: 'plot-001',
      plotName: 'North Field',
      status: 'online',
      battery: 85,
      lastReading: new Date().toISOString(),
      temperature: 28.5,
      humidity: 65,
      soilMoisture: 42
    },
    {
      id: 'SENSOR-002',
      plotId: 'plot-002',
      plotName: 'South Valley',
      status: 'online',
      battery: 72,
      lastReading: new Date().toISOString(),
      temperature: 27.8,
      humidity: 68,
      soilMoisture: 45
    },
    {
      id: 'SENSOR-003',
      plotId: 'plot-003',
      plotName: 'East Ridge',
      status: 'warning',
      battery: 60,
      lastReading: new Date(Date.now() - 900000).toISOString(),
      temperature: 36.2,
      humidity: 38,
      soilMoisture: 22
    },
    {
      id: 'SENSOR-004',
      plotId: 'plot-004',
      plotName: 'West Grove',
      status: 'online',
      battery: 90,
      lastReading: new Date().toISOString(),
      temperature: 29.1,
      humidity: 62,
      soilMoisture: 48
    },
    {
      id: 'SENSOR-005',
      plotId: 'plot-005',
      plotName: 'Central Plain',
      status: 'offline',
      battery: 45,
      lastReading: new Date(Date.now() - 7200000).toISOString(),
      temperature: null,
      humidity: null,
      soilMoisture: null
    },
    {
      id: 'SENSOR-006',
      plotId: 'plot-005',
      plotName: 'Central Plain',
      status: 'warning',
      battery: 15,
      lastReading: new Date(Date.now() - 600000).toISOString(),
      temperature: 30.4,
      humidity: 55,
      soilMoisture: 38
    }
  ];

  return plotId ? sensors.filter((s) => s.plotId === plotId) : sensors;

  /* REAL API
  const { data } = await api.get('/sensors', { params: { plotId } });
  return data;
  */
}

// ============================================
// ALERTS API
// ============================================

/**
 * Get alerts filtered by status
 * @param {string|null} status - Alert status filter (default: null = all)
 * @returns {Promise<Array>} List of alerts (mock data)
 * NOTE: When integrating real API, add 'async' back and uncomment REAL API section
 */
export function getAlerts(status = null) {
  // MOCK DATA
  const alerts = [
    {
      id: 'alert-001',
      severity: 'critical',
      title: 'Sensor Offline - SENSOR-005',
      message: 'Sensor at Central Plain has not responded for over 2 hours.',
      plotId: 'plot-005',
      plotName: 'Central Plain',
      sensorId: 'SENSOR-005',
      status: 'pending',
      createdAt: new Date(Date.now() - 600000).toISOString()
    },
    {
      id: 'alert-002',
      severity: 'critical',
      title: 'Low Soil Moisture - Extended Period',
      message: 'Soil moisture at East Ridge has been below 30% for over 24 hours.',
      plotId: 'plot-003',
      plotName: 'East Ridge',
      sensorId: 'SENSOR-003',
      status: 'pending',
      createdAt: new Date(Date.now() - 1500000).toISOString()
    },
    {
      id: 'alert-003',
      severity: 'warning',
      title: 'Low Battery - SENSOR-006',
      message: 'Sensor at Central Plain has battery level at 15%.',
      plotId: 'plot-005',
      plotName: 'Central Plain',
      sensorId: 'SENSOR-006',
      status: 'pending',
      createdAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'alert-004',
      severity: 'warning',
      title: 'High Temperature Alert',
      message: 'Temperature at North Field exceeded 35°C threshold.',
      plotId: 'plot-001',
      plotName: 'North Field',
      sensorId: 'SENSOR-001',
      status: 'resolved',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      resolvedAt: new Date(Date.now() - 3600000).toISOString()
    }
  ];

  return status ? alerts.filter((a) => a.status === status) : alerts;

  /* REAL API
  const { data } = await api.get('/alerts', { params: { status } });
  return data;
  */
}

/**
 * Resolve/close alert
 * @param {string} _alertId - Alert ID to resolve
 * @returns {Promise<boolean>} Success status (mock data)
 * NOTE: When integrating real API, add 'async' back and uncomment REAL API section
 */
export function resolveAlert(_alertId) {
  return true;

  /* REAL API
  await api.post(`/alerts/${alertId}/resolve`);
  return true;
  */
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
      .withUrl(`${APP_CONFIG.apiBaseUrl.replace('/api', '')}/sensorHub`, {
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
