/**
 * TC Agro Solutions - API Module
 * Handles all HTTP requests to backend services
 * 
 * AUTHENTICATION NOTE:
 * ============================================================================
 * All protected API calls include the JWT token in the Authorization header.
 * The backend MUST validate this token on every request using [Authorize].
 * 
 * If the token is invalid or expired, the backend returns 401 Unauthorized.
 * The frontend handles this by redirecting to the login page.
 * ============================================================================
 * 
 * USAGE:
 * ============================================================================
 * Currently all API calls are COMMENTED OUT for demo purposes.
 * Mock data is used instead to demonstrate the UI.
 * 
 * To enable real API calls:
 * 1. Ensure backend is running
 * 2. Update API_BASE_URL to match backend
 * 3. Uncomment the fetch() calls in each function
 * 4. Remove mock data returns
 * ============================================================================
 */

// =============================================================================
// Configuration
// =============================================================================

const API_BASE_URL = '/api';  // Change to actual backend URL

/**
 * Default headers for API requests
 */
function getHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
}

/**
 * Handle API response
 * @param {Response} response - Fetch response
 * @returns {Promise<any>} Parsed response data
 */
async function handleResponse(response) {
  if (response.status === 401) {
    // Unauthorized - redirect to login
    clearToken();
    window.location.href = 'index.html';
    throw new Error('Session expired. Please login again.');
  }
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `HTTP error ${response.status}`);
  }
  
  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return null;
  }
  
  return response.json();
}

// =============================================================================
// Dashboard API
// =============================================================================

/**
 * Get dashboard statistics
 * @returns {Promise<object>} Dashboard data
 */
async function getDashboardStats() {
  // =========================================================================
  // MOCK DATA (remove when backend is ready)
  // =========================================================================
  return {
    totalProperties: 12,
    totalPlots: 47,
    activeSensors: 156,
    pendingAlerts: 3,
    recentReadings: [
      { sensorId: 'S001', plotName: 'North Field', temperature: 28.5, humidity: 65.2, soilMoisture: 42.1, timestamp: new Date().toISOString() },
      { sensorId: 'S002', plotName: 'South Valley', temperature: 27.8, humidity: 68.5, soilMoisture: 38.7, timestamp: new Date().toISOString() },
      { sensorId: 'S003', plotName: 'East Ridge', temperature: 29.1, humidity: 62.3, soilMoisture: 45.2, timestamp: new Date().toISOString() },
    ],
  };
  // =========================================================================
  
  /* =========================================================================
   * REAL API CALL (uncomment when backend is ready)
   * =========================================================================
   * 
   * const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
   *   method: 'GET',
   *   headers: getHeaders(),
   * });
   * return handleResponse(response);
   * 
   * =========================================================================
   */
}

/**
 * Get latest sensor readings
 * @param {number} limit - Number of readings to fetch
 * @returns {Promise<array>} Latest readings
 */
async function getLatestReadings(limit = 10) {
  // =========================================================================
  // MOCK DATA (remove when backend is ready)
  // =========================================================================
  return [
    { id: 1, sensorId: 'S001', plotName: 'North Field', temperature: 28.5, humidity: 65.2, soilMoisture: 42.1, timestamp: new Date().toISOString() },
    { id: 2, sensorId: 'S002', plotName: 'South Valley', temperature: 27.8, humidity: 68.5, soilMoisture: 38.7, timestamp: new Date().toISOString() },
    { id: 3, sensorId: 'S003', plotName: 'East Ridge', temperature: 29.1, humidity: 62.3, soilMoisture: 45.2, timestamp: new Date().toISOString() },
    { id: 4, sensorId: 'S004', plotName: 'West Grove', temperature: 26.9, humidity: 71.0, soilMoisture: 51.3, timestamp: new Date().toISOString() },
    { id: 5, sensorId: 'S005', plotName: 'Central Plain', temperature: 28.2, humidity: 64.8, soilMoisture: 39.5, timestamp: new Date().toISOString() },
  ];
  // =========================================================================
  
  /* =========================================================================
   * REAL API CALL (uncomment when backend is ready)
   * =========================================================================
   * 
   * const response = await fetch(`${API_BASE_URL}/dashboard/latest?limit=${limit}`, {
   *   method: 'GET',
   *   headers: getHeaders(),
   * });
   * return handleResponse(response);
   * 
   * =========================================================================
   */
}

