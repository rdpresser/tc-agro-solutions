/**
 * TC Agro Solutions - Sensors Page Entry Point
 */

import {
  getSensors,
  initSignalRConnection,
  stopSignalRConnection,
  joinOwnerGroup,
  leaveOwnerGroup
} from './api.js';
import { initProtectedPage } from './common.js';
import { toast, t } from './i18n.js';
import { createFallbackPoller } from './realtime-fallback.js';
import {
  getSensorStatusBadgeClass,
  getSensorStatusDisplay,
  normalizeSensorStatus,
  SENSOR_STATUSES
} from './sensor-statuses.js';
import { getSensorTypeDisplay, SENSOR_TYPES } from './sensor-types.js';
import {
  $,
  $$,
  formatPercentage,
  formatRelativeTime,
  formatTemperature,
  getUser
} from './utils.js';

// ============================================
// PAGE INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth and setup page (must be inside DOMContentLoaded for sidebar elements)
  if (!initProtectedPage()) {
    return;
  }

  loadStatusFilterOptions();
  loadTypeFilterOptions();
  await loadSensors();
  setupRealTimeUpdates();
  setupEventListeners();
});

// Cleanup on page unload
window.addEventListener('beforeunload', async () => {
  if (ownerGroupJoined) {
    try {
      await leaveOwnerGroup(currentOwnerScopeId);
    } catch (error) {
      console.warn(`Failed to leave owner group ${currentOwnerScopeId}:`, error);
    }
  }

  stopFallbackPollingSilently();

  stopSignalRConnection();
});

// ============================================
// DATA LOADING
// ============================================

function loadStatusFilterOptions() {
  const select = $('#statusFilter');
  if (!select) return;

  const currentValue = select.value;

  select.innerHTML = [`<option value="">All Status</option>`]
    .concat(
      SENSOR_STATUSES.map(
        (status) => `<option value="${status}">${getSensorStatusDisplay(status)}</option>`
      )
    )
    .join('');

  if (currentValue) {
    select.value = normalizeSensorStatus(currentValue);
  }
}

function loadTypeFilterOptions() {
  const select = $('#typeFilter');
  if (!select) return;

  const currentValue = select.value;

  select.innerHTML = [`<option value="">All Types</option>`]
    .concat(
      SENSOR_TYPES.map((type) => `<option value="${type}">${getSensorTypeDisplay(type)}</option>`)
    )
    .join('');

  if (currentValue) {
    select.value = currentValue;
  }
}

