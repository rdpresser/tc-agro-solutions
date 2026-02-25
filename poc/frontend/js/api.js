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
export const sensorApi = createApiClient(APP_CONFIG.sensorApiBaseUrl);

export async function fetchFarmSwagger() {
  const { data } = await farmApi.get('/swagger/v1/swagger.json');
  return data;
}

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
attachInterceptors(sensorApi);

// ============================================
// DASHBOARD API
// ============================================

/**
 * Get dashboard statistics
 * @returns {Promise<Object>} Dashboard stats from real APIs
 */
export async function getDashboardStats() {
  const [propertiesResponse, plotsResponse, sensorsResponse] = await Promise.all([
    farmApi.get('/api/properties', {
      params: {
        pageNumber: 1,
        pageSize: 1,
        sortBy: 'name',
        sortDirection: 'asc',
        filter: ''
      }
    }),
    farmApi.get('/api/plots', {
      params: {
        pageNumber: 1,
        pageSize: 1,
        sortBy: 'name',
        sortDirection: 'asc',
        filter: ''
      }
    }),
    farmApi.get('/api/sensors', {
      params: {
        pageNumber: 1,
        pageSize: 1,
        sortBy: 'installedAt',
        sortDirection: 'desc',
        filter: ''
      }
    })
  ]);

  const propertiesTotal = getPaginatedTotal(propertiesResponse?.data);
  const plotsTotal = getPaginatedTotal(plotsResponse?.data);
  const sensorsTotal = getPaginatedTotal(sensorsResponse?.data);

  return {
    properties: propertiesTotal,
    plots: plotsTotal,
    sensors: sensorsTotal,
    alerts: 0
  };
}

/**
 * Get latest sensor readings
 * @param {number} limit - Max readings to return (default: 5)
 * @returns {Promise<Array>} Latest readings from Sensor Ingest API
 */
export async function getLatestReadings(limit = 5) {
  const { data } = await sensorApi.get('/api/dashboard/latest', { params: { limit } });
  const readings = data?.readings || data?.Readings || data || [];

  if (!Array.isArray(readings)) {
    return [];
  }

  return readings.map((reading) => ({
    id: reading.id || reading.Id,
    sensorId: reading.sensorId || reading.SensorId,
    plotId: reading.plotId || reading.PlotId,
    plotName: reading.plotName || reading.PlotName || '-',
    label: reading.label || reading.Label || null,
    temperature: reading.temperature ?? reading.Temperature ?? null,
    humidity: reading.humidity ?? reading.Humidity ?? null,
    soilMoisture: reading.soilMoisture ?? reading.SoilMoisture ?? null,
    rainfall: reading.rainfall ?? reading.Rainfall ?? null,
    batteryLevel: reading.batteryLevel ?? reading.BatteryLevel ?? null,
    timestamp: reading.timestamp || reading.time || reading.Time
  }));
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
  const { data } = await farmApi.get(`/api/properties/${encodeURIComponent(id)}`);
  return data;
}

/**
 * Create new property
 * @param {Object} propertyData - Property data
 * @returns {Promise<Object>} Created property (mock data)
 * NOTE: When integrating real API, add 'async' back and uncomment REAL API section
 */
export async function createProperty(propertyData) {
  const { data } = await farmApi.post('/api/properties', propertyData);
  return data;
}

/**
 * Update existing property
 * @param {string} id - Property ID
 * @param {Object} propertyData - Updated property data
 * @returns {Promise<Object>} Updated property (mock data)
 * NOTE: When integrating real API, add 'async' back and uncomment REAL API section
 */
export async function updateProperty(id, propertyData) {
  const { data } = await farmApi.put(`/api/properties/${encodeURIComponent(id)}`, propertyData);
  return data;
}

/**
 * Delete property
 * @param {string} _id - Property ID to delete
 * @returns {Promise<boolean>} Success status (mock data)
 * NOTE: When integrating real API, add 'async' back and uncomment REAL API section
 */