// =============================================================================
// Properties API
// =============================================================================

/**
 * Get all properties
 * @returns {Promise<array>} List of properties
 */
async function getProperties() {
  // =========================================================================
  // MOCK DATA (remove when backend is ready)
  // =========================================================================
  return [
    { id: '1', name: 'Green Valley Farm', location: 'São Paulo, SP', areaHectares: 450.5, plotCount: 8, status: 'active', createdAt: '2024-06-15' },
    { id: '2', name: 'Sunrise Ranch', location: 'Minas Gerais, MG', areaHectares: 280.0, plotCount: 5, status: 'active', createdAt: '2024-08-20' },
    { id: '3', name: 'Highland Estate', location: 'Goiás, GO', areaHectares: 620.8, plotCount: 12, status: 'active', createdAt: '2024-03-10' },
    { id: '4', name: 'River Bend Farm', location: 'Paraná, PR', areaHectares: 185.2, plotCount: 4, status: 'inactive', createdAt: '2024-11-05' },
  ];
  // =========================================================================
  
  /* =========================================================================
   * REAL API CALL (uncomment when backend is ready)
   * =========================================================================
   * 
   * const response = await fetch(`${API_BASE_URL}/properties`, {
   *   method: 'GET',
   *   headers: getHeaders(),
   * });
   * return handleResponse(response);
   * 
   * =========================================================================
   */
}

/**
 * Get property by ID
 * @param {string} id - Property ID
 * @returns {Promise<object>} Property data
 */
async function getProperty(id) {
  // =========================================================================
  // MOCK DATA (remove when backend is ready)
  // =========================================================================
  const properties = await getProperties();
  return properties.find(p => p.id === id) || null;
  // =========================================================================
  
  /* =========================================================================
   * REAL API CALL (uncomment when backend is ready)
   * =========================================================================
   * 
   * const response = await fetch(`${API_BASE_URL}/properties/${id}`, {
   *   method: 'GET',
   *   headers: getHeaders(),
   * });
   * return handleResponse(response);
   * 
   * =========================================================================
   */
}

/**
 * Create new property
 * @param {object} data - Property data
 * @returns {Promise<object>} Created property
 */
async function createProperty(data) {
  // =========================================================================
  // MOCK DATA (remove when backend is ready)
  // =========================================================================
  console.log('Creating property:', data);
  return { id: Date.now().toString(), ...data, createdAt: new Date().toISOString() };
  // =========================================================================
  
  /* =========================================================================
   * REAL API CALL (uncomment when backend is ready)
   * =========================================================================
   * 
   * const response = await fetch(`${API_BASE_URL}/properties`, {
   *   method: 'POST',
   *   headers: getHeaders(),
   *   body: JSON.stringify(data),
   * });
   * return handleResponse(response);
   * 
   * =========================================================================
   */
}

/**
 * Update property
 * @param {string} id - Property ID
 * @param {object} data - Updated data
 * @returns {Promise<object>} Updated property
 */
async function updateProperty(id, data) {
  // =========================================================================
  // MOCK DATA (remove when backend is ready)
  // =========================================================================
  console.log('Updating property:', id, data);
  return { id, ...data, updatedAt: new Date().toISOString() };
  // =========================================================================
  
  /* =========================================================================
   * REAL API CALL (uncomment when backend is ready)
   * =========================================================================
   * 
   * const response = await fetch(`${API_BASE_URL}/properties/${id}`, {
   *   method: 'PUT',
   *   headers: getHeaders(),
   *   body: JSON.stringify(data),
   * });
   * return handleResponse(response);
   * 
   * =========================================================================
   */
}

/**
 * Delete property
 * @param {string} id - Property ID
 * @returns {Promise<void>}
 */
async function deleteProperty(id) {
  // =========================================================================
  // MOCK DATA (remove when backend is ready)
  // =========================================================================
  console.log('Deleting property:', id);
  return true;
  // =========================================================================
  
  /* =========================================================================
   * REAL API CALL (uncomment when backend is ready)
   * =========================================================================
   * 
   * const response = await fetch(`${API_BASE_URL}/properties/${id}`, {
   *   method: 'DELETE',
   *   headers: getHeaders(),
   * });
   * return handleResponse(response);
   * 
   * =========================================================================
   */
}

