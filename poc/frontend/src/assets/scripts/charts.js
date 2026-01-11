/**
 * TC Agro Solutions - Charts Module
 * Chart.js integration and utilities
 */

import Chart from 'chart.js/auto';

const charts = {}; // Store references to active charts for cleanup

// Default color scheme
export const COLORS = {
  primary: '#2d5016',
  primaryLight: '#4a7c2c',
  secondary: '#6b4423',
  background: '#f5f5f0',
  surface: '#ffffff',
  text: '#333333',
  textMuted: '#666666',
  danger: '#dc3545',
  warning: '#ff9800',
  success: '#4caf50',
  info: '#2196f3'
};

/**
 * Create a line chart for sensor readings
 * @param {string} canvasId - Canvas element ID
 * @param {Array} data - Array of readings with timestamp and values
 * @returns {Chart} Chart.js instance
 */
export function createReadingsChart(canvasId, data = []) {
  const ctx = document.getElementById(canvasId);
  if (!ctx || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  const labels = data.map((d) => {
    const date = new Date(d.timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  });

  const temps = data.map((d) => d.temperature);
  const humidities = data.map((d) => d.humidity);
  const soils = data.map((d) => d.soilMoisture);

  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Temperature (°C)',
          data: temps,
          borderColor: COLORS.danger,
          backgroundColor: 'rgba(220, 53, 69, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: COLORS.danger,
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        },
        {
          label: 'Humidity (%)',
          data: humidities,
          borderColor: COLORS.info,
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: COLORS.info,
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        },
        {
          label: 'Soil Moisture (%)',
          data: soils,
          borderColor: COLORS.primary,
          backgroundColor: 'rgba(45, 80, 22, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: COLORS.primary,
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: COLORS.text,
            font: { size: 12 },
            padding: 15
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { color: COLORS.textMuted }
        },
        x: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { color: COLORS.textMuted }
        }
      }
    }
  });

  charts[canvasId] = chart;
  return chart;
}

/**
 * Create a doughnut chart for alert distribution
 * @param {string} canvasId - Canvas element ID
 * @param {Object} data - Alert counts by severity
 * @returns {Chart} Chart.js instance
 */
export function createAlertDistributionChart(canvasId, data = {}) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const critical = data.critical || 0;
  const warning = data.warning || 0;
  const info = data.info || 0;

  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Critical', 'Warning', 'Info'],
      datasets: [
        {
          data: [critical, warning, info],
          backgroundColor: [COLORS.danger, COLORS.warning, COLORS.info],
          borderColor: COLORS.surface,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: COLORS.text,
            font: { size: 12 },
            padding: 15
          }
        }
      }
    }
  });

  charts[canvasId] = chart;
  return chart;
}

/**
 * Create a bar chart for sensor status distribution
 * @param {string} canvasId - Canvas element ID
 * @param {Object} data - Sensor counts by status
 * @returns {Chart} Chart.js instance
 */
export function createSensorStatusChart(canvasId, data = {}) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const online = data.online || 0;
  const warning = data.warning || 0;
  const offline = data.offline || 0;

  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Online', 'Warning', 'Offline'],
      datasets: [
        {
          label: 'Sensors',
          data: [online, warning, offline],
          backgroundColor: [COLORS.success, COLORS.warning, COLORS.danger],
          borderColor: [COLORS.success, COLORS.warning, COLORS.danger],
          borderWidth: 1
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { color: COLORS.textMuted },
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
        y: {
          ticks: { color: COLORS.textMuted },
          grid: { display: false }
        }
      }
    }
  });

  charts[canvasId] = chart;
  return chart;
}

/**
 * Create a simple gauge chart
 * @param {string} canvasId - Canvas element ID
 * @param {number} value - Current value (0-100)
 * @param {string} label - Gauge label
 * @returns {Chart} Chart.js instance
 */
