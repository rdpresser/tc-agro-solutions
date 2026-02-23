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
import { $, $$, formatRelativeTime } from './utils.js';

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
window.addEventListener('beforeunload', () => {
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
            ${sensor.temperature !== null ? `${sensor.temperature.toFixed(1)}°C` : '--'}
          </span>
        </div>
        <div class="reading">
          <span class="reading-label">💧 Humidity</span>
          <span class="reading-value" data-metric="humidity">
            ${sensor.humidity !== null ? `${sensor.humidity.toFixed(0)}%` : '--'}
          </span>
        </div>
        <div class="reading">
          <span class="reading-label">🌿 Soil</span>
          <span class="reading-value" data-metric="soilMoisture">
            ${sensor.soilMoisture !== null ? `${sensor.soilMoisture.toFixed(0)}%` : '--'}
          </span>
        </div>
      </div>
      
      <div class="sensor-footer">
        <span class="battery ${getBatteryClass(sensor.battery)}">
          🔋 ${sensor.battery}%
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

// ============================================
// REAL-TIME UPDATES
// ============================================

function setupRealTimeUpdates() {
  initSignalRConnection({
    onSensorReading: (reading) => {
      updateSensorCard(reading.sensorId, reading);
    },
    onSensorStatus: (data) => {
      const card = $(`[data-sensor-id="${data.sensorId}"]`);
      if (card) {
        const normalizedStatus = normalizeSensorStatus(data.status);
        const badgeClass = getSensorStatusBadgeClass(normalizedStatus);
        card.className = `sensor-card ${badgeClass}`;
        card.dataset.status = normalizedStatus;
        const statusEl = card.querySelector('.sensor-status');
        if (statusEl) {
          statusEl.className = `sensor-status ${badgeClass}`;
          statusEl.textContent = getSensorStatusDisplay(normalizedStatus);
        }
      }
    }
  });
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
        el.textContent = `${value.toFixed(1)}°C`;
      } else {
        el.textContent = `${value.toFixed(0)}%`;
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
