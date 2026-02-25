/**
 * TC Agro Solutions - Dashboard Page Entry Point
 */

import {
  getDashboardStats,
  getLatestReadings,
  getReadingsLatest,
  getHistoricalData,
  getAlerts,
  getPlots,
  initSignalRConnection,
  initAlertSignalRConnection,
  stopSignalRConnection,
  stopAlertSignalRConnection
} from './api.js';
import { addDataPoint, createReadingsChart, destroyAllCharts } from './charts.js';
import { initProtectedPage } from './common.js';
import { toast, t } from './i18n.js';
import { createFallbackPoller } from './realtime-fallback.js';
import {
  $,
  formatDate,
  formatNumber,
  formatPercentage,
  formatRelativeTime,
  formatTemperature,
  debounce,
  getUser
} from './utils.js';

// ============================================
// PAGE INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  if (!initProtectedPage()) {
    return;
  }

  const user = getUser();
  if (user && user.name) {
    const userDisplay = $('#userDisplay');
    if (userDisplay) {
      userDisplay.textContent = user.name;
    }
  }

  const shouldEnableRealtime = await loadDashboardData();
  if (shouldEnableRealtime) {
    setupRealTimeUpdates();
  }
});

window.addEventListener('beforeunload', async () => {
  if (joinedPlotIds.length > 0) {
    const { leavePlotGroup, leaveAlertPlotGroup } = await import('./api.js');
    for (const plotId of joinedPlotIds) {
      try {
        await leavePlotGroup(plotId);
      } catch (error) {
        console.warn(`Failed to leave plot ${plotId}:`, error);
      }

      try {
        await leaveAlertPlotGroup(plotId);
      } catch (error) {
        console.warn(`Failed to leave alert plot ${plotId}:`, error);
      }
    }
    joinedPlotIds = [];
    joinedAlertPlotIds = [];
  }

  stopFallbackPollingSilently();
  stopSignalRConnection();
  stopAlertSignalRConnection();
  destroyAllCharts();
});

async function loadDashboardData() {
  try {
    const userPlots = await getPlots();
    const hasPlots = Array.isArray(userPlots) && userPlots.length > 0;

    if (!hasPlots) {
      hasSetupForRealtime = false;
      renderInitialSetupState();
      return false;
    }

    // Load all data in parallel
    const [stats, dashboardReadings, latestReadings, alerts] = await Promise.all([
      getDashboardStats(),
      getLatestReadings(5),
      getReadingsLatest({ pageNumber: 1, pageSize: 20 }),
      getAlerts('pending').catch(() => [])
    ]);

    updateStatCards(stats);
    const readingsForTable = dashboardReadings.length > 0 ? dashboardReadings : latestReadings;
    updateReadingsTable(readingsForTable);
    updateAlertsSection(alerts);
    const alertStat = $('#stat-alerts');
    if (alertStat) {
      alertStat.textContent = String(alerts.length);
    }

    const freshestReading = pickFreshestReading(latestReadings, readingsForTable);
    if (freshestReading) {
      applyLatestReadingToMetrics(freshestReading);
    }

    const chartSensorId = freshestReading?.sensorId;
    if (chartSensorId) {
      const history = await getHistoricalData(chartSensorId, 7, 168);
      renderReadingsChart(history);
    } else {
      renderReadingsChart([]);
    }

    return true;
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    toast('dashboard.load_failed', 'error');
    return false;
  }
}

function pickFreshestReading(...readingCollections) {
  const allReadings = readingCollections.flat().filter(Boolean);
  if (!allReadings.length) return null;

  return allReadings
    .slice()
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())[0];
}

function applyLatestReadingToMetrics(reading) {
  updateMetricCard('temperature', reading.temperature ?? null);
  updateMetricCard('humidity', reading.humidity ?? null);
  updateMetricCard('soil-moisture', reading.soilMoisture ?? null);
  updateMetricCard('rainfall', reading.rainfall ?? null);
}

function renderReadingsChart(history) {
  const container = $('#readings-chart-container');
  if (!container) return;

  container.innerHTML = '<canvas id="readings-chart"></canvas>';
  createReadingsChart('readings-chart', history || []);
}