export async function deleteProperty(id) {
  await farmApi.delete(`/api/properties/${encodeURIComponent(id)}`);
  return true;
}

// ============================================
// OWNERS API
// ============================================

export async function getOwnersQueryParameterMapFromSwagger() {
  const swagger = await fetchFarmSwagger();
  const ownerGet = swagger?.paths?.['/api/owners']?.get;
  const parameters = Array.isArray(ownerGet?.parameters) ? ownerGet.parameters : [];

  const findParamName = (expectedName, fallback) => {
    const param = parameters.find(
      (item) => String(item?.name || '').toLowerCase() === expectedName.toLowerCase()
    );
    return param?.name || fallback;
  };

  return {
    pageNumber: findParamName('pageNumber', 'pageNumber'),
    pageSize: findParamName('pageSize', 'pageSize'),
    sortBy: findParamName('sortBy', 'sortBy'),
    sortDirection: findParamName('sortDirection', 'sortDirection'),
    filter: findParamName('filter', 'filter')
  };
}

export async function getOwnersPaginated(
  { pageNumber = 1, pageSize = 10, sortBy = 'name', sortDirection = 'asc', filter = '' } = {},
  parameterMap = null
) {
  const params = {
    [parameterMap?.pageNumber || 'pageNumber']: pageNumber,
    [parameterMap?.pageSize || 'pageSize']: pageSize,
    [parameterMap?.sortBy || 'sortBy']: sortBy,
    [parameterMap?.sortDirection || 'sortDirection']: sortDirection,
    [parameterMap?.filter || 'filter']: filter
  };

  const { data } = await farmApi.get('/api/owners', { params });
  return data;
}

// ============================================
// PLOTS API
// ============================================

/**
 * Get plots filtered by property
 * @param {string|null} propertyId - Property ID to filter by (default: null = all)
 * @returns {Promise<Array>} List of plots (returns items from paginated response)
 */
export async function getPlots(propertyId = null) {
  const response = await getPlotsPaginated({ propertyId, pageSize: 1000 }); // Large page size to get all
  return response?.items || response?.data || response?.results || [];
}

export async function getPlot(id) {
  const { data } = await farmApi.get(`/api/plots/${encodeURIComponent(id)}`);
  return data;
}

export async function getPlotsPaginated({
  pageNumber = 1,
  pageSize = 10,
  sortBy = 'name',
  sortDirection = 'asc',
  filter = '',
  propertyId = '',
  cropType = '',
  status = ''
} = {}) {
  void status;

  const params = {
    pageNumber,
    pageSize,
    sortBy,
    sortDirection,
    filter,
    cropType,
    propertyId
  };

  Object.keys(params).forEach((key) => {
    if (params[key] === '' || params[key] === null || params[key] === undefined) {
      delete params[key];
    }
  });

  const { data } = await farmApi.get('/api/plots', { params });
  return data;
}

/**
 * Create new plot
 * @param {Object} plotData - Plot data
 * @returns {Promise<Object>} Created plot (mock data)
 * NOTE: When integrating real API, add 'async' back and uncomment REAL API section
 */
