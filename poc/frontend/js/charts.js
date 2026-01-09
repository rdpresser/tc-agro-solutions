/**
 * TC Agro Solutions - Charts Module
 * Chart.js integration for dashboard visualizations
 */

import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Register Chart.js components (tree-shaking friendly)
Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// ============================================
// CHART CONFIGURATION DEFAULTS
// ============================================

const COLORS = {
  primary: '#2D5016',
  primaryLight: '#4A7C2C',
  secondary: '#6B4423',
  temperature: '#E74C3C',
  humidity: '#3498DB',
  soilMoisture: '#27AE60',
  rainfall: '#9B59B6',
  warning: '#F39C12',
  critical: '#E74C3C',
  info: '#3498DB',
  gridLines: 'rgba(0, 0, 0, 0.05)',
  textMuted: '#666666'
};

const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        padding: 20,
        usePointStyle: true,
        font: { size: 12 }
      }
    },
    tooltip: {
      backgroundColor: 'rgba(45, 80, 22, 0.95)',
      titleColor: '#fff',
      bodyColor: '#fff',
      borderColor: COLORS.primary,
      borderWidth: 1,
      cornerRadius: 8,
      padding: 12
    }
  }
};

// Store chart instances for cleanup
const chartInstances = new Map();

// ============================================
// CHART CREATION FUNCTIONS
// ============================================

/**
 * Creates a 7-day sensor readings line chart
 * @param {string} canvasId - Canvas element ID
 * @param {Array} data - Array of readings with timestamp, temperature, humidity, soilMoisture
 */
export function createReadingsChart(canvasId, data = []) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  
  // Destroy existing chart if any
  destroyChart(canvasId);
  
  // Process data for chart
  const labels = data.map(d => {
    const date = new Date(d.timestamp);
    return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
  });
  
  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.length ? labels : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [
        {
          label: 'Temperatura (°C)',
          data: data.length ? data.map(d => d.temperature?.toFixed(1)) : [28, 27, 29, 31, 30, 28, 27],
          borderColor: COLORS.temperature,
          backgroundColor: `${COLORS.temperature}20`,
          borderWidth: 2,
          tension: 0.4,
          fill: false,
          pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label: 'Umidade (%)',
          data: data.length ? data.map(d => d.humidity?.toFixed(1)) : [65, 68, 62, 58, 55, 60, 63],
          borderColor: COLORS.humidity,
          backgroundColor: `${COLORS.humidity}20`,
          borderWidth: 2,
          tension: 0.4,
          fill: false,
          pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label: 'Umidade Solo (%)',
          data: data.length ? data.map(d => d.soilMoisture?.toFixed(1)) : [42, 40, 38, 45, 48, 46, 44],
          borderColor: COLORS.soilMoisture,
          backgroundColor: `${COLORS.soilMoisture}20`,
          borderWidth: 2,
          tension: 0.4,
          fill: false,
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      ...commonOptions,
      scales: {
        x: {
          grid: { color: COLORS.gridLines },
          ticks: { color: COLORS.textMuted }
        },
        y: {
          grid: { color: COLORS.gridLines },
          ticks: { color: COLORS.textMuted },
          beginAtZero: false
        }
      },
      plugins: {
        ...commonOptions.plugins,
        title: {
          display: true,
          text: 'Readings from Last 7 Days',
          color: COLORS.primary,
          font: { size: 14, weight: 'bold' }
        }
      }
    }
  });
  
  chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * Creates an alert distribution doughnut chart
 * @param {string} canvasId - Canvas element ID
 * @param {Object} data - { critical, warning, info } counts
 */
export function createAlertDistributionChart(canvasId, data = {}) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  
  destroyChart(canvasId);
  
  const chartData = {
    critical: data.critical ?? 2,
    warning: data.warning ?? 3,
    info: data.info ?? 1
  };
  
  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Critical', 'Warning', 'Info'],
      datasets: [{
        data: [chartData.critical, chartData.warning, chartData.info],
        backgroundColor: [COLORS.critical, COLORS.warning, COLORS.info],
        borderColor: '#fff',
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      ...commonOptions,
      cutout: '60%',
      plugins: {
        ...commonOptions.plugins,
        title: {
          display: true,
          text: 'Alert Distribution',
          color: COLORS.primary,
          font: { size: 14, weight: 'bold' }
        }
      }
    }
  });
  
  chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * Creates a sensor status bar chart
 * @param {string} canvasId - Canvas element ID
 * @param {Object} data - { online, warning, offline } counts
 */
