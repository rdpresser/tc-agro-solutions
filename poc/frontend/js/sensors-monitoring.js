/**
 * TC Agro Solutions - Sensors Page Entry Point
 */

import { getSensors, initSignalRConnection, stopSignalRConnection } from './api.js';
import { initProtectedPage } from './common.js';
import { toast, t } from './i18n.js';
import {
  getSensorStatusBadgeClass,
  getSensorStatusDisplay,
  normalizeSensorStatus,
  SENSOR_STATUSES
} from './sensor-statuses.js';
import { getSensorTypeDisplay, SENSOR_TYPES } from './sensor-types.js';
import { $, $$, formatPercentage, formatRelativeTime, formatTemperature } from './utils.js';

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
  // Leave all plot groups before disconnecting
  if (window.joinedPlotIds && window.joinedPlotIds.length > 0) {
    const { leavePlotGroup } = await import('./api.js');
    for (const plotId of window.joinedPlotIds) {
      try {
        await leavePlotGroup(plotId);
      } catch (error) {
        console.warn(`Failed to leave plot ${plotId}:`, error);
      }
    }
    window.joinedPlotIds = [];
  }

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
        <span class="sensor-id">${sensor.id}</span>
        <span class="sensor-status ${getSensorStatusBadgeClass(sensor.status)}">
          ${getSensorStatusDisplay(sensor.status)}
        </span>
      </div>
      
      <div class="sensor-plot">📍 ${sensor.plotName}</div>
      
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

window.joinedPlotIds = []; // Track joined plot groups

async function setupRealTimeUpdates() {
  const connection = await initSignalRConnection({
    onSensorReading: (reading) => {
      updateSensorCard(reading.sensorId, reading);
    },
    onSensorStatus: (data) => {
      const card = $(`[data-sensor-id="${data.sensorId}"]`);
      if (card) {
        // Store old status for KPI updates
        const oldStatus = normalizeSensorStatus(card.dataset.status);
        const newStatus = normalizeSensorStatus(data.status);

        // Update card visual state
        const badgeClass = getSensorStatusBadgeClass(newStatus);
        card.className = `sensor-card ${badgeClass}`;
        card.dataset.status = newStatus;

        const statusEl = card.querySelector('.sensor-status');
        if (statusEl) {
          statusEl.className = `sensor-status ${badgeClass}`;
          statusEl.textContent = getSensorStatusDisplay(newStatus);
        }

        // Update KPIs if status changed
        if (oldStatus !== newStatus) {
          updateStatusSummary();
        }
      }
    },
    onConnectionChange: (state) => {
      console.warn(`SignalR connection state: ${state}`);
      // Optional: Add visual indicator for connection state
      const indicator = $('#connection-status');
      if (indicator) {
        indicator.className = `connection-status ${state}`;
      }

      // Rejoin plot groups after reconnection
      if (state === 'connected' && window.joinedPlotIds.length === 0) {
        setTimeout(() => joinAllPlotGroups(connection), 1000);
      }
    }
  });

  // After connection, join all plot groups to receive sensor readings
  if (connection && !connection.isMock) {
    await joinAllPlotGroups(connection);
  }
}

async function joinAllPlotGroups(connection) {
  try {
    // Fetch all plots to join their groups
    const { getPlots, joinPlotGroup } = await import('./api.js');
    const plots = await getPlots();

    if (plots && plots.length > 0) {
      console.warn(`[SignalR] Joining ${plots.length} plot groups...`);

      for (const plot of plots) {
        try {
          await joinPlotGroup(plot.id);
          window.joinedPlotIds.push(plot.id);
          console.warn(`[SignalR] ✅ Joined plot group: ${plot.id}`);
        } catch (error) {
          console.warn(`[SignalR] Failed to join plot ${plot.id}:`, error);
        }
      }

      console.warn(`[SignalR] Successfully joined ${window.joinedPlotIds.length} plot groups`);
    } else {
      console.warn('[SignalR] No plots found to join');
    }
  } catch (error) {
    console.error('[SignalR] Error joining plot groups:', error);
  }
}

function updateSensorCard(sensorId, reading) {
  const card = $(`[data-sensor-id="${sensorId}"]`);
  if (!card) return;

  // Update readings with animation
  const metrics = ['temperature', 'humidity', 'soilMoisture'];

  metrics.forEach((metric) => {
    const el = card.querySelector(`[data-metric="${metric}"]`);
    if (el && reading[metric] !== null) {
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