export function createGaugeChart(canvasId, value = 0, label = 'Usage') {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [
        {
          data: [value, 100 - value],
          backgroundColor: [COLORS.success, 'rgba(0,0,0,0.1)'],
          borderColor: COLORS.surface,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      }
    }
  });

  charts[canvasId] = chart;
  return chart;
}

/**
 * Create property overview chart
 * @param {string} canvasId - Canvas element ID
 * @param {Object} data - Property metrics
 * @returns {Chart} Chart.js instance
 */
export function createPropertyOverviewChart(canvasId, data = {}) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const chart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Soil Health', 'Water Level', 'Temperature', 'Air Quality', 'Nutrients', 'Growth'],
      datasets: [
        {
          label: 'Metrics',
          data: [
            data.soilHealth || 75,
            data.waterLevel || 65,
            data.temperature || 70,
            data.airQuality || 80,
            data.nutrients || 60,
            data.growth || 85
          ],
          borderColor: COLORS.primary,
          backgroundColor: 'rgba(45, 80, 22, 0.2)',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: COLORS.primary,
          pointBorderColor: COLORS.surface,
          pointBorderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { color: COLORS.textMuted }
        }
      },
      plugins: {
        legend: {
          labels: { color: COLORS.text }
        }
      }
    }
  });

  charts[canvasId] = chart;
  return chart;
}

/**
 * Update an existing chart with new data
 * @param {string} canvasId - Canvas element ID
 * @param {Array} newData - New data array
 */
export function updateChartData(canvasId, newData = []) {
  const chart = charts[canvasId];
  if (!chart || !Array.isArray(newData)) return;

  const labels = newData.map((d) => {
    const date = new Date(d.timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  });

  chart.data.labels = labels;

  // Update datasets
  if (chart.data.datasets[0]) {
    chart.data.datasets[0].data = newData.map((d) => d.temperature);
  }
  if (chart.data.datasets[1]) {
    chart.data.datasets[1].data = newData.map((d) => d.humidity);
  }
  if (chart.data.datasets[2]) {
    chart.data.datasets[2].data = newData.map((d) => d.soilMoisture);
  }

  chart.update();
}

/**
 * Add a single data point to a chart
 * @param {string} canvasId - Canvas element ID
 * @param {Object} dataPoint - New data point
 * @param {number} maxPoints - Maximum points to keep (default: 20)
 */
export function addDataPoint(canvasId, dataPoint = {}, maxPoints = 20) {
  const chart = charts[canvasId];
  if (!chart) return;

  const label = new Date(dataPoint.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  chart.data.labels.push(label);
  if (chart.data.datasets[0]) chart.data.datasets[0].data.push(dataPoint.temperature);
  if (chart.data.datasets[1]) chart.data.datasets[1].data.push(dataPoint.humidity);
  if (chart.data.datasets[2]) chart.data.datasets[2].data.push(dataPoint.soilMoisture);

  // Keep only recent points
  if (chart.data.labels.length > maxPoints) {
    chart.data.labels.shift();
    chart.data.datasets.forEach((ds) => ds.data.shift());
  }

  chart.update();
}

/**
 * Destroy a specific chart
 * @param {string} canvasId - Canvas element ID
 */
export function destroyChart(canvasId) {
  const chart = charts[canvasId];
  if (chart) {
    chart.destroy();
    delete charts[canvasId];
  }
}

/**
 * Destroy all active charts
 */
export function destroyAllCharts() {
  Object.keys(charts).forEach((canvasId) => {
    charts[canvasId].destroy();
  });
  for (const key in charts) {
    delete charts[key];
  }
}

/**
 * Get a chart by ID
 * @param {string} canvasId - Canvas element ID
 * @returns {Chart|null} Chart.js instance or null if not found
 */
export function getChart(canvasId) {
  return charts[canvasId] || null;
}

/**
 * Resize all active charts (useful after window resize)
 */
export function resizeAllCharts() {
  Object.values(charts).forEach((chart) => {
    if (chart) chart.resize();
  });
}