export async function createPlot(plotData) {
  const { data } = await farmApi.post('/api/plots', plotData);
  return data;
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

export async function getSensorsPaginated({
  pageNumber = 1,
  pageSize = 10,
  sortBy = 'installedAt',
  sortDirection = 'desc',
  filter = '',
  propertyId = '',
  plotId = '',
  type = '',
  status = ''
} = {}) {
  const params = {
    pageNumber,
    pageSize,
    sortBy,
    sortDirection,
    filter,
    propertyId,
    plotId,
    type,
    status
  };

  Object.keys(params).forEach((key) => {
    if (params[key] === '' || params[key] === null || params[key] === undefined) {
      delete params[key];
    }
  });

  const { data } = await farmApi.get('/api/sensors', { params });
  return data;
}

export async function getSensorById(id) {
  const { data } = await farmApi.get(`/api/sensors/${encodeURIComponent(id)}`);
  return data;
}

export async function createSensor(payload) {
  const { data } = await farmApi.post('/api/sensors', payload);
  return data;
}

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
 * @returns {Promise<Array>} List of alerts from API (empty when endpoint is unavailable)
 */
export async function getAlerts(status = null) {
  try {
    const { data } = await sensorApi.get('/alerts', {
      params: status ? { status } : {}
    });

    if (Array.isArray(data)) {
      return data;
    }

    return data?.items || data?.data || data?.results || [];
  } catch (error) {
    const statusCode = error?.response?.status;
    if (statusCode === 404 || statusCode === 501) {
      return [];
    }

    throw error;
  }
}

function getPaginatedTotal(responseData) {
  if (!responseData || typeof responseData !== 'object') {
    return 0;
  }

  if (typeof responseData.totalCount === 'number') {
    return responseData.totalCount;
  }

  if (typeof responseData.TotalCount === 'number') {
    return responseData.TotalCount;
  }

  const items = responseData.items || responseData.data || responseData.results || [];
  return Array.isArray(items) ? items.length : 0;
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

export async function checkEmailAvailability(email) {
  const { data } = await identityApi.get(`/auth/check-email/${encodeURIComponent(email)}`);
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

/**
 * Initialize SignalR connection to Sensor Hub
 * @param {Object} handlers - Event handlers
 * @param {Function} handlers.onSensorReading - Handler for sensor reading events (data: { sensorId, temperature, humidity, soilMoisture, timestamp })
 * @param {Function} handlers.onSensorStatus - Handler for sensor status change events (data: { sensorId, status })
 * @param {Function} handlers.onConnectionChange - Handler for connection state changes (state: 'connected' | 'reconnecting' | 'disconnected')
 * @returns {Promise<Object>} SignalR connection object
 */
export async function initSignalRConnection(handlers = {}) {
  if (!APP_CONFIG.signalREnabled) {
    console.warn('[SignalR] Disabled by VITE_SIGNALR_ENABLED. Realtime connection not started.');
    handlers.onConnectionChange?.('disconnected');
    return null;
  }

  try {
    signalRConnection = new HubConnectionBuilder()
      .withUrl(`${APP_CONFIG.sensorApiBaseUrl}/dashboard/sensorshub`, {
        accessTokenFactory: () => getToken()
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();

    // Register event handlers (camelCase as per SignalR convention)
    if (handlers.onSensorReading) {
      signalRConnection.on('sensorReading', handlers.onSensorReading);
    }

    if (handlers.onSensorStatus) {
      signalRConnection.on('sensorStatusChanged', handlers.onSensorStatus);
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
  } catch (error) {
    console.error('[SignalR] Failed to connect to /dashboard/sensorshub:', error);
    handlers.onConnectionChange?.('disconnected');
    toast('Real-time connection unavailable', 'warning');
    return null;
  }
}

/**
 * Join a plot group to receive real-time updates for sensors in that plot
 * @param {string} plotId - Plot ID to join
 * @returns {Promise<void>}
 */
export async function joinPlotGroup(plotId) {
  if (signalRConnection && !signalRConnection.isMock) {
    try {
      await signalRConnection.invoke('JoinPlotGroup', plotId);
    } catch (error) {
      console.error(`Failed to join plot group ${plotId}:`, error);
    }
  }
}

/**
 * Leave a plot group to stop receiving real-time updates for sensors in that plot
 * @param {string} plotId - Plot ID to leave
 * @returns {Promise<void>}
 */
export async function leavePlotGroup(plotId) {
  if (signalRConnection && !signalRConnection.isMock) {
    try {
      await signalRConnection.invoke('LeavePlotGroup', plotId);
    } catch (error) {
      console.error(`Failed to leave plot group ${plotId}:`, error);
    }
  }
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
