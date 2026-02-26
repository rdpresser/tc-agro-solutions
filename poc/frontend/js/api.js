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
export const analyticsApi = createApiClient(APP_CONFIG.analyticsApiBaseUrl);

const SENSOR_METADATA_TTL_MS = 5 * 60 * 1000;
const sensorMetadataCacheByOwner = new Map();

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
attachInterceptors(analyticsApi);

// ============================================
// DASHBOARD API
// ============================================

/**
 * Get dashboard statistics
 * @returns {Promise<Object>} Dashboard stats from real APIs
 */
export async function getDashboardStats(ownerId = null) {
  const ownerParams = ownerId ? { ownerId } : {};

  const [propertiesResponse, plotsResponse, sensorsResponse] = await Promise.all([
    farmApi.get('/api/properties', {
      params: {
        pageNumber: 1,
        pageSize: 1,
        sortBy: 'name',
        sortDirection: 'asc',
        ...ownerParams
      }
    }),
    farmApi.get('/api/plots', {
      params: {
        pageNumber: 1,
        pageSize: 1,
        sortBy: 'name',
        sortDirection: 'asc',
        ...ownerParams
      }
    }),
    farmApi.get('/api/sensors', {
      params: {
        pageNumber: 1,
        pageSize: 1,
        sortBy: 'installedAt',
        sortDirection: 'desc',
        ...ownerParams
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
 * @param {number} pageSize - Max readings to return (default: 5)
 * @returns {Promise<Array>} Latest readings from Sensor Ingest API
 */
export async function getLatestReadings(pageSize = 5, ownerId = null) {
  const { data } = await sensorApi.get('/api/dashboard/latest', {
    params: {
      pageNumber: 1,
      pageSize,
      ...(ownerId ? { ownerId } : {})
    }
  });
  return normalizeReadings(extractReadingsArray(data), ownerId);
}

/**
 * Get latest readings from generic readings endpoint (supports filters)
 * @param {Object} params - Filter/pagination options
 * @param {string|null} params.sensorId - Optional sensor filter
 * @param {string|null} params.plotId - Optional plot filter
 * @param {number} params.pageNumber - Page number (default: 1)
 * @param {number} params.pageSize - Page size (default: 20)
 * @returns {Promise<Array>} Normalized latest readings
 */
export async function getReadingsLatest({
  sensorId = null,
  plotId = null,
  pageNumber = 1,
  pageSize = 20,
  ownerId = null
} = {}) {
  const params = { pageNumber, pageSize };
  if (sensorId) params.sensorId = sensorId;
  if (plotId) params.plotId = plotId;
  if (ownerId) params.ownerId = ownerId;

  const { data } = await sensorApi.get('/api/readings/latest', { params });
  return normalizeReadings(extractReadingsArray(data), ownerId);
}

/**
 * Get historical sensor data for plotting
 * @param {string} sensorId - Sensor ID
 * @param {number} days - Days of data to retrieve (default: 7)
 * @returns {Promise<Array>} Historical readings from Sensor Ingest API
 */
export async function getHistoricalData(sensorId, days = 7, pageSize = 200, ownerId = null) {
  if (!sensorId) {
    return [];
  }

  const { data } = await sensorApi.get(`/api/sensors/${encodeURIComponent(sensorId)}/readings`, {
    params: {
      days,
      pageNumber: 1,
      pageSize,
      ...(ownerId ? { ownerId } : {})
    }
  });

  const history = (await normalizeReadings(extractReadingsArray(data), ownerId)).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return history;
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
export async function getPlots(propertyId = null, ownerId = null) {
  const response = await getPlotsPaginated({ propertyId, ownerId, pageSize: 1000 }); // Large page size to get all
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
  ownerId = '',
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
    propertyId,
    ownerId
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
 * @returns {Promise<Array>} List of sensors derived from Sensor Ingest latest readings
 */
export async function getSensors(plotId = null) {
  const readings = await getReadingsLatest({ plotId, pageNumber: 1, pageSize: 100 });

  return readings.map((reading) => ({
    id: reading.sensorId,
    sensorLabel: reading.sensorLabel || null,
    plotId: reading.plotId,
    plotName: reading.plotName || reading.plotId || '-',
    propertyName: reading.propertyName || '-',
    status: deriveSensorStatusFromReading(reading.timestamp),
    battery: reading.batteryLevel,
    lastReading: reading.timestamp,
    temperature: reading.temperature,
    humidity: reading.humidity,
    soilMoisture: reading.soilMoisture
  }));
}

function extractReadingsArray(payload) {
  const readings = payload?.data || payload?.Data || payload || [];
  return Array.isArray(readings) ? readings : [];
}

async function normalizeReadings(readings, ownerId = null) {
  if (!Array.isArray(readings) || readings.length === 0) {
    return [];
  }

  let metadataMap = new Map();
  try {
    metadataMap = await getSensorMetadataMap(ownerId);
  } catch (error) {
    console.warn(
      '[Readings] Could not load sensor metadata from Farm API. Continuing without enrichment.',
      {
        route: '/api/sensors',
        error
      }
    );
  }

  return readings.map((reading) => {
    const sensorId = reading?.sensorId || reading?.SensorId;
    const metadata = sensorId ? metadataMap.get(String(sensorId).toLowerCase()) : null;
    return normalizeSensorReading(reading, metadata);
  });
}

function normalizeSensorReading(reading, metadata = null) {
  const sensorId = reading.sensorId || reading.SensorId;
  const plotId = reading.plotId || reading.PlotId;

  return {
    id: reading.id || reading.Id,
    sensorId,
    plotId,
    plotName: reading.plotName || reading.PlotName || metadata?.plotName || '-',
    propertyName: reading.propertyName || reading.PropertyName || metadata?.propertyName || '-',
    sensorLabel:
      reading.sensorLabel ||
      reading.SensorLabel ||
      reading.label ||
      reading.Label ||
      metadata?.sensorLabel ||
      null,
    temperature: reading.temperature ?? reading.Temperature ?? null,
    humidity: reading.humidity ?? reading.Humidity ?? null,
    soilMoisture: reading.soilMoisture ?? reading.SoilMoisture ?? null,
    rainfall: reading.rainfall ?? reading.Rainfall ?? null,
    batteryLevel: reading.batteryLevel ?? reading.BatteryLevel ?? null,
    timestamp: reading.timestamp || reading.time || reading.Time
  };
}

async function getSensorMetadataMap(ownerId = null) {
  const now = Date.now();
  const ownerKey = ownerId || '__all__';
  const cached = sensorMetadataCacheByOwner.get(ownerKey);

  if (cached && cached.expiresAt > now && cached.map.size > 0) {
    return cached.map;
  }

  const metadataMap = new Map();
  let pageNumber = 1;
  const pageSize = 100;
  let hasNextPage = true;
  let safetyCounter = 0;

  while (hasNextPage && safetyCounter < 30) {
    let data;
    try {
      const response = await farmApi.get('/api/sensors', {
        params: {
          pageNumber,
          pageSize,
          sortBy: 'installedAt',
          sortDirection: 'desc',
          ...(ownerId ? { ownerId } : {})
        }
      });
      data = response?.data;
    } catch (error) {
      console.warn('[Readings] Farm sensor metadata request failed.', {
        route: '/api/sensors',
        pageNumber,
        pageSize,
        error
      });
      break;
    }

    const sensors = data?.data || data?.items || data?.results || [];
    sensors.forEach((sensor) => {
      const sensorId = sensor?.id ? String(sensor.id).toLowerCase() : null;
      if (!sensorId) return;

      metadataMap.set(sensorId, {
        sensorLabel: sensor?.label || null,
        plotName: sensor?.plotName || '-',
        propertyName: sensor?.propertyName || '-'
      });
    });

    const explicitHasNext = data?.hasNextPage;
    if (typeof explicitHasNext === 'boolean') {
      hasNextPage = explicitHasNext;
    } else {
      hasNextPage = Array.isArray(sensors) && sensors.length === pageSize;
    }

    pageNumber += 1;
    safetyCounter += 1;
  }

  sensorMetadataCacheByOwner.set(ownerKey, {
    expiresAt: now + SENSOR_METADATA_TTL_MS,
    map: metadataMap
  });

  return metadataMap;
}

function deriveSensorStatusFromReading(timestamp) {
  if (!timestamp) return 'Inactive';

  const ageMs = Date.now() - new Date(timestamp).getTime();
  if (Number.isNaN(ageMs)) return 'Inactive';
  if (ageMs <= 15 * 60 * 1000) return 'Active';
  if (ageMs <= 60 * 60 * 1000) return 'Maintenance';
  return 'Inactive';
}

// ============================================
// ALERTS API
// ============================================

/**
 * Get alerts filtered by status
 * @param {string|null} status - Alert status filter (default: null = all)
 * @returns {Promise<Array>} List of alerts from API (empty when endpoint is unavailable)
 */
export async function getAlerts(status = null, ownerId = null) {
  try {
    if (status && status.toLowerCase() !== 'pending') {
      console.warn(
        '[Alerts] Dashboard supports pending alerts feed only. Requested status ignored.',
        {
          requestedStatus: status,
          routeUsed: '/api/alerts/pending'
        }
      );
    }

    const { data } = await analyticsApi.get('/api/alerts/pending', {
      params: {
        pageNumber: 1,
        pageSize: 20,
        ...(ownerId ? { ownerId } : {})
      }
    });

    const items = Array.isArray(data) ? data : data?.items || data?.data || data?.results || [];

    return items.map((alert) => ({
      ...alert,
      severity: normalizeAlertSeverity(alert?.severity),
      createdAt: alert?.createdAt || alert?.CreatedAt,
      plotName: alert?.plotName || alert?.PlotName || '-',
      sensorId: alert?.sensorId || alert?.SensorId || '-'
    }));
  } catch (error) {
    const statusCode = error?.response?.status;
    if (statusCode === 404 || statusCode === 501) {
      return [];
    }

    throw error;
  }
}

function normalizeAlertSeverity(severity) {
  const value = String(severity || '').toLowerCase();
  if (!value) return 'info';
  if (value === 'critical') return 'critical';
  if (value === 'high') return 'warning';
  if (value === 'medium') return 'warning';
  if (value === 'low') return 'info';
  return value;
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
let alertSignalRConnection = null;

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
    console.warn('[SignalR] Disabled by VITE_SIGNALR_ENABLED. Realtime connection not started.', {
      hub: '/dashboard/sensorshub',
      action: 'caller should use HTTP fallback polling'
    });
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
    console.warn('[SignalR] Falling back to HTTP polling handled by page module.', {
      hub: '/dashboard/sensorshub',
      action: 'switch-to-http-fallback'
    });
    handlers.onConnectionChange?.('disconnected');
    toast('Real-time connection unavailable', 'warning');
    return null;
  }
}

export async function initAlertSignalRConnection(handlers = {}) {
  if (!APP_CONFIG.signalREnabled) {
    console.warn(
      '[AlertSignalR] Disabled by VITE_SIGNALR_ENABLED. AlertHub connection not started.',
      {
        hub: '/dashboard/alertshub',
        action: 'caller should use HTTP fallback polling'
      }
    );
    handlers.onConnectionChange?.('disconnected');
    return null;
  }

  try {
    alertSignalRConnection = new HubConnectionBuilder()
      .withUrl(`${APP_CONFIG.analyticsApiBaseUrl}/dashboard/alertshub`, {
        accessTokenFactory: () => getToken()
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();

    if (handlers.onAlertCreated) {
      alertSignalRConnection.on('alertCreated', handlers.onAlertCreated);
    }

    if (handlers.onAlertAcknowledged) {
      alertSignalRConnection.on('alertAcknowledged', handlers.onAlertAcknowledged);
    }

    if (handlers.onAlertResolved) {
      alertSignalRConnection.on('alertResolved', handlers.onAlertResolved);
    }

    alertSignalRConnection.onreconnecting(() => {
      handlers.onConnectionChange?.('reconnecting');
    });

    alertSignalRConnection.onreconnected(() => {
      handlers.onConnectionChange?.('connected');
    });

    alertSignalRConnection.onclose(() => {
      handlers.onConnectionChange?.('disconnected');
    });

    await alertSignalRConnection.start();
    handlers.onConnectionChange?.('connected');
    return alertSignalRConnection;
  } catch (error) {
    console.error('[AlertSignalR] Failed to connect to /dashboard/alertshub:', error);
    console.warn('[AlertSignalR] Falling back to HTTP alerts polling handled by page module.', {
      hub: '/dashboard/alertshub',
      route: '/api/alerts/pending'
    });
    handlers.onConnectionChange?.('disconnected');
    return null;
  }
}

export async function joinOwnerGroup(ownerId = null) {
  if (signalRConnection && !signalRConnection.isMock) {
    try {
      if (ownerId === null || ownerId === undefined || ownerId === '') {
        await signalRConnection.invoke('JoinOwnerGroup');
      } else {
        await signalRConnection.invoke('JoinOwnerGroup', ownerId);
      }
      return true;
    } catch (error) {
      console.error(`Failed to join owner group ${ownerId}:`, error);
      return false;
    }
  }

  return false;
}

export async function leaveOwnerGroup(ownerId = null) {
  if (signalRConnection && !signalRConnection.isMock) {
    try {
      if (ownerId === null || ownerId === undefined || ownerId === '') {
        await signalRConnection.invoke('LeaveOwnerGroup');
      } else {
        await signalRConnection.invoke('LeaveOwnerGroup', ownerId);
      }
      return true;
    } catch (error) {
      console.error(`Failed to leave owner group ${ownerId}:`, error);
      return false;
    }
  }

  return false;
}
export async function joinAlertOwnerGroup(ownerId = null) {
  if (alertSignalRConnection && !alertSignalRConnection.isMock) {
    try {
      if (ownerId === null || ownerId === undefined || ownerId === '') {
        await alertSignalRConnection.invoke('JoinOwnerGroup');
      } else {
        await alertSignalRConnection.invoke('JoinOwnerGroup', ownerId);
      }
      return true;
    } catch (error) {
      console.error(`Failed to join alert owner group ${ownerId}:`, error);
      return false;
    }
  }

  return false;
}

export async function leaveAlertOwnerGroup(ownerId = null) {
  if (alertSignalRConnection && !alertSignalRConnection.isMock) {
    try {
      if (ownerId === null || ownerId === undefined || ownerId === '') {
        await alertSignalRConnection.invoke('LeaveOwnerGroup');
      } else {
        await alertSignalRConnection.invoke('LeaveOwnerGroup', ownerId);
      }
      return true;
    } catch (error) {
      console.error(`Failed to leave alert owner group ${ownerId}:`, error);
      return false;
    }
  }

  return false;
}

export function stopSignalRConnection() {
  if (signalRConnection) {
    signalRConnection.stop();
    signalRConnection = null;
  }
}

export function stopAlertSignalRConnection() {
  if (alertSignalRConnection) {
    alertSignalRConnection.stop();
    alertSignalRConnection = null;
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
