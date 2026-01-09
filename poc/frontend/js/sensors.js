/**
 * TC Agro Solutions - Sensors Page Entry Point
 */

import { initProtectedPage } from './common.js';
import { getSensors, initSignalRConnection, stopSignalRConnection } from './api.js';
import { $, $$, showToast, formatRelativeTime } from './utils.js';

// ============================================
// PAGE INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth and setup page (must be inside DOMContentLoaded for sidebar elements)
  if (!initProtectedPage()) {
    return;
  }
  
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

async function loadSensors() {
  const grid = $('#sensors-grid');
  if (!grid) return;
  
  grid.innerHTML = '<div class="loading">Loading sensors...</div>';
  
  try {
    const sensors = await getSensors();
    renderSensorsGrid(sensors);
  } catch (error) {
    console.error('Error loading sensors:', error);
    grid.innerHTML = '<div class="error">Error loading sensors</div>';
    showToast('Error loading sensors', 'error');
  }
}

function renderSensorsGrid(sensors) {
  const grid = $('#sensors-grid');
  if (!grid) return;
  
  if (!sensors.length) {
    grid.innerHTML = '<div class="empty">Nenhum sensor cadastrado</div>';
    return;
  }
  
  grid.innerHTML = sensors.map(sensor => `
    <div class="sensor-card ${sensor.status}" data-sensor-id="${sensor.id}">
      <div class="sensor-header">
        <span class="sensor-id">${sensor.id}</span>
        <span class="sensor-status ${sensor.status}">
          ${getStatusIcon(sensor.status)}
        </span>
      </div>
      
      <div class="sensor-plot">📍 ${sensor.plotName}</div>
      
      <div class="sensor-readings">
        <div class="reading">
          <span class="reading-label">🌡️ Temp</span>
          <span class="reading-value" data-metric="temperature">
            ${sensor.temperature != null ? sensor.temperature.toFixed(1) + '°C' : '--'}
          </span>
        </div>
        <div class="reading">
          <span class="reading-label">💧 Umid</span>
          <span class="reading-value" data-metric="humidity">
            ${sensor.humidity != null ? sensor.humidity.toFixed(0) + '%' : '--'}
          </span>
        </div>
        <div class="reading">
          <span class="reading-label">🌿 Solo</span>
          <span class="reading-value" data-metric="soilMoisture">
            ${sensor.soilMoisture != null ? sensor.soilMoisture.toFixed(0) + '%' : '--'}
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
  `).join('');
}

// ============================================
// HELPERS
// ============================================

function getStatusIcon(status) {
  const icons = {
    online: '🟢 Online',
    warning: '🟡 Warning',
    offline: '🔴 Offline'
  };
  return icons[status] || status;
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
        card.className = `sensor-card ${data.status}`;
        const statusEl = card.querySelector('.sensor-status');
        if (statusEl) {
          statusEl.className = `sensor-status ${data.status}`;
          statusEl.textContent = getStatusIcon(data.status);
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
  
  metrics.forEach(metric => {
    const el = card.querySelector(`[data-metric="${metric}"]`);
    if (el && reading[metric] != null) {
      el.classList.add('pulse');
      
      let value = reading[metric];
      if (metric === 'temperature') {
        el.textContent = value.toFixed(1) + '°C';
      } else {
        el.textContent = value.toFixed(0) + '%';
      }
      
      setTimeout(() => el.classList.remove('pulse'), 500);
    }
  });
  
  // Update last update time
  const timeEl = card.querySelector('.last-update');
  if (timeEl) {
    timeEl.textContent = 'agora';
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
    showToast('Sensors updated', 'success');
  });
  
  // Status filter
  const filterBtns = $$('[data-filter-status]');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active state
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Filter cards
      const status = btn.dataset.filterStatus;
      const cards = $$('.sensor-card');
      
      cards.forEach(card => {
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
