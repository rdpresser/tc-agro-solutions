/**
 * TC Agro Solutions - Dashboard Page Entry Point
 */

import {
  getDashboardStats,
  getLatestReadings,
  getAlerts,
  getPlots,
  initSignalRConnection,
  stopSignalRConnection
} from './api.js';
import { initProtectedPage } from './common.js';
import { toast, t } from './i18n.js';
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
  // Initialize protected page (sidebar, logout, auth check)
  if (!initProtectedPage()) {
    // Redirect to login handled by initProtectedPage
    return;
  }

  // Update user display with JWT claim (name from token)
  const user = getUser();
  if (user && user.name) {
    const userDisplay = $('#userDisplay');
    if (userDisplay) {
      userDisplay.textContent = user.name;
    }
  }

  // Load dashboard data
  const shouldEnableRealtime = await loadDashboardData();
  if (shouldEnableRealtime) {
    setupRealTimeUpdates();
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', async () => {
  // Leave all plot groups before disconnecting
  if (joinedPlotIds.length > 0) {
    const { leavePlotGroup } = await import('./api.js');
    for (const plotId of joinedPlotIds) {
      try {
        await leavePlotGroup(plotId);
      } catch (error) {
        console.warn(`Failed to leave plot ${plotId}:`, error);
      }
    }
    joinedPlotIds = [];
  }

  stopSignalRConnection();
  // Charts cleanup disabled (not currently used)
  // destroyAllCharts();
});

// ============================================
// DATA LOADING
// ============================================

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
    const [stats, readings, alerts] = await Promise.all([
      getDashboardStats(),
      getLatestReadings(5),
      getAlerts('pending')
      // Historical data disabled - not currently used
      // getHistoricalData('SENSOR-001', 7)
    ]);

    updateStatCards(stats);
    updateReadingsTable(readings);
    updateAlertsSection(alerts);
    return true;
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    toast('dashboard.load_failed', 'error');
    return false;
  }
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
      <td><strong>${reading.sensorId}</strong></td>
      <td>${reading.plotName}</td>
      <td class="${getTemperatureClass(reading.temperature)}">${formatTemperature(reading.temperature)}</td>
      <td class="${getHumidityClass(reading.humidity)}">${formatPercentage(reading.humidity)}</td>
      <td class="${getSoilMoistureClass(reading.soilMoisture)}">${formatPercentage(reading.soilMoisture)}</td>
      <td title="${formatDate(reading.timestamp)}">${formatRelativeTime(reading.timestamp)}</td>
    </tr>
  `
    )
    .join('');
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
    <div class="alert-item alert-${alert.severity}">
      <div class="alert-header">
        <span class="alert-badge badge-${alert.severity}">
          ${getSeverityIcon(alert.severity)} ${getSeverityLabel(alert.severity)}
        </span>
        <span class="alert-time" title="${formatDate(alert.createdAt)}">
          ${formatRelativeTime(alert.createdAt)}
        </span>
      </div>
      <h4 class="alert-title">${alert.title}</h4>
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

// ============================================
// REAL-TIME UPDATES (SIGNALR)
// ============================================

let joinedPlotIds = []; // Track joined plot groups
let isJoiningPlotGroups = false;
let hasSetupForRealtime = true;

async function setupRealTimeUpdates() {
  const connection = await initSignalRConnection({
    onSensorReading: handleSensorReading,
    onAlert: handleNewAlert,
    onConnectionChange: handleConnectionChange
  });

  // After connection, join all plot groups to receive sensor readings
  if (connection && !connection.isMock) {
    await joinAllPlotGroups();
  }
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
    const { joinPlotGroup } = await import('./api.js');
    const plots = await getPlots();
    const plotIds = (plots || []).map((plot) => plot?.id).filter(Boolean);

    if (plotIds.length > 0) {
      console.warn(`[SignalR] Joining ${plotIds.length} plot groups...`);

      joinedPlotIds = [];
      for (const plotId of plotIds) {
        try {
          await joinPlotGroup(plotId);
          joinedPlotIds.push(plotId);
          console.warn(`[SignalR] ✅ Joined plot group: ${plotId}`);
        } catch (error) {
          console.warn(`[SignalR] Failed to join plot ${plotId}:`, error);
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
  // Update metric cards
  updateMetricCard('temperature', reading.temperature);
  updateMetricCard('humidity', reading.humidity);
  updateMetricCard('soil-moisture', reading.soilMoisture);

  // Chart updates disabled (not currently used)
  // const timeLabel = new Date().toLocaleTimeString('en-US', {
  //   hour: '2-digit',
  //   minute: '2-digit'
  // });
  // addDataPoint('readings-chart', timeLabel, [
  //   reading.temperature,
  //   reading.humidity,
  //   reading.soilMoisture
  // ]);

  // Update readings table (prepend new reading)
  const tbody = $('#readings-tbody');
  if (tbody && tbody.firstChild) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${reading.sensorId}</strong></td>
      <td>-</td>
      <td>${formatTemperature(reading.temperature)}</td>
      <td>${formatPercentage(reading.humidity)}</td>
      <td>${formatPercentage(reading.soilMoisture)}</td>
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

function handleNewAlert(alert) {
  toast('alerts.new', alert.severity === 'critical' ? 'error' : 'warning', { title: alert.title });

  // Reload alerts section
  getAlerts('pending').then(updateAlertsSection);

  // Update alert count
  const alertStat = $('#stat-alerts');
  if (alertStat) {
    const current = parseInt(alertStat.textContent) || 0;
    alertStat.textContent = current + 1;
  }
}

function handleConnectionChange(state) {
  const indicator = $('#connection-status');
  if (indicator) {
    indicator.className = `connection-indicator ${state}`;
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