function renderInitialSetupState() {
  const statProperties = $('#stat-properties');
  const statPlots = $('#stat-plots');
  const statSensors = $('#stat-sensors');
  const statAlerts = $('#stat-alerts');

  if (statProperties) statProperties.textContent = '0';
  if (statPlots) statPlots.textContent = '0';
  if (statSensors) statSensors.textContent = '0';
  if (statAlerts) statAlerts.textContent = '0';

  const readingsBody = $('#readings-tbody');
  if (readingsBody) {
    readingsBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted">
          No readings yet. Create a property, plot and sensor to start collecting data.
        </td>
      </tr>
    `;
  }

  const pendingAlerts = $('#pending-alerts');
  if (pendingAlerts) {
    pendingAlerts.innerHTML =
      '<p class="text-center text-muted" style="padding: 20px">No alerts yet. Alerts will appear after sensors start sending data.</p>';
  }

  const readingsChartContainer = $('#readings-chart-container');
  if (readingsChartContainer) {
    readingsChartContainer.innerHTML = `
      <div class="chart-placeholder">
        <div class="chart-placeholder-icon">📊</div>
        <p>Initial setup required</p>
        <p class="text-muted" style="font-size: 0.85rem">
          Create property, plot and sensor to visualize readings.
        </p>
      </div>
    `;
  }

  const alertsChartContainer = $('#alerts-chart-container');
  if (alertsChartContainer) {
    alertsChartContainer.innerHTML = `
      <div class="chart-placeholder">
        <div class="chart-placeholder-icon">📈</div>
        <p>Initial setup required</p>
        <p class="text-muted" style="font-size: 0.85rem">
          Alert distribution appears after sensor data starts flowing.
        </p>
      </div>
    `;
  }

  const metricIds = [
    'metric-temperature',
    'metric-humidity',
    'metric-soil-moisture',
    'metric-rainfall'
  ];

  metricIds.forEach((id) => {
    const metricElement = $(`#${id}`);
    if (metricElement) {
      metricElement.textContent = '--';
    }
  });

  const connectionStatus = $('#connection-status');
  if (connectionStatus) {
    connectionStatus.className = 'badge badge-warning';
    connectionStatus.textContent = '● Setup required';
    connectionStatus.title =
      'Create properties, plots and sensors before real-time metrics can be displayed.';
  }
}

// ============================================
// STAT CARDS
// ============================================

function updateStatCards(stats) {
  const statElements = {
    properties: $('#stat-properties'),
    plots: $('#stat-plots'),
    sensors: $('#stat-sensors'),
    alerts: $('#stat-alerts')
  };

  Object.entries(statElements).forEach(([key, el]) => {
    if (el && stats[key] !== undefined) {
      el.textContent = stats[key];
    }
  });
}

// ============================================
// READINGS TABLE
// ============================================

