/**
 * TC Agro Solutions - Sensors Page Entry Point
 */

import { initProtectedPage } from './common.js';
import { getSensors, initSignalRConnection } from './api.js';
import { $id, showToast, showLoading, hideLoading, formatDate } from './utils.js';
import { t } from './i18n.js';

// Initialize protected page
await initProtectedPage();

// ============================================
// LOAD SENSORS
// ============================================

async function loadSensors() {
  showLoading();

  try {
    const sensors = await getSensors();

    // Render sensors grid
    const grid = $id('sensorGrid');
    if (grid && Array.isArray(sensors)) {
      grid.innerHTML = sensors
        .map(
          (s) => `
        <div class="sensor-card sensor-${s.status}">
          <div class="sensor-header">
            <h4>${s.id}</h4>
            <span class="sensor-status-badge badge-${s.status}">${s.status.toUpperCase()}</span>
          </div>
          
          <div class="sensor-info">
            <p><strong>Plot:</strong> ${s.plotName}</p>
            <p><strong>Battery:</strong> <span class="battery-${s.battery > 50 ? 'good' : s.battery > 20 ? 'warning' : 'critical'}">${s.battery}%</span></p>
            <p><strong>Last Reading:</strong> ${formatDate(s.lastReading, 'short')}</p>
          </div>

          <div class="sensor-readings">
            <div class="reading-item">
              <div class="reading-label">🌡️ Temperature</div>
              <div class="reading-value">${s.temperature !== null ? s.temperature.toFixed(1) + '°C' : '-'}</div>
            </div>
            <div class="reading-item">
              <div class="reading-label">💧 Humidity</div>
              <div class="reading-value">${s.humidity !== null ? s.humidity.toFixed(0) + '%' : '-'}</div>
            </div>
            <div class="reading-item">
              <div class="reading-label">🌱 Soil Moisture</div>
              <div class="reading-value">${s.soilMoisture !== null ? s.soilMoisture.toFixed(0) + '%' : '-'}</div>
            </div>
          </div>
        </div>
      `
        )
        .join('');
    }

    hideLoading();
  } catch (err) {
    hideLoading();
    showToast(t('sensors.load_failed'), 'error');
  }
}

// Load sensors on page load
await loadSensors();

// ============================================
// STATUS FILTER
// ============================================

const filterButtons = document.querySelectorAll('[data-filter]');
filterButtons.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    filterButtons.forEach((b) => b.classList.remove('active'));
    e.target.classList.add('active');

    const filter = e.target.dataset.filter;
    const cards = document.querySelectorAll('.sensor-card');

    cards.forEach((card) => {
      if (filter === 'all' || card.className.includes(`sensor-${filter}`)) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  });
});

// ============================================
// REAL-TIME UPDATES
// ============================================

await initSignalRConnection({
  onSensorReading: (reading) => {
    const card = document.querySelector(`[data-sensor-id="${reading.sensorId}"]`);
    if (!card) {
      // Find by ID substring
      const cards = document.querySelectorAll('.sensor-card');
      const matchCard = Array.from(cards).find((c) => c.textContent.includes(reading.sensorId));

      if (matchCard) {
        // Update reading values with pulse animation
        const readings = matchCard.querySelectorAll('.reading-value');
        if (readings.length >= 3) {
          readings[0].textContent = reading.temperature?.toFixed(1) + '°C';
          readings[1].textContent = reading.humidity?.toFixed(0) + '%';
          readings[2].textContent = reading.soilMoisture?.toFixed(0) + '%';

          // Add pulse animation
          matchCard.classList.add('pulse');
          setTimeout(() => matchCard.classList.remove('pulse'), 500);
        }
      }
      return;
    }

    const readings = card.querySelectorAll('.reading-value');
    if (readings.length >= 3) {
      readings[0].textContent = reading.temperature?.toFixed(1) + '°C';
      readings[1].textContent = reading.humidity?.toFixed(0) + '%';
      readings[2].textContent = reading.soilMoisture?.toFixed(0) + '%';

      card.classList.add('pulse');
      setTimeout(() => card.classList.remove('pulse'), 500);
    }
  },

  onSensorStatus: (status) => {
    showToast(t('sensors.updated'), 'info');
    loadSensors();
  }
});

// Refresh button
const refreshBtn = $id('refreshSensors');
if (refreshBtn) {
  refreshBtn.addEventListener('click', () => {
    loadSensors();
  });
}