async function loadSensors() {
  const grid = $('#sensors-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading">Loading sensors...</div>';

  try {
    const sensors = await getSensors();
    renderSensorsGrid(sensors);
    updateStatusSummary(sensors);
  } catch (error) {
    console.error('Error loading sensors:', error);
    grid.innerHTML = `<div class="error">${t('sensors.load_failed')}</div>`;
    toast('sensors.load_failed', 'error');
  }
}

function renderSensorsGrid(sensors) {
  const grid = $('#sensors-grid');
  if (!grid) return;

  if (!sensors.length) {
    grid.innerHTML = '<div class="empty">No sensors registered</div>';
    return;
  }

  grid.innerHTML = sensors
    .map(
      (sensor) => `
    <div class="sensor-card ${getSensorStatusBadgeClass(sensor.status)}" data-sensor-id="${sensor.id}" data-status="${normalizeSensorStatus(sensor.status)}">
      <div class="sensor-header">
        <span class="sensor-id">${getSensorDisplayName(sensor)}</span>
        <span class="sensor-status ${getSensorStatusBadgeClass(sensor.status)}">
          ${getSensorStatusDisplay(sensor.status)}
        </span>
      </div>
      
      <div class="sensor-plot">📍 ${formatSensorLocation(sensor)}</div>
      
      <div class="sensor-readings">
        <div class="reading">
          <span class="reading-label">🌡️ Temp</span>
          <span class="reading-value" data-metric="temperature">
            ${formatTemperature(sensor.temperature)}
          </span>
        </div>
        <div class="reading">
          <span class="reading-label">💧 Humidity</span>
          <span class="reading-value" data-metric="humidity">
            ${formatPercentage(sensor.humidity)}
          </span>
        </div>
        <div class="reading">
          <span class="reading-label">🌿 Soil</span>
          <span class="reading-value" data-metric="soilMoisture">
            ${formatPercentage(sensor.soilMoisture)}
          </span>
        </div>
      </div>
      
      <div class="sensor-footer">
        <span class="battery ${getBatteryClass(sensor.battery)}">
          🔋 ${formatPercentage(sensor.battery)}
        </span>
        <span class="last-update" title="${sensor.lastReading}">
          ${formatRelativeTime(sensor.lastReading)}
        </span>
      </div>
    </div>
  `
    )
    .join('');
}

function getSensorDisplayName(sensor) {
  return sensor.sensorLabel || sensor.sensorId || sensor.id || '-';
}

function formatSensorLocation(sensor) {
  const plotName = sensor.plotName || '-';
  const propertyName = sensor.propertyName || '';
  return propertyName ? `${plotName} - ${propertyName}` : plotName;
}

function getBatteryClass(level) {
  if (level < 20) return 'critical';
  if (level < 50) return 'warning';
  return 'good';
}

/**
 * Update status summary KPI cards based on sensor array or rendered cards
 * @param {Array} [sensors] - Array of sensor objects. If not provided, counts from rendered cards
 */
function updateStatusSummary(sensors = null) {
  let counts;

  if (sensors) {
    // Count from provided array
    counts = {
      total: sensors.length,
      Active: 0,
      Inactive: 0,
      Maintenance: 0,
      Faulty: 0
    };

    sensors.forEach((sensor) => {
      const normalized = normalizeSensorStatus(sensor.status);
      if (counts[normalized] !== undefined) {
        counts[normalized]++;
      }
    });
  } else {
    // Count from rendered cards in DOM
    const cards = $$('.sensor-card');
    counts = {
      total: cards.length,
      Active: 0,
      Inactive: 0,
      Maintenance: 0,
      Faulty: 0
    };

    cards.forEach((card) => {
      const normalized = normalizeSensorStatus(card.dataset.status);
      if (counts[normalized] !== undefined) {
        counts[normalized]++;
      }
    });
  }

  // Update KPI elements
  const totalEl = $('#stat-total-sensors');
  if (totalEl) totalEl.textContent = counts.total;

  const activeEl = $('#stat-active-sensors');
  if (activeEl) activeEl.textContent = counts.Active;

  const inactiveEl = $('#stat-inactive-sensors');
  if (inactiveEl) inactiveEl.textContent = counts.Inactive;

  const maintenanceEl = $('#stat-maintenance-sensors');
  if (maintenanceEl) maintenanceEl.textContent = counts.Maintenance;

  const faultyEl = $('#stat-faulty-sensors');
  if (faultyEl) faultyEl.textContent = counts.Faulty;
}

// ============================================
// REAL-TIME UPDATES
// ============================================

const SENSORS_REALTIME_CONTEXT = {
  page: 'sensors-monitoring',
  hub: '/dashboard/sensorshub',
  events: ['sensorReading', 'sensorStatusChanged'],
  fallbackRoutes: ['/api/readings/latest', '/api/sensors (metadata cache)']
};

let realtimeConnectionState = 'disconnected';
let ownerGroupJoined = false;
let currentOwnerScopeId = null;
const fallbackPoller = createFallbackPoller({
  refresh: loadSensors,
  intervalMs: 15000,
  context: 'SensorsRealtime',
  connection: SENSORS_REALTIME_CONTEXT,
  onError: (error) => {
    console.warn('[SensorsRealtime] HTTP fallback refresh failed.', {
      ...SENSORS_REALTIME_CONTEXT,
      error
    });
  }
});

async function setupRealTimeUpdates() {
  updateRealtimeBadges('reconnecting');

  const connection = await initSignalRConnection({
    onSensorReading: (reading) => {
      const normalized = normalizeRealtimeReading(reading);
      updateSensorCard(normalized.sensorId, normalized);
    },
    onSensorStatus: (data) => {
      const card = $(`[data-sensor-id="${data.sensorId}"]`);
      if (card) {
        const oldStatus = normalizeSensorStatus(card.dataset.status);
        const newStatus = normalizeSensorStatus(data.status);

        const badgeClass = getSensorStatusBadgeClass(newStatus);
        card.className = `sensor-card ${badgeClass}`;
        card.dataset.status = newStatus;

        const statusEl = card.querySelector('.sensor-status');
        if (statusEl) {
          statusEl.className = `sensor-status ${badgeClass}`;
          statusEl.textContent = getSensorStatusDisplay(newStatus);
        }

        if (oldStatus !== newStatus) {
          updateStatusSummary();
        }
      }
    },
    onConnectionChange: (state) => {
      console.warn(`SignalR connection state: ${state}`);
      realtimeConnectionState = state;

      if (state === 'connected') {
        if (fallbackPoller.isRunning()) {
          stopFallbackPolling();
        }
      } else if (state === 'reconnecting' || state === 'disconnected') {
        console.warn(
          '[SensorsRealtime] SignalR stream degraded. HTTP fallback remains active until recovery.',
          {
            state,
            hub: SENSORS_REALTIME_CONTEXT.hub,
            signalrEvents: SENSORS_REALTIME_CONTEXT.events,
            fallbackRoutes: SENSORS_REALTIME_CONTEXT.fallbackRoutes
          }
        );
        fallbackPoller.start(state);
      }

      updateRealtimeBadges(state);

      if (state === 'connected') {
        setTimeout(() => ensureOwnerGroupSubscription(), 500);
      }
    }
  });

  if (connection && !connection.isMock) {
    await ensureOwnerGroupSubscription();
  } else {
    fallbackPoller.start('initial-connect-failed');
    realtimeConnectionState = 'disconnected';
    updateRealtimeBadges('disconnected');
  }
}

function isCurrentUserAdmin() {
  const currentUser = getUser();
  if (!currentUser) {
    return false;
  }

  const roles = Array.isArray(currentUser.role)
    ? currentUser.role
    : [currentUser.role].filter(Boolean);

  return roles.some((role) => String(role).trim().toLowerCase() === 'admin');
}

function getOwnerScopeIdForMonitoring() {
  if (!isCurrentUserAdmin()) {
    return null;
  }

  const ownerId = new URLSearchParams(window.location.search).get('ownerId');
  return ownerId || null;
}

async function ensureOwnerGroupSubscription() {
  currentOwnerScopeId = getOwnerScopeIdForMonitoring();

  if (isCurrentUserAdmin() && !currentOwnerScopeId) {
    ownerGroupJoined = false;
    console.warn(
      '[SensorsRealtime] Admin user without ownerId query param. Skipping owner-group subscription.'
    );
    fallbackPoller.start('admin-owner-scope-required');
    return;
  }

  ownerGroupJoined = await joinOwnerGroup(currentOwnerScopeId);

  if (!ownerGroupJoined) {
    console.warn('[SensorsRealtime] Failed to join owner group.', {
      ownerId: currentOwnerScopeId
    });
    fallbackPoller.start('owner-join-failed');
  }
}

function getConnectionBadgeElement() {
  return $('#connection-status') || $('#signalrStatus');
}

function updateRealtimeBadges(state = realtimeConnectionState) {
  const indicator = getConnectionBadgeElement();
  const transportIndicator = $('#transport-mode-status');
  if (!indicator) return;

  indicator.className =
    state === 'connected'
      ? 'badge badge-success'
      : state === 'reconnecting'
        ? 'badge badge-warning'
        : 'badge badge-danger';

  indicator.textContent =
    state === 'connected'
      ? '🟢 Live Updates Active'
      : state === 'reconnecting'
        ? '🟡 Reconnecting'
        : '🔶 HTTP Fallback Active';

  if (transportIndicator) {
    const usingSignalR = state === 'connected';
    transportIndicator.className = usingSignalR ? 'badge badge-info' : 'badge badge-warning';
    transportIndicator.textContent = usingSignalR ? 'SignalR' : 'HTTP Fallback';
    transportIndicator.title = usingSignalR
      ? 'Realtime transport: SignalR stream.'
      : 'Realtime transport: HTTP polling fallback (15s interval).';
  }
}

function stopFallbackPolling() {
  fallbackPoller.stop('signalr-restored');
}

function stopFallbackPollingSilently() {
  fallbackPoller.stop('page-unload', { silent: true });
}

function normalizeRealtimeReading(reading) {
  return {
    sensorId: reading.sensorId || reading.SensorId,
    sensorLabel:
      reading.sensorLabel || reading.SensorLabel || reading.label || reading.Label || null,
    plotId: reading.plotId || reading.PlotId,
    plotName: reading.plotName || reading.PlotName || '-',
    propertyName: reading.propertyName || reading.PropertyName || '-',
    temperature: reading.temperature ?? reading.Temperature ?? null,
    humidity: reading.humidity ?? reading.Humidity ?? null,
    soilMoisture: reading.soilMoisture ?? reading.SoilMoisture ?? null,
    rainfall: reading.rainfall ?? reading.Rainfall ?? null,
    batteryLevel: reading.batteryLevel ?? reading.BatteryLevel ?? null,
    timestamp: reading.timestamp || reading.Timestamp || new Date().toISOString()
  };
}

function updateSensorCard(sensorId, reading) {
  const card = $(`[data-sensor-id="${sensorId}"]`);
  if (!card) return;

  const headerEl = card.querySelector('.sensor-id');
  if (headerEl && reading.sensorLabel) {
    headerEl.textContent = reading.sensorLabel;
  }

  const plotEl = card.querySelector('.sensor-plot');
  if (plotEl) {
    plotEl.textContent = `📍 ${formatSensorLocation(reading)}`;
  }

  // Update readings with animation
  const metrics = ['temperature', 'humidity', 'soilMoisture'];

  metrics.forEach((metric) => {
    const el = card.querySelector(`[data-metric="${metric}"]`);
    if (el && reading[metric] !== null && reading[metric] !== undefined) {
      el.classList.add('pulse');

      const value = reading[metric];
      if (metric === 'temperature') {
        el.textContent = formatTemperature(value);
      } else {
        el.textContent = formatPercentage(value);
      }

      setTimeout(() => el.classList.remove('pulse'), 500);
    }
  });

  // Update last update time
  const timeEl = card.querySelector('.last-update');
  if (timeEl) {
    timeEl.textContent = 'now';
    timeEl.title = new Date().toISOString();
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Refresh button
  const refreshBtn = $('#refresh-sensors');
  refreshBtn?.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    refreshBtn.textContent = '⟳ Updating...';

    await loadSensors();

    refreshBtn.disabled = false;
    refreshBtn.textContent = '⟳ Refresh';
    toast('sensors.updated', 'success');
  });

  // Status filter
  const statusFilter = $('#statusFilter');
  statusFilter?.addEventListener('change', () => {
    const selectedStatus = normalizeSensorStatus(statusFilter.value);
    const cards = $$('.sensor-card');

    cards.forEach((card) => {
      const cardStatus = normalizeSensorStatus(card.dataset.status);
      if (!selectedStatus || selectedStatus === cardStatus) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  });

  const filterBtns = $$('[data-filter-status]');
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      // Update active state
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      // Filter cards
      const status = btn.dataset.filterStatus;
      const cards = $$('.sensor-card');

      cards.forEach((card) => {
        if (status === 'all' || card.classList.contains(status)) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

// Export for debugging
if (import.meta.env.DEV) {
  window.sensorsDebug = { loadSensors, updateSensorCard };
}
