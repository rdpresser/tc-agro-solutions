/**
 * TC Agro Solutions - Dashboard Page Entry Point
 */

import { initProtectedPage } from './common.js';
import { getDashboardStats, getLatestReadings, getAlerts, initSignalRConnection } from './api.js';
import { formatDate, $id, showLoading, hideLoading, showToast } from './utils.js';
import { createReadingsChart, createAlertDistributionChart, addDataPoint } from './charts.js';
import { t } from './i18n.js';

// Initialize protected page (auth check, sidebar, user display)
await initProtectedPage();

// ============================================
// LOAD DASHBOARD DATA
// ============================================

async function loadDashboard() {
  showLoading();

  try {
    // Load stats
    const stats = await getDashboardStats();

    // Update stat cards
    if (stats) {
      const propertyValue = $id('stat-properties');
      if (propertyValue) propertyValue.textContent = stats.properties || '0';

      const plotValue = $id('stat-plots');
      if (plotValue) plotValue.textContent = stats.plots || '0';

      const sensorValue = $id('stat-sensors');
      if (sensorValue) sensorValue.textContent = stats.sensors || '0';

      const alertValue = $id('stat-alerts');
      if (alertValue) alertValue.textContent = stats.alerts || '0';
    }

    // Load latest readings
    const readings = await getLatestReadings(5);

    // Update readings table
    const readingsBody = $id('readings-tbody');
    if (readingsBody && Array.isArray(readings)) {
      readingsBody.innerHTML = readings
        .map(
          (r) => `
        <tr>
          <td>${r.sensorId}</td>
          <td>${r.plotName}</td>
          <td><span class="badge badge-temp">${r.temperature?.toFixed(1) || '-'}°C</span></td>
          <td><span class="badge badge-humidity">${r.humidity?.toFixed(0) || '-'}%</span></td>
          <td><span class="badge badge-soil">${r.soilMoisture?.toFixed(0) || '-'}%</span></td>
          <td>${formatDate(r.timestamp, 'short')}</td>
        </tr>
      `
        )
        .join('');
    }

    // Load alerts
    const alerts = await getAlerts('pending');
    const alertsList = $id('pending-alerts');
    if (alertsList && Array.isArray(alerts)) {
      if (alerts.length === 0) {
        alertsList.innerHTML =
          '<p style="padding: 1rem; text-align: center; color: #666;">No pending alerts</p>';
      } else {
        alertsList.innerHTML = alerts
          .slice(0, 5)
          .map(
            (a) => `
          <div class="alert-item alert-${a.severity}">
            <div class="alert-header">
              <strong>${a.title}</strong>
              <span class="alert-badge">${a.severity.toUpperCase()}</span>
            </div>
            <p>${a.message}</p>
            <small>${a.plotName} • ${formatDate(a.createdAt, 'short')}</small>
          </div>
        `
          )
          .join('');
      }
    }

    // Create chart for readings
    const chartData = readings;
    if (chartData && chartData.length > 0) {
      createReadingsChart('readingsChart', chartData);
    }

    // Create alert distribution chart
    const alertDistribution = {
      critical: alerts.filter((a) => a.severity === 'critical').length,
      warning: alerts.filter((a) => a.severity === 'warning').length,
      info: alerts.filter((a) => a.severity === 'info').length
    };
    createAlertDistributionChart('alertDistributionChart', alertDistribution);

    hideLoading();
    showToast(t('dashboard.loaded'), 'success');
  } catch (err) {
    hideLoading();
    showToast(t('dashboard.load_failed'), 'error');
    console.error('Dashboard load error:', err);
  }
}

// Load initial dashboard
await loadDashboard();

// ============================================
// REAL-TIME UPDATES WITH SIGNALR
// ============================================

const connectionStatus = $id('connectionStatus');

await initSignalRConnection({
  onSensorReading: (reading) => {
    // Update readings table
    const readingsBody = $id('readings-tbody');
    if (readingsBody) {
      const newRow = `
        <tr>
          <td>${reading.sensorId}</td>
          <td>-</td>
          <td><span class="badge badge-temp">${reading.temperature?.toFixed(1) || '-'}°C</span></td>
          <td><span class="badge badge-humidity">${reading.humidity?.toFixed(0) || '-'}%</span></td>
          <td><span class="badge badge-soil">${reading.soilMoisture?.toFixed(0) || '-'}%</span></td>
          <td>${formatDate(reading.timestamp, 'short')}</td>
        </tr>
      `;

      const firstRow = readingsBody.querySelector('tr');
      if (firstRow) {
        firstRow.insertAdjacentHTML('beforebegin', newRow);
        // Keep only 5 rows
        while (readingsBody.querySelectorAll('tr').length > 5) {
          readingsBody.querySelector('tr:last-child').remove();
        }
      }
    }

    // Add point to chart
    addDataPoint('readingsChart', reading);
  },

  onAlert: (alert) => {
    showToast(t('alerts.new', { title: alert.title }), 'warning');
    loadDashboard(); // Reload dashboard to reflect new alert
  },

  onConnectionChange: (status) => {
    if (connectionStatus) {
      connectionStatus.textContent = status;
      connectionStatus.className = `status-${status}`;
    }
  }
});