// =============================================================================
// Plots API
// =============================================================================

/**
 * Get all plots
 * @param {string} propertyId - Optional property filter
 * @returns {Promise<array>} List of plots
 */
async function getPlots(propertyId = null) {
  // =========================================================================
  // MOCK DATA (remove when backend is ready)
  // =========================================================================
  const plots = [
    { id: '1', name: 'North Field', propertyId: '1', propertyName: 'Green Valley Farm', cropType: 'Soybean', areaHectares: 85.5, status: 'active', sensorCount: 4 },
    { id: '2', name: 'South Valley', propertyId: '1', propertyName: 'Green Valley Farm', cropType: 'Corn', areaHectares: 120.0, status: 'active', sensorCount: 6 },
    { id: '3', name: 'East Ridge', propertyId: '2', propertyName: 'Sunrise Ranch', cropType: 'Coffee', areaHectares: 45.2, status: 'warning', sensorCount: 3 },
    { id: '4', name: 'West Grove', propertyId: '2', propertyName: 'Sunrise Ranch', cropType: 'Sugarcane', areaHectares: 95.8, status: 'active', sensorCount: 5 },
    { id: '5', name: 'Central Plain', propertyId: '3', propertyName: 'Highland Estate', cropType: 'Cotton', areaHectares: 200.0, status: 'alert', sensorCount: 8 },
  ];
  
  if (propertyId) {
    return plots.filter(p => p.propertyId === propertyId);
  }
  return plots;
  // =========================================================================
  
  /* =========================================================================
   * REAL API CALL (uncomment when backend is ready)
   * =========================================================================
   * 
   * const url = propertyId 
   *   ? `${API_BASE_URL}/properties/${propertyId}/plots`
   *   : `${API_BASE_URL}/plots`;
   * 
   * const response = await fetch(url, {
   *   method: 'GET',
   *   headers: getHeaders(),
   * });
   * return handleResponse(response);
   * 
   * =========================================================================
   */
}

/**
 * Get plot by ID
 * @param {string} id - Plot ID
 * @returns {Promise<object>} Plot data
 */
async function getPlot(id) {
  // =========================================================================
  // MOCK DATA (remove when backend is ready)
  // =========================================================================
  const plots = await getPlots();
  return plots.find(p => p.id === id) || null;
  // =========================================================================
  
  /* =========================================================================
   * REAL API CALL (uncomment when backend is ready)
   * =========================================================================
   * 
   * const response = await fetch(`${API_BASE_URL}/plots/${id}`, {
   *   method: 'GET',
   *   headers: getHeaders(),
   * });
   * return handleResponse(response);
   * 
   * =========================================================================
   */
}

/**
 * Create new plot
 * @param {object} data - Plot data
 * @returns {Promise<object>} Created plot
 */
async function createPlot(data) {
  // =========================================================================
  // MOCK DATA (remove when backend is ready)
  // =========================================================================
  console.log('Creating plot:', data);
  return { id: Date.now().toString(), ...data, createdAt: new Date().toISOString() };
  // =========================================================================
  
  /* =========================================================================
   * REAL API CALL (uncomment when backend is ready)
   * =========================================================================
   * 
   * const response = await fetch(`${API_BASE_URL}/plots`, {
   *   method: 'POST',
   *   headers: getHeaders(),
   *   body: JSON.stringify(data),
   * });
   * return handleResponse(response);
   * 
   * =========================================================================
   */
}

/**
 * Update plot
 * @param {string} id - Plot ID
 * @param {object} data - Updated data
 * @returns {Promise<object>} Updated plot
 */
async function updatePlot(id, data) {
  // =========================================================================
  // MOCK DATA (remove when backend is ready)
  // =========================================================================
  console.log('Updating plot:', id, data);
  return { id, ...data, updatedAt: new Date().toISOString() };
  // =========================================================================
  
  /* =========================================================================
   * REAL API CALL (uncomment when backend is ready)
   * =========================================================================
   * 
   * const response = await fetch(`${API_BASE_URL}/plots/${id}`, {
   *   method: 'PUT',
   *   headers: getHeaders(),
   *   body: JSON.stringify(data),
   * });
   * return handleResponse(response);
   * 
   * =========================================================================
   */
}