export function createSensorStatusChart(canvasId, data = {}) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  
  destroyChart(canvasId);
  
  const chartData = {
    online: data.online ?? 8,
    warning: data.warning ?? 3,
    offline: data.offline ?? 1
  };
  
  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Online', 'Warning', 'Offline'],
      datasets: [{
        label: 'Sensores',
        data: [chartData.online, chartData.warning, chartData.offline],
        backgroundColor: [COLORS.soilMoisture, COLORS.warning, COLORS.critical],
        borderRadius: 8,
        barThickness: 40
      }]
    },
    options: {
      ...commonOptions,
      indexAxis: 'y',
      scales: {
        x: {
          grid: { color: COLORS.gridLines },
          ticks: { color: COLORS.textMuted, stepSize: 1 }
        },
        y: {
          grid: { display: false },
          ticks: { color: COLORS.textMuted }
        }
      },
      plugins: {
        ...commonOptions.plugins,
        legend: { display: false },
        title: {
          display: true,
          text: 'Sensor Status',
          color: COLORS.primary,
          font: { size: 14, weight: 'bold' }
        }
      }
    }
  });
  
  chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * Creates a real-time metric gauge-style chart
 * @param {string} canvasId - Canvas element ID
 * @param {number} value - Current value
 * @param {number} max - Maximum value
 * @param {string} color - Chart color
 */
export function createGaugeChart(canvasId, value = 0, max = 100, color = COLORS.primary) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  
  destroyChart(canvasId);
  
  const remaining = max - value;
  
  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [value, remaining],
        backgroundColor: [color, '#f0f0f0'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      rotation: -90,
      circumference: 180,
      cutout: '75%',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      }
    }
  });
  
  chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * Creates a property overview bar chart
 * @param {string} canvasId - Canvas element ID
 * @param {Array} properties - Array of property data
 */
export function createPropertyOverviewChart(canvasId, properties = []) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  
  destroyChart(canvasId);
  
  const labels = properties.length 
    ? properties.map(p => p.name.substring(0, 15))
    : ['Green Valley', 'Sunrise Ranch', 'Highland Estate'];
    
  const plotsData = properties.length
    ? properties.map(p => p.plotsCount)
    : [2, 2, 1];
    
  const areaData = properties.length
    ? properties.map(p => p.areaHectares)
    : [350, 180, 250];
  
  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Plots',
          data: plotsData,
          backgroundColor: COLORS.primary,
          borderRadius: 4,
          yAxisID: 'y'
        },
        {
          label: 'Area (ha)',
          data: areaData,
          backgroundColor: COLORS.secondary,
          borderRadius: 4,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      ...commonOptions,
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: COLORS.textMuted }
        },
        y: {
          type: 'linear',
          position: 'left',
          grid: { color: COLORS.gridLines },
          ticks: { color: COLORS.primary, stepSize: 1 },
          title: { display: true, text: 'Plots', color: COLORS.primary }
        },
        y1: {
          type: 'linear',
          position: 'right',
          grid: { display: false },
          ticks: { color: COLORS.secondary },
          title: { display: true, text: 'Area (ha)', color: COLORS.secondary }
        }
      }
    }
  });
  
  chartInstances.set(canvasId, chart);
  return chart;
}

// ============================================
// CHART UPDATE FUNCTIONS
// ============================================

/**
 * Updates a chart with new data
 * @param {string} canvasId - Canvas element ID
 * @param {Array|Object} newData - New data to display
 */
export function updateChartData(canvasId, newData) {
  const chart = chartInstances.get(canvasId);
  if (!chart) return;
  
  if (Array.isArray(newData)) {
    // Update datasets
    chart.data.datasets.forEach((dataset, index) => {
      if (newData[index]) {
        dataset.data = newData[index];
      }
    });
  } else if (typeof newData === 'object') {
    // Update first dataset with values
    chart.data.datasets[0].data = Object.values(newData);
  }
  
  chart.update('none'); // Update without animation for real-time
}

/**
 * Adds a new data point to a line chart (real-time updates)
 * @param {string} canvasId - Canvas element ID
 * @param {string} label - X-axis label
 * @param {Array} values - Values for each dataset
 * @param {number} maxPoints - Maximum points to keep
 */
export function addDataPoint(canvasId, label, values, maxPoints = 20) {
  const chart = chartInstances.get(canvasId);
  if (!chart) return;
  
  // Add new label
  chart.data.labels.push(label);
  
  // Add new data to each dataset
  values.forEach((value, index) => {
    if (chart.data.datasets[index]) {
      chart.data.datasets[index].data.push(value);
    }
  });
  
  // Remove oldest data if exceeding maxPoints
  if (chart.data.labels.length > maxPoints) {
    chart.data.labels.shift();
    chart.data.datasets.forEach(dataset => dataset.data.shift());
  }
  
  chart.update('none');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Destroys a chart instance and removes from registry
 * @param {string} canvasId - Canvas element ID
 */
export function destroyChart(canvasId) {
  const chart = chartInstances.get(canvasId);
  if (chart) {
    chart.destroy();
    chartInstances.delete(canvasId);
  }
}

/**
 * Destroys all chart instances
 */
export function destroyAllCharts() {
  chartInstances.forEach(chart => chart.destroy());
  chartInstances.clear();
}

/**
 * Gets a chart instance by canvas ID
 * @param {string} canvasId - Canvas element ID
 * @returns {Chart|null}
 */
export function getChart(canvasId) {
  return chartInstances.get(canvasId) || null;
}

/**
 * Resizes all charts (call on window resize)
 */
export function resizeAllCharts() {
  chartInstances.forEach(chart => chart.resize());
}

// Export colors for use in other modules
export { COLORS };
