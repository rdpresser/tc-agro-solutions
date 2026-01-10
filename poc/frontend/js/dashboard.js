/**
 * TC Agro Solutions - Dashboard Page Entry Point
 */

import {
  getDashboardStats,
  getLatestReadings,
  getAlerts,
  initSignalRConnection,
  stopSignalRConnection
} from './api.js';
import { initProtectedPage } from './common.js';
import { toast, t } from './i18n.js';
import { $, formatDate, formatRelativeTime, debounce } from './utils.js';

// ============================================
// PAGE INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize protected page (sidebar, logout, auth check)
  if (!initProtectedPage()) {
    // Redirect to login handled by initProtectedPage
    return;
  }

  // Load dashboard data
  await loadDashboardData();
  setupRealTimeUpdates();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopSignalRConnection();
  // Charts cleanup disabled (not currently used)
  // destroyAllCharts();
});

// ============================================
// DATA LOADING
// ============================================

async function loadDashboardData() {
  try {
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
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    toast('dashboard.load_failed', 'error');
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

  tbody.innerHTML = readings
    .map(
      (reading) => `
    <tr>
      <td><strong>${reading.sensorId}</strong></td>
      <td>${reading.plotName}</td>
      <td class="${getTemperatureClass(reading.temperature)}">${reading.temperature?.toFixed(1) ?? '-'}°C</td>
      <td class="${getHumidityClass(reading.humidity)}">${reading.humidity?.toFixed(0) ?? '-'}%</td>
      <td class="${getSoilMoistureClass(reading.soilMoisture)}">${reading.soilMoisture?.toFixed(0) ?? '-'}%</td>
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

function setupRealTimeUpdates() {
  initSignalRConnection({
    onSensorReading: handleSensorReading,
    onAlert: handleNewAlert,
    onConnectionChange: handleConnectionChange
  });
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
      <td>${reading.temperature?.toFixed(1)}°C</td>
      <td>${reading.humidity?.toFixed(0)}%</td>
      <td>${reading.soilMoisture?.toFixed(0)}%</td>
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
}

function updateMetricCard(metric, value) {
  const el = $(`#metric-${metric}`);
  if (el && value !== null) {
    el.textContent = value.toFixed(1);

    // Add pulse animation
    el.classList.add('pulse');
    setTimeout(() => el.classList.remove('pulse'), 500);
  }
}

// ============================================
// INITIALIZATION
// ============================================

// Initialize protected page (sidebar, logout, auth check)
if (!initProtectedPage()) {
  // Redirect to login handled by initProtectedPage
} else {
  // Load dashboard data and setup real-time updates
  loadDashboardData();
  setupRealTimeUpdates();
}

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