/**
 * Delete plot
 * @param {string} id - Plot ID
 * @returns {Promise<void>}
 */
async function deletePlot(id) {
  // =========================================================================
  // MOCK DATA (remove when backend is ready)
  // =========================================================================
  console.log('Deleting plot:', id);
  return true;
  // =========================================================================
  
  /* =========================================================================
   * REAL API CALL (uncomment when backend is ready)
   * =========================================================================
   * 
   * const response = await fetch(`${API_BASE_URL}/plots/${id}`, {
   *   method: 'DELETE',
   *   headers: getHeaders(),
   * });
   * return handleResponse(response);
   * 
   * =========================================================================
   */
}

// =============================================================================
// Sensors API
// =============================================================================

/**
 * Get all sensors
 * @param {string} plotId - Optional plot filter
 * @returns {Promise<array>} List of sensors
 */
async function getSensors(plotId = null) {
  // =========================================================================
  // MOCK DATA (remove when backend is ready)
  // =========================================================================
  const sensors = [
    { id: 'S001', plotId: '1', plotName: 'North Field', type: 'Multi-Sensor', status: 'online', lastReading: { temperature: 28.5, humidity: 65.2, soilMoisture: 42.1 }, lastUpdate: new Date().toISOString() },
    { id: 'S002', plotId: '2', plotName: 'South Valley', type: 'Multi-Sensor', status: 'online', lastReading: { temperature: 27.8, humidity: 68.5, soilMoisture: 38.7 }, lastUpdate: new Date().toISOString() },
    { id: 'S003', plotId: '3', plotName: 'East Ridge', type: 'Temperature', status: 'warning', lastReading: { temperature: 29.1, humidity: 62.3, soilMoisture: 28.2 }, lastUpdate: new Date().toISOString() },
    { id: 'S004', plotId: '4', plotName: 'West Grove', type: 'Humidity', status: 'online', lastReading: { temperature: 26.9, humidity: 71.0, soilMoisture: 51.3 }, lastUpdate: new Date().toISOString() },
    { id: 'S005', plotId: '5', plotName: 'Central Plain', type: 'Multi-Sensor', status: 'offline', lastReading: { temperature: 0, humidity: 0, soilMoisture: 0 }, lastUpdate: '2026-01-08T10:30:00Z' },
  ];
  
  if (plotId) {
    return sensors.filter(s => s.plotId === plotId);
  }
  return sensors;
  // =========================================================================
  
  /* =========================================================================
   * REAL API CALL (uncomment when backend is ready)
   * =========================================================================
   * 
   * const url = plotId 
   *   ? `${API_BASE_URL}/plots/${plotId}/sensors`
   *   : `${API_BASE_URL}/sensors`;
   * 
   * const response = await fetch(url, {
   *   method: 'GET',
   *   headers: getHeaders(),
   * });
   * return handleResponse(response);
   * 
   * =========================================================================
   */
}

// =============================================================================
// Alerts API
// =============================================================================

/**
 * Get all alerts
 * @param {string} status - Optional status filter (pending, resolved, all)
 * @returns {Promise<array>} List of alerts
 */
async function getAlerts(status = 'all') {
  // =========================================================================
  // MOCK DATA (remove when backend is ready)
  // =========================================================================
  const alerts = [
    { id: '1', plotId: '5', plotName: 'Central Plain', sensorId: 'S005', type: 'offline', severity: 'critical', message: 'Sensor offline for more than 24 hours', status: 'pending', createdAt: '2026-01-08T10:30:00Z' },
    { id: '2', plotId: '3', plotName: 'East Ridge', sensorId: 'S003', type: 'low_moisture', severity: 'warning', message: 'Soil moisture below 30% for 24 hours', status: 'pending', createdAt: '2026-01-09T08:15:00Z' },
    { id: '3', plotId: '1', plotName: 'North Field', sensorId: 'S001', type: 'high_temp', severity: 'info', message: 'Temperature above 30°C detected', status: 'resolved', createdAt: '2026-01-08T14:20:00Z', resolvedAt: '2026-01-08T16:45:00Z' },
  ];
  
  if (status !== 'all') {
    return alerts.filter(a => a.status === status);
  }
  return alerts;
  // =========================================================================
  
  /* =========================================================================
   * REAL API CALL (uncomment when backend is ready)
   * =========================================================================
   * 
   * const response = await fetch(`${API_BASE_URL}/alerts?status=${status}`, {
   *   method: 'GET',
   *   headers: getHeaders(),
   * });
   * return handleResponse(response);
   * 
   * =========================================================================
   */
}