function updateReadingsTable(readings) {
  const tbody = $('#readings-tbody');
  if (!tbody) return;

  if (!Array.isArray(readings) || readings.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted">No readings available yet.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = readings
    .map(
      (reading) => `
    <tr>
      <td><strong>${getSensorDisplayName(reading)}</strong></td>
      <td>${formatPlotDisplay(reading)}</td>
      <td class="${getTemperatureClass(reading.temperature)}">${formatTemperature(reading.temperature)}</td>
      <td class="${getHumidityClass(reading.humidity)}">${formatPercentage(reading.humidity)}</td>
      <td class="${getSoilMoistureClass(reading.soilMoisture)}">${formatPercentage(reading.soilMoisture)}</td>
      <td title="${formatDate(reading.timestamp)}">${formatRelativeTime(reading.timestamp)}</td>
    </tr>
  `
    )
    .join('');
}

function getSensorDisplayName(reading) {
  return reading.sensorLabel || reading.SensorLabel || reading.sensorId || reading.SensorId || '-';
}

function formatPlotDisplay(reading) {
  const plotName = reading.plotName || reading.PlotName || '-';
  const propertyName = reading.propertyName || reading.PropertyName || '';

  if (!propertyName || propertyName === '-') {
    return plotName;
  }

  return `${plotName} - ${propertyName}`;
}

function getTemperatureClass(temp) {
  if (!temp) return '';
  if (temp > 35) return 'text-danger';
  if (temp > 32) return 'text-warning';
  return '';
}

function getHumidityClass(humidity) {
  if (!humidity) return '';
  if (humidity < 30) return 'text-warning';
  return '';
}

function getSoilMoistureClass(moisture) {
  if (!moisture) return '';
  if (moisture < 25) return 'text-danger';
  if (moisture < 35) return 'text-warning';
  return '';
}

// ============================================
// ALERTS SECTION
// ============================================

function updateAlertsSection(alerts) {
  const container = $('#pending-alerts');
  if (!container) return;

  if (!alerts.length) {
    container.innerHTML = '<p class="no-data">No pending alerts</p>';
    return;
  }

  container.innerHTML = alerts
    .slice(0, 5)
    .map(
      (alert) => `
    <div class="alert-item alert-${alert.severity}" data-alert-id="${alert.id || alert.Id || ''}">
      <div class="alert-header">
        <span class="alert-badge badge-${alert.severity}">
          ${getSeverityIcon(alert.severity)} ${getSeverityLabel(alert.severity)}
        </span>
        <span class="alert-badge ${getAlertStatusBadgeClass(alert.status || alert.Status)}" data-alert-status>
          ${getAlertStatusLabel(alert.status || alert.Status)}
        </span>
        <span class="alert-time" title="${formatDate(alert.createdAt)}">
          ${formatRelativeTime(alert.createdAt)}
        </span>
      </div>
      <h4 class="alert-title">${alert.title || alert.alertType || 'Alert'}</h4>
      <p class="alert-message">${alert.message}</p>
      <div class="alert-meta">
        <span>📍 ${alert.plotName}</span>
        <span>📡 ${alert.sensorId}</span>
      </div>
    </div>
  `
    )
    .join('');
}

function getSeverityIcon(severity) {
  const icons = { critical: '🚨', warning: '⚠️', info: 'ℹ️' };
  return icons[severity] || 'ℹ️';
}

function getSeverityLabel(severity) {
  const labels = { critical: 'Critical', warning: 'Warning', info: 'Info' };
  return labels[severity] || severity;
}

function getAlertStatusLabel(status) {
  const normalized = String(status || 'Pending').toLowerCase();
  if (normalized === 'acknowledged') return 'Acknowledged';
  if (normalized === 'resolved') return 'Resolved';
  return 'Pending';
}

function getAlertStatusBadgeClass(status) {
  const normalized = String(status || 'Pending').toLowerCase();
  if (normalized === 'resolved') return 'badge-success';
  if (normalized === 'acknowledged') return 'badge-warning';
  return 'badge-danger';
}

function extractAlertId(payload) {
  return payload?.alertId || payload?.AlertId || payload?.id || payload?.Id || null;
}

function extractAlertStatus(payload, fallbackStatus = 'Pending') {
  return payload?.status || payload?.Status || fallbackStatus;
}

function updateAlertCardVisualStatus(alertId, nextStatus) {
  if (!alertId) {
    return;
  }

  const card = document.querySelector(`[data-alert-id="${alertId}"]`);
  if (!card) {
    return;
  }

  const statusBadge = card.querySelector('[data-alert-status]');
  if (statusBadge) {
    statusBadge.className = `alert-badge ${getAlertStatusBadgeClass(nextStatus)}`;
    statusBadge.textContent = getAlertStatusLabel(nextStatus);
  }

  if (String(nextStatus).toLowerCase() === 'resolved') {
    card.style.opacity = '0.55';
    setTimeout(() => {
      card.remove();
      const alertStat = $('#stat-alerts');
      if (alertStat) {
        const current = parseInt(alertStat.textContent || '0', 10);
        if (current > 0) {
          alertStat.textContent = String(current - 1);
        }
      }
    }, 800);
  }
}

// ============================================
// REAL-TIME UPDATES (SIGNALR)
// ============================================

const DASHBOARD_REALTIME_CONTEXT = {
  page: 'dashboard',
  hub: '/dashboard/sensorshub',
  events: ['sensorReading', 'sensorStatusChanged'],
  fallbackRoutes: ['/api/dashboard/latest', '/api/readings/latest']
};

const DASHBOARD_ALERTS_REALTIME_CONTEXT = {
  page: 'dashboard',
  hub: '/dashboard/alertshub',
  events: ['alertCreated', 'alertAcknowledged', 'alertResolved'],
  fallbackRoutes: ['/api/alerts/pending']
};

let joinedPlotIds = []; // Track joined plot groups
let joinedAlertPlotIds = [];
let isJoiningPlotGroups = false;
let hasSetupForRealtime = true;
let sensorRealtimeState = 'disconnected';
let alertsRealtimeState = 'disconnected';
const fallbackPoller = createFallbackPoller({
  refresh: refreshDashboardFromFallback,
  intervalMs: 15000,
  context: 'DashboardRealtime',
  connection: DASHBOARD_REALTIME_CONTEXT,
  onError: (error) => {
    console.warn('[DashboardRealtime] HTTP fallback refresh failed.', {
      ...DASHBOARD_REALTIME_CONTEXT,
      error
    });
  }
});

async function setupRealTimeUpdates() {
  const sensorConnection = await initSignalRConnection({
    onSensorReading: handleSensorReading,
    onConnectionChange: handleSensorConnectionChange
  });

  const alertsConnection = await initAlertSignalRConnection({
    onAlertCreated: (payload) => handleAlertRealtime('created', payload),
    onAlertAcknowledged: (payload) => handleAlertRealtime('acknowledged', payload),
    onAlertResolved: (payload) => handleAlertRealtime('resolved', payload),
    onConnectionChange: handleAlertConnectionChange
  });

  // After connection, join all plot groups to receive sensor readings
  if (sensorConnection && !sensorConnection.isMock) {
    await joinAllPlotGroups();
  }

  if (!sensorConnection || sensorConnection.isMock) {
    fallbackPoller.start('sensor-initial-connect-failed');
  }

  if (!alertsConnection || alertsConnection.isMock) {
    fallbackPoller.start('alerts-initial-connect-failed');
  }
}

async function refreshDashboardFromFallback() {
  const [dashboardReadingsResult, latestReadingsResult, alertsResult] = await Promise.allSettled([
    getLatestReadings(5),
    getReadingsLatest({ pageNumber: 1, pageSize: 20 }),
    getAlerts('pending').catch(() => [])
  ]);

  if (dashboardReadingsResult.status === 'rejected') {
    console.warn('[DashboardRealtime] Fallback route failed: /api/dashboard/latest', {
      hub: DASHBOARD_REALTIME_CONTEXT.hub,
      eventStream: DASHBOARD_REALTIME_CONTEXT.events,
      error: dashboardReadingsResult.reason
    });
  }

  if (latestReadingsResult.status === 'rejected') {
    console.warn('[DashboardRealtime] Fallback route failed: /api/readings/latest', {
      hub: DASHBOARD_REALTIME_CONTEXT.hub,
      eventStream: DASHBOARD_REALTIME_CONTEXT.events,
      error: latestReadingsResult.reason
    });
  }

  if (alertsResult.status === 'rejected') {
    console.warn('[DashboardRealtime] Fallback route failed: /api/alerts/pending', {
      hub: DASHBOARD_ALERTS_REALTIME_CONTEXT.hub,
      eventStream: DASHBOARD_ALERTS_REALTIME_CONTEXT.events,
      error: alertsResult.reason
    });
  }

  const dashboardReadings =
    dashboardReadingsResult.status === 'fulfilled' ? dashboardReadingsResult.value : [];
  const latestReadings =
    latestReadingsResult.status === 'fulfilled' ? latestReadingsResult.value : [];
  const alerts = alertsResult.status === 'fulfilled' ? alertsResult.value : [];

  const readingsForTable = dashboardReadings.length > 0 ? dashboardReadings : latestReadings;
  updateReadingsTable(readingsForTable);
  updateAlertsSection(alerts);
  const alertStat = $('#stat-alerts');
  if (alertStat) {
    alertStat.textContent = String(alerts.length);
  }

  const freshestReading = pickFreshestReading(latestReadings, readingsForTable);
  if (freshestReading) {
    applyLatestReadingToMetrics(freshestReading);
  }
}

function stopFallbackPollingSilently() {
  fallbackPoller.stop('page-unload', { silent: true });
}

async function joinAllPlotGroups() {
  if (isJoiningPlotGroups) {
    return;
  }

  if (!hasSetupForRealtime) {
    return;
  }

  isJoiningPlotGroups = true;

  try {
    const { joinPlotGroup, joinAlertPlotGroup } = await import('./api.js');
    const plots = await getPlots();
    const plotIds = (plots || []).map((plot) => plot?.id).filter(Boolean);

    if (plotIds.length > 0) {
      console.warn(`[SignalR] Joining ${plotIds.length} plot groups...`);

      joinedPlotIds = [];
      joinedAlertPlotIds = [];
      for (const plotId of plotIds) {
        try {
          await joinPlotGroup(plotId);
          joinedPlotIds.push(plotId);
          console.warn(`[SignalR] ✅ Joined plot group: ${plotId}`);
        } catch (error) {
          console.warn(`[SignalR] Failed to join plot ${plotId}:`, error);
        }

        try {
          await joinAlertPlotGroup(plotId);
          joinedAlertPlotIds.push(plotId);
          console.warn(`[AlertSignalR] ✅ Joined plot group: ${plotId}`);
        } catch (error) {
          console.warn(`[AlertSignalR] Failed to join plot ${plotId}:`, error);
        }
      }

      console.warn(`[SignalR] Successfully joined ${joinedPlotIds.length} plot groups`);
    } else {
      hasSetupForRealtime = false;
      console.warn('[SignalR] No plots found. Skipping realtime plot group subscriptions.');
    }
  } catch (error) {
    const statusCode = error?.response?.status;
    if (statusCode === 400 || statusCode === 404) {
      hasSetupForRealtime = false;
      console.warn('[SignalR] No plot context available for current user yet.');
      return;
    }

    console.error('[SignalR] Error joining plot groups:', error);
  } finally {
    isJoiningPlotGroups = false;
  }
}

const handleSensorReading = debounce((reading) => {
  const normalized = {
    ...reading,
    sensorId: reading.sensorId || reading.SensorId,
    plotId: reading.plotId || reading.PlotId,
    plotName: reading.plotName || reading.PlotName || '-',
    propertyName: reading.propertyName || reading.PropertyName || '-',
    sensorLabel: reading.sensorLabel || reading.SensorLabel || null,
    timestamp: reading.timestamp || reading.Timestamp || new Date().toISOString(),
    temperature: reading.temperature ?? reading.Temperature ?? null,
    humidity: reading.humidity ?? reading.Humidity ?? null,
    soilMoisture: reading.soilMoisture ?? reading.SoilMoisture ?? null,
    rainfall: reading.rainfall ?? reading.Rainfall ?? null
  };

  // Update metric cards
  applyLatestReadingToMetrics(normalized);

  const timeLabel = new Date(normalized.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
  addDataPoint(
    'readings-chart',
    timeLabel,
    [normalized.temperature ?? 0, normalized.humidity ?? 0, normalized.soilMoisture ?? 0],
    168
  );

  // Update readings table (prepend new reading)
  const tbody = $('#readings-tbody');
  if (tbody && tbody.firstChild) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${getSensorDisplayName(normalized)}</strong></td>
      <td>${formatPlotDisplay(normalized)}</td>
      <td>${formatTemperature(normalized.temperature)}</td>
      <td>${formatPercentage(normalized.humidity)}</td>
      <td>${formatPercentage(normalized.soilMoisture)}</td>
      <td>now</td>
    `;
    row.style.backgroundColor = '#e8f5e9';
    tbody.insertBefore(row, tbody.firstChild);

    // Remove highlight after animation
    setTimeout(() => {
      row.style.backgroundColor = '';
    }, 2000);

    // Keep only 10 rows
    while (tbody.children.length > 10) {
      tbody.removeChild(tbody.lastChild);
    }
  }
}, 500);

function handleSensorConnectionChange(state) {
  sensorRealtimeState = state;

  const indicator = $('#connection-status');
  if (indicator) {
    indicator.className =
      state === 'connected'
        ? 'badge badge-success'
        : state === 'reconnecting'
          ? 'badge badge-warning'
          : 'badge badge-danger';
    indicator.textContent =
      state === 'connected' ? '● Live' : state === 'reconnecting' ? '● Reconnecting' : '● Offline';
    indicator.title =
      state === 'connected'
        ? t('connection.connected')
        : state === 'reconnecting'
          ? t('connection.reconnecting')
          : t('connection.disconnected');
  }

  // Rejoin plot groups after reconnection (without creating a new connection)
  if (state === 'connected' && hasSetupForRealtime) {
    console.warn('[SignalR] Connected, (re)joining plot groups...');
    joinAllPlotGroups();
  }

  if (state === 'reconnecting' || state === 'disconnected') {
    console.warn(
      '[DashboardRealtime] SignalR stream degraded. HTTP fallback remains active until recovery.',
      {
        state,
        hub: DASHBOARD_REALTIME_CONTEXT.hub,
        signalrEvents: DASHBOARD_REALTIME_CONTEXT.events,
        fallbackRoutes: DASHBOARD_REALTIME_CONTEXT.fallbackRoutes
      }
    );
  }

  syncFallbackMode('sensor');
}

function handleAlertConnectionChange(state) {
  alertsRealtimeState = state;

  if (state === 'connected' && hasSetupForRealtime) {
    console.warn('[AlertSignalR] Connected, (re)joining plot groups...');
    joinAllPlotGroups();
  }

  if (state === 'reconnecting' || state === 'disconnected') {
    console.warn(
      '[DashboardAlertsRealtime] AlertHub stream degraded. HTTP fallback remains active until recovery.',
      {
        state,
        hub: DASHBOARD_ALERTS_REALTIME_CONTEXT.hub,
        signalrEvents: DASHBOARD_ALERTS_REALTIME_CONTEXT.events,
        fallbackRoutes: DASHBOARD_ALERTS_REALTIME_CONTEXT.fallbackRoutes
      }
    );
  }

  syncFallbackMode('alerts');
}

function syncFallbackMode(source) {
  const sensorConnected = sensorRealtimeState === 'connected';
  const alertsConnected = alertsRealtimeState === 'connected';

  if (sensorConnected && alertsConnected) {
    if (fallbackPoller.isRunning()) {
      fallbackPoller.stop(`${source}-connection-state-connected`);
    }
    return;
  }

  fallbackPoller.start(`sensor:${sensorRealtimeState}|alerts:${alertsRealtimeState}`);
}

async function handleAlertRealtime(eventType, payload) {
  const alertId = extractAlertId(payload);
  const fallbackStatus =
    eventType === 'resolved'
      ? 'Resolved'
      : eventType === 'acknowledged'
        ? 'Acknowledged'
        : 'Pending';
  const nextStatus = extractAlertStatus(payload, fallbackStatus);

  if (eventType === 'acknowledged' || eventType === 'resolved') {
    updateAlertCardVisualStatus(alertId, nextStatus);
  }

  try {
    const alerts = await getAlerts('pending');
    updateAlertsSection(alerts);

    const alertStat = $('#stat-alerts');
    if (alertStat) {
      alertStat.textContent = String(alerts.length);
    }
  } catch (error) {
    console.warn(
      '[DashboardAlertsRealtime] Failed to refresh pending alerts after AlertHub event.',
      {
        hub: DASHBOARD_ALERTS_REALTIME_CONTEXT.hub,
        route: '/api/alerts/pending',
        error
      }
    );
  }
}

function updateMetricCard(metric, value) {
  const el = $(`#metric-${metric}`);
  if (el && value !== null) {
    el.textContent = formatNumber(value, 1);

    // Add pulse animation
    el.classList.add('pulse');
    setTimeout(() => el.classList.remove('pulse'), 500);
  }
}

// ============================================
// INITIALIZATION
// ============================================

// ============================================
// EXPORT FOR DEBUGGING
// ============================================

if (import.meta.env.DEV) {
  window.dashboardDebug = {
    loadDashboardData,
    updateStatCards,
    updateReadingsTable
  };
}