/**
 * Resolve an alert
 * @param {string} id - Alert ID
 * @returns {Promise<object>} Updated alert
 */
async function resolveAlert(id) {
  // =========================================================================
  // MOCK DATA (remove when backend is ready)
  // =========================================================================
  console.log('Resolving alert:', id);
  return { id, status: 'resolved', resolvedAt: new Date().toISOString() };
  // =========================================================================
  
  /* =========================================================================
   * REAL API CALL (uncomment when backend is ready)
   * =========================================================================
   * 
   * const response = await fetch(`${API_BASE_URL}/alerts/${id}/resolve`, {
   *   method: 'POST',
   *   headers: getHeaders(),
   * });
   * return handleResponse(response);
   * 
   * =========================================================================
   */
}

// =============================================================================
// SignalR Real-Time Connection
// =============================================================================

/**
 * Initialize SignalR connection for real-time updates
 * @param {function} onReading - Callback for new sensor readings
 * @param {function} onAlert - Callback for new alerts
 * @returns {object} SignalR connection object
 */
function initSignalRConnection(onReading, onAlert) {
  // =========================================================================
  // MOCK SIGNALR (simulates real-time updates for demo)
  // =========================================================================
  console.log('SignalR: Using mock connection for demo');
  
  // Simulate periodic updates
  const mockConnection = {
    start: () => {
      console.log('SignalR: Mock connection started');
      
      // Simulate sensor readings every 5 seconds
      setInterval(() => {
        if (onReading) {
          const mockReading = {
            sensorId: `S00${Math.floor(Math.random() * 5) + 1}`,
            plotName: ['North Field', 'South Valley', 'East Ridge', 'West Grove', 'Central Plain'][Math.floor(Math.random() * 5)],
            temperature: 25 + Math.random() * 10,
            humidity: 50 + Math.random() * 30,
            soilMoisture: 30 + Math.random() * 30,
            timestamp: new Date().toISOString(),
          };
          onReading(mockReading);
        }
      }, 5000);
      
      return Promise.resolve();
    },
    stop: () => {
      console.log('SignalR: Mock connection stopped');
      return Promise.resolve();
    },
    state: 'Connected',
  };
  
  return mockConnection;
  // =========================================================================
  
  /* =========================================================================
   * REAL SIGNALR (uncomment when backend is ready)
   * =========================================================================
   * 
   * // Include SignalR script in HTML:
   * // <script src="https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/7.0.0/signalr.min.js"></script>
   * 
   * const connection = new signalR.HubConnectionBuilder()
   *   .withUrl('/hubs/telemetry', {
   *     accessTokenFactory: () => getToken(),
   *   })
   *   .withAutomaticReconnect()
   *   .configureLogging(signalR.LogLevel.Information)
   *   .build();
   * 
   * // Subscribe to sensor readings
   * connection.on('SensorReadingReceived', (reading) => {
   *   console.log('SignalR: New reading', reading);
   *   if (onReading) onReading(reading);
   * });
   * 
   * // Subscribe to alerts
   * connection.on('AlertGenerated', (alert) => {
   *   console.log('SignalR: New alert', alert);
   *   if (onAlert) onAlert(alert);
   * });
   * 
   * // Handle connection events
   * connection.onreconnecting(() => {
   *   console.log('SignalR: Reconnecting...');
   * });
   * 
   * connection.onreconnected(() => {
   *   console.log('SignalR: Reconnected');
   * });
   * 
   * connection.onclose(() => {
   *   console.log('SignalR: Disconnected');
   * });
   * 
   * return connection;
   * 
   * =========================================================================
   */
}

// =============================================================================
// Export for module usage (if needed)
// =============================================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    API_BASE_URL,
    getHeaders,
    getDashboardStats,
    getLatestReadings,
    getProperties, getProperty, createProperty, updateProperty, deleteProperty,
    getPlots, getPlot, createPlot, updatePlot, deletePlot,
    getSensors,
    getAlerts, resolveAlert,
    initSignalRConnection,
  };
}
