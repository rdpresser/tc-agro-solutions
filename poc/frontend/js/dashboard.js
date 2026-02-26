/**
 * TC Agro Solutions - Dashboard Page Entry Point
 */

import {
  getDashboardStats,
  getLatestReadings,
  getReadingsLatest,
  getHistoricalData,
  getPendingAlertsPage,
  getPendingAlertsSummary,
  getProperties,
  getPlots,
  getPlotsPaginated,
  getSensorsPaginated,
  getOwnersPaginated,
  getOwnersQueryParameterMapFromSwagger,
  joinOwnerGroup,
  leaveOwnerGroup,
  joinAlertOwnerGroup,
  leaveAlertOwnerGroup,
  initSignalRConnection,
  initAlertSignalRConnection,
  stopSignalRConnection,
  stopAlertSignalRConnection
} from './api.js';
import {
  addDataPoint,
  createAlertDistributionChart,
  createReadingsChart,
  destroyAllCharts
} from './charts.js';
import { initProtectedPage } from './common.js';
import { toast } from './i18n.js';
import { createFallbackPoller } from './realtime-fallback.js';
import {
  $,
  formatDate,
  formatNumber,
  formatPercentage,
  formatRelativeTime,
  formatTemperature,
  getUser
} from './utils.js';

// ============================================
// PAGE INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  if (!initProtectedPage()) {
    return;
  }

  const user = getUser();
  if (user && user.name) {
    const userDisplay = $('#userDisplay');
    if (userDisplay) {
      userDisplay.textContent = user.name;
    }
  }

  await setupOwnerSelectorForDashboard();

  const shouldEnableRealtime = await loadDashboardData();
  if (shouldEnableRealtime) {
    setupRealTimeUpdates();
  }
});

window.addEventListener('beforeunload', async () => {
  const realtimeOwnerId = getRealtimeOwnerScopeId();
  if (!isCurrentUserAdmin() || realtimeOwnerId) {
    try {
      await leaveOwnerGroup(realtimeOwnerId);
    } catch (error) {
      console.warn(`Failed to leave owner group ${realtimeOwnerId}:`, error);
    }
  }

  if (!isCurrentUserAdmin() || realtimeOwnerId) {
    try {
      await leaveAlertOwnerGroup(realtimeOwnerId);
    } catch (error) {
      console.warn(`Failed to leave alert owner group ${realtimeOwnerId}:`, error);
    }
  }

  stopFallbackPollingSilently();
  stopSignalRConnection();
  stopAlertSignalRConnection();
  destroyAllCharts();
});

async function loadDashboardData() {
  try {
    const ownerId = getSelectedOwnerIdForDashboard();
    const stats = await getDashboardStats(ownerId);
    updateStatCards(stats);

    const userPlots = await getPlots(null, ownerId);
    const hasPlots = Array.isArray(userPlots) && userPlots.length > 0;

    if (!hasPlots) {
      hasSetupForRealtime = false;
      syncRealtimeStateFromReadings([]);
      renderInitialSetupState({ preserveStats: true });
      return false;
    }

    // Load all data in parallel
    const [dashboardReadings, latestReadings, alertsData, statSubtextData] = await Promise.all([
      getLatestReadings(5, ownerId),
      getReadingsLatest({ pageNumber: 1, pageSize: 20, ownerId }),
      loadDashboardAlertsData(ownerId),
      loadDashboardStatSubtextData(ownerId, stats)
    ]);

    const alerts = alertsData?.page?.items || [];
    const alertSummary = alertsData?.summary || null;

    const readingsForTable = dashboardReadings.length > 0 ? dashboardReadings : latestReadings;
    syncRealtimeStateFromReadings(readingsForTable);
    updateReadingsTable(readingsForTable);
    updateAlertsSection(alerts);
    renderAlertsDistributionChart(alertSummary, alerts);
    const alertStat = $('#stat-alerts');
    if (alertStat) {
      alertStat.textContent = String(resolvePendingAlertsTotal(alertSummary, alertsData?.page));
    }
    dashboardSubtextState = {
      propertiesCreatedThisMonth: Number(statSubtextData?.propertiesCreatedThisMonth || 0),
      plotsCreatedThisMonth: Number(statSubtextData?.plotsCreatedThisMonth || 0),
      activeSensorsCount: Number(statSubtextData?.activeSensorsCount || 0),
      sensorsTotal: Number(statSubtextData?.sensorsTotal || 0)
    };
    updateStatSubtextsFromData({
      ...dashboardSubtextState,
      pendingAlerts: alerts,
      newPendingInWindowCount: Number(alertSummary?.newPendingInWindowCount || 0)
    });

    const freshestReading = pickFreshestReading(latestReadings, readingsForTable);
    if (freshestReading) {
      applyLatestReadingToMetrics(freshestReading);
    }

    const chartSensorId = freshestReading?.sensorId;
    if (chartSensorId) {
      const history = await getHistoricalData(chartSensorId, 7, 168, ownerId);
      renderReadingsChart(history);
    } else {
      renderReadingsChart([]);
    }

    return true;
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    toast('dashboard.load_failed', 'error');
    return false;
  }
}

function isCurrentUserAdmin() {
  const currentUser = getUser();
  if (!currentUser) return false;

  const roleValues = Array.isArray(currentUser.role)
    ? currentUser.role
    : [currentUser.role].filter(Boolean);

  return roleValues.some((role) => String(role).trim().toLowerCase() === 'admin');
}

function getSelectedOwnerIdForDashboard() {
  if (!isCurrentUserAdmin()) {
    return null;
  }

  return selectedOwnerId || null;
}

function getCurrentUserOwnerIdFromClaims() {
  const currentUser = getUser();
  if (!currentUser) {
    return null;
  }

  const ownerIdCandidates = [
    currentUser.sub,
    currentUser.id,
    currentUser.userId,
    currentUser.ownerId,
    currentUser.nameIdentifier
  ];

  const ownerId = ownerIdCandidates.find((candidate) => String(candidate || '').trim().length > 0);
  return ownerId ? String(ownerId).trim() : null;
}

function getRealtimeOwnerScopeId() {
  if (isCurrentUserAdmin()) {
    return getSelectedOwnerIdForDashboard();
  }

  return getCurrentUserOwnerIdFromClaims();
}

async function setupOwnerSelectorForDashboard() {
  const filterContainer = $('#dashboard-owner-filter');
  const ownerSelect = $('#dashboard-owner-select');

  if (!filterContainer || !ownerSelect) {
    return;
  }

  if (!isCurrentUserAdmin()) {
    filterContainer.style.display = 'none';
    selectedOwnerId = null;
    return;
  }

  filterContainer.style.display = 'block';
  ownerSelect.disabled = true;
  ownerSelect.innerHTML = '<option value="">Loading owners...</option>';

  try {
    let parameterMap = null;
    try {
      parameterMap = await getOwnersQueryParameterMapFromSwagger();
    } catch {
      parameterMap = null;
    }

    const owners = await getAllOwnersForDashboard(parameterMap);
    const sortedOwners = [...owners].sort((left, right) => {
      const leftName = String(left?.name || '').toLowerCase();
      const rightName = String(right?.name || '').toLowerCase();
      return leftName.localeCompare(rightName);
    });

    ownerSelect.innerHTML = sortedOwners
      .map(
        (owner) =>
          `<option value="${owner.id}">${owner?.name || 'Unnamed owner'} - ${owner?.email || 'no-email'}</option>`
      )
      .join('');

    if (sortedOwners.length > 0) {
      selectedOwnerId = sortedOwners[0].id;
      ownerSelect.value = selectedOwnerId;
      ownerSelect.disabled = false;
    } else {
      selectedOwnerId = null;
      ownerSelect.innerHTML = '<option value="">No owners found</option>';
      ownerSelect.disabled = true;
    }

    ownerSelect.addEventListener('change', async () => {
      const previousOwnerId = selectedOwnerId;
      selectedOwnerId = ownerSelect.value || null;

      const shouldEnableRealtime = await loadDashboardData();

      if (
        previousOwnerId &&
        previousOwnerId !== selectedOwnerId &&
        sensorRealtimeState === 'connected'
      ) {
        await leaveOwnerGroup(previousOwnerId);
      }

      if (
        previousOwnerId &&
        previousOwnerId !== selectedOwnerId &&
        alertsRealtimeState === 'connected'
      ) {
        await leaveAlertOwnerGroup(previousOwnerId);
      }

      if (shouldEnableRealtime) {
        await ensureOwnerGroupSubscriptions();
        syncFallbackMode('owner-scope-changed');
      }
    });
  } catch (error) {
    console.warn('[Dashboard] Failed to load owners for admin filter.', error);
    selectedOwnerId = null;
    ownerSelect.innerHTML = '<option value="">Failed to load owners</option>';
    ownerSelect.disabled = true;
  }
}

async function getAllOwnersForDashboard(parameterMap) {
  const owners = [];
  let pageNumber = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await getOwnersPaginated(
      {
        pageNumber,
        pageSize: 1000,
        sortBy: 'name',
        sortDirection: 'asc',
        filter: ''
      },
      parameterMap
    );

    const items = response?.data || response?.items || response?.results || [];
    owners.push(...items);
    hasNextPage = Boolean(response?.hasNextPage);
    pageNumber += 1;
  }

  return Array.from(new Map(owners.map((owner) => [owner.id, owner])).values());
}

function pickFreshestReading(...readingCollections) {
  const allReadings = readingCollections.flat().filter(Boolean);
  if (!allReadings.length) return null;

  return allReadings
    .slice()
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())[0];
}

function applyLatestReadingToMetrics(reading) {
  updateMetricCard('temperature', reading.temperature ?? null);
  updateMetricCard('humidity', reading.humidity ?? null);
  updateMetricCard('soil-moisture', reading.soilMoisture ?? null);
  updateMetricCard('rainfall', reading.rainfall ?? null);
}

function renderReadingsChart(history) {
  const container = $('#readings-chart-container');
  if (!container) return;

  container.innerHTML = '<canvas id="readings-chart"></canvas>';
  createReadingsChart('readings-chart', history || []);
}

function renderInitialSetupState(options = {}) {
  const preserveStats = Boolean(options?.preserveStats);

  const statProperties = $('#stat-properties');
  const statPlots = $('#stat-plots');
  const statSensors = $('#stat-sensors');
  const statAlerts = $('#stat-alerts');

  if (!preserveStats) {
    if (statProperties) statProperties.textContent = '0';
    if (statPlots) statPlots.textContent = '0';
    if (statSensors) statSensors.textContent = '0';
    if (statAlerts) statAlerts.textContent = '0';
  }

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

  const transportModeStatus = $('#transport-mode-status');
  if (transportModeStatus) {
    transportModeStatus.className = 'badge badge-warning';
    transportModeStatus.textContent = 'Setup required';
    transportModeStatus.title =
      'Real-time transport mode will be displayed after setup is completed.';
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

function updateStatSubtextsFromData(data) {
  const propertiesSubtext = $('#stat-properties-subtext');
  const plotsSubtext = $('#stat-plots-subtext');
  const sensorsSubtext = $('#stat-sensors-subtext');
  const alertsSubtext = $('#stat-alerts-subtext');

  const propertiesCreatedThisMonth = Number(data?.propertiesCreatedThisMonth || 0);
  const plotsCreatedThisMonth = Number(data?.plotsCreatedThisMonth || 0);
  const sensorsTotal = Number(data?.sensorsTotal || 0);
  const activeSensorsCount = Number(data?.activeSensorsCount || 0);
  const pendingAlerts = Array.isArray(data?.pendingAlerts) ? data.pendingAlerts : [];
  const summaryNewPending24h = Number(data?.newPendingInWindowCount || 0);

  if (propertiesSubtext) {
    propertiesSubtext.textContent = `↑ ${propertiesCreatedThisMonth} this month`;
  }

  if (plotsSubtext) {
    plotsSubtext.textContent = `↑ ${plotsCreatedThisMonth} this month`;
  }

  if (sensorsSubtext) {
    const onlinePercentage =
      sensorsTotal > 0 ? Math.round((activeSensorsCount / sensorsTotal) * 100) : 0;
    sensorsSubtext.textContent = `${onlinePercentage}% online`;
  }

  if (alertsSubtext) {
    const newAlerts24h =
      summaryNewPending24h > 0
        ? summaryNewPending24h
        : pendingAlerts.filter((alert) => {
            const raw = alert?.createdAt || alert?.CreatedAt;
            const timestamp = new Date(raw || 0).getTime();
            return !Number.isNaN(timestamp) && timestamp >= Date.now() - 24 * 60 * 60 * 1000;
          }).length;

    alertsSubtext.textContent = `↑ ${newAlerts24h} new (24h)`;
  }
}

async function loadDashboardAlertsData(ownerId) {
  const [pageResult, summaryResult] = await Promise.allSettled([
    getPendingAlertsPage({
      ownerId,
      pageNumber: 1,
      pageSize: DASHBOARD_ALERTS_PREVIEW_PAGE_SIZE,
      status: 'pending'
    }),
    getPendingAlertsSummary({ ownerId, windowHours: 24 })
  ]);

  const page =
    pageResult.status === 'fulfilled'
      ? pageResult.value
      : {
          items: [],
          totalCount: 0,
          pageNumber: 1,
          pageSize: DASHBOARD_ALERTS_PREVIEW_PAGE_SIZE
        };

  const summary =
    summaryResult.status === 'fulfilled'
      ? summaryResult.value
      : {
          pendingAlertsTotal: Number(page?.totalCount || 0),
          criticalPendingCount: 0,
          highPendingCount: 0,
          mediumPendingCount: 0,
          lowPendingCount: 0,
          newPendingInWindowCount: 0
        };

  return {
    page,
    summary
  };
}

function resolvePendingAlertsTotal(summary, page) {
  const summaryTotal = Number(summary?.pendingAlertsTotal || 0);
  if (summaryTotal > 0) {
    return summaryTotal;
  }

  return Number(page?.totalCount || 0);
}

async function loadDashboardStatSubtextData(ownerId, stats) {
  const [properties, plots, activeSensorsPage] = await Promise.all([
    getAllPropertiesForDashboard(ownerId),
    getAllPlotsForDashboard(ownerId),
    getSensorsPaginated({
      pageNumber: 1,
      pageSize: 1,
      sortBy: 'installedAt',
      sortDirection: 'desc',
      ownerId: ownerId || '',
      status: 'Active'
    }).catch(() => ({ totalCount: 0 }))
  ]);

  return {
    propertiesCreatedThisMonth: countCreatedThisMonth(properties),
    plotsCreatedThisMonth: countCreatedThisMonth(plots),
    activeSensorsCount: getPaginatedTotal(activeSensorsPage),
    sensorsTotal: Number(stats?.sensors || 0)
  };
}

async function getAllPropertiesForDashboard(ownerId) {
  const items = [];
  let pageNumber = 1;
  let hasNextPage = true;

  while (hasNextPage && pageNumber <= 50) {
    const page = await getProperties({
      pageNumber,
      pageSize: 200,
      sortBy: 'createdAt',
      sortDirection: 'desc',
      filter: '',
      ownerId: ownerId || ''
    });

    const pageItems = page?.data || page?.items || page?.results || [];
    items.push(...pageItems);
    hasNextPage = Boolean(page?.hasNextPage);
    pageNumber += 1;
  }

  return items;
}

async function getAllPlotsForDashboard(ownerId) {
  const items = [];
  let pageNumber = 1;
  let hasNextPage = true;

  while (hasNextPage && pageNumber <= 50) {
    const page = await getPlotsPaginated({
      pageNumber,
      pageSize: 200,
      sortBy: 'createdat',
      sortDirection: 'desc',
      filter: '',
      ownerId: ownerId || ''
    });

    const pageItems = page?.data || page?.items || page?.results || [];
    items.push(...pageItems);
    hasNextPage = Boolean(page?.hasNextPage);
    pageNumber += 1;
  }

  return items;
}

function countCreatedThisMonth(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 0;
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  return items.filter((item) => {
    const createdAt = item?.createdAt || item?.CreatedAt;
    const createdAtTs = new Date(createdAt || 0).getTime();
    return !Number.isNaN(createdAtTs) && createdAtTs >= startOfMonth;
  }).length;
}

function getPaginatedTotal(payload) {
  if (!payload || typeof payload !== 'object') {
    return 0;
  }

  if (typeof payload.totalCount === 'number') {
    return payload.totalCount;
  }

  if (typeof payload.TotalCount === 'number') {
    return payload.TotalCount;
  }

  const items = payload?.items || payload?.data || payload?.results || [];
  return Array.isArray(items) ? items.length : 0;
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
      <td><strong>${getSensorDisplayName(reading)}</strong></td>
      <td>${formatPlotDisplay(reading)}</td>
      <td class="${getTemperatureClass(reading.temperature)}">${formatTemperature(reading.temperature)}</td>
      <td class="${getHumidityClass(reading.humidity)}">${formatPercentage(reading.humidity)}</td>
      <td class="${getSoilMoistureClass(reading.soilMoisture)}">${formatPercentage(reading.soilMoisture)}</td>
      <td title="${formatDate(reading.timestamp)}">${formatRelativeTime(reading.timestamp)}</td>
    </tr>
  `
    )
    .join('');
}

function getSensorDisplayName(reading) {
  return reading.sensorLabel || reading.SensorLabel || reading.sensorId || reading.SensorId || '-';
}

function formatPlotDisplay(reading) {
  const plotName = reading.plotName || reading.PlotName || '-';
  const propertyName = reading.propertyName || reading.PropertyName || '';

  if (!propertyName || propertyName === '-') {
    return plotName;
  }

  return `${plotName} - ${propertyName}`;
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
    <div class="alert-item alert-${alert.severity}" data-alert-id="${alert.id || alert.Id || ''}">
      <div class="alert-header">
        <span class="alert-badge badge-${alert.severity}">
          ${getSeverityIcon(alert.severity)} ${getSeverityLabel(alert.severity)}
        </span>
        <span class="alert-badge ${getAlertStatusBadgeClass(alert.status || alert.Status)}" data-alert-status>
          ${getAlertStatusLabel(alert.status || alert.Status)}
        </span>
        <span class="alert-time" title="${formatDate(alert.createdAt)}">
          ${formatRelativeTime(alert.createdAt)}
        </span>
      </div>
      <h4 class="alert-title">${alert.title || alert.alertType || 'Alert'}</h4>
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

function getAlertStatusLabel(status) {
  const normalized = String(status || 'Pending').toLowerCase();
  if (normalized === 'acknowledged') return 'Acknowledged';
  if (normalized === 'resolved') return 'Resolved';
  return 'Pending';
}

function getAlertStatusBadgeClass(status) {
  const normalized = String(status || 'Pending').toLowerCase();
  if (normalized === 'resolved') return 'badge-success';
  if (normalized === 'acknowledged') return 'badge-warning';
  return 'badge-danger';
}

function extractAlertId(payload) {
  return payload?.alertId || payload?.AlertId || payload?.id || payload?.Id || null;
}

function extractAlertStatus(payload, fallbackStatus = 'Pending') {
  return payload?.status || payload?.Status || fallbackStatus;
}

function updateAlertCardVisualStatus(alertId, nextStatus) {
  if (!alertId) {
    return;
  }

  const card = document.querySelector(`[data-alert-id="${alertId}"]`);
  if (!card) {
    return;
  }

  const statusBadge = card.querySelector('[data-alert-status]');
  if (statusBadge) {
    statusBadge.className = `alert-badge ${getAlertStatusBadgeClass(nextStatus)}`;
    statusBadge.textContent = getAlertStatusLabel(nextStatus);
  }

  if (String(nextStatus).toLowerCase() === 'resolved') {
    card.style.opacity = '0.55';
    setTimeout(() => {
      card.remove();
      const alertStat = $('#stat-alerts');
      if (alertStat) {
        const current = parseInt(alertStat.textContent || '0', 10);
        if (current > 0) {
          alertStat.textContent = String(current - 1);
        }
      }
    }, 800);
  }
}

// ============================================
// REAL-TIME UPDATES (SIGNALR)
// ============================================

const DASHBOARD_REALTIME_CONTEXT = {
  page: 'dashboard',
  hub: '/dashboard/sensorshub',
  events: ['sensorReading', 'sensorStatusChanged'],
  fallbackRoutes: ['/api/dashboard/latest', '/api/readings/latest']
};

const DASHBOARD_ALERTS_REALTIME_CONTEXT = {
  page: 'dashboard',
  hub: '/dashboard/alertshub',
  events: ['alertCreated', 'alertAcknowledged', 'alertResolved'],
  fallbackRoutes: ['/api/alerts/pending', '/api/alerts/pending/summary']
};

let hasSetupForRealtime = true;
let sensorRealtimeState = 'disconnected';
let alertsRealtimeState = 'disconnected';
let selectedOwnerId = null;
let ownerSubscriptionInFlight = null;
let lastOwnerSubscriptionFailedAt = 0;
let lastOwnerSubscriptionFailureKey = null;
let latestMetricsTimestampMs = 0;
let dashboardSubtextState = {
  propertiesCreatedThisMonth: 0,
  plotsCreatedThisMonth: 0,
  activeSensorsCount: 0,
  sensorsTotal: 0
};
const realtimeReadingsTimeline = [];
const processedRealtimeEventKeys = new Map();
const processedAlertRealtimeEventKeys = new Map();
const MAX_PROCESSED_REALTIME_EVENTS = 500;
const MAX_REALTIME_TIMELINE_ITEMS = 100;
const DASHBOARD_ALERTS_PREVIEW_PAGE_SIZE = 20;
const OWNER_SUBSCRIPTION_RETRY_COOLDOWN_MS = 8000;
const fallbackPoller = createFallbackPoller({
  refresh: refreshDashboardFromFallback,
  intervalMs: 15000,
  context: 'DashboardRealtime',
  connection: DASHBOARD_REALTIME_CONTEXT,
  onError: (error) => {
    console.warn('[DashboardRealtime] HTTP fallback refresh failed.', {
      ...DASHBOARD_REALTIME_CONTEXT,
      error
    });
  }
});

async function setupRealTimeUpdates() {
  const sensorConnection = await initSignalRConnection({
    onSensorReading: handleSensorReading,
    onConnectionChange: handleSensorConnectionChange
  });

  const alertsConnection = await initAlertSignalRConnection({
    onAlertCreated: (payload) => handleAlertRealtime('created', payload),
    onAlertAcknowledged: (payload) => handleAlertRealtime('acknowledged', payload),
    onAlertResolved: (payload) => handleAlertRealtime('resolved', payload),
    onConnectionChange: handleAlertConnectionChange
  });

  if (
    sensorConnection &&
    !sensorConnection.isMock &&
    alertsConnection &&
    !alertsConnection.isMock
  ) {
    await ensureOwnerGroupSubscriptions();
  }

  if (!sensorConnection || sensorConnection.isMock) {
    fallbackPoller.start('sensor-initial-connect-failed');
  }

  if (!alertsConnection || alertsConnection.isMock) {
    fallbackPoller.start('alerts-initial-connect-failed');
  }
}

async function refreshDashboardFromFallback() {
  const ownerId = getSelectedOwnerIdForDashboard();

  const [dashboardReadingsResult, latestReadingsResult, alertsResult, statSubtextResult] =
    await Promise.allSettled([
      getLatestReadings(5, ownerId),
      getReadingsLatest({ pageNumber: 1, pageSize: 20, ownerId }),
      loadDashboardAlertsData(ownerId),
      loadDashboardStatSubtextData(ownerId, {
        sensors: Number($('#stat-sensors')?.textContent || 0)
      })
    ]);

  if (dashboardReadingsResult.status === 'rejected') {
    console.warn('[DashboardRealtime] Fallback route failed: /api/dashboard/latest', {
      hub: DASHBOARD_REALTIME_CONTEXT.hub,
      eventStream: DASHBOARD_REALTIME_CONTEXT.events,
      error: dashboardReadingsResult.reason
    });
  }

  if (latestReadingsResult.status === 'rejected') {
    console.warn('[DashboardRealtime] Fallback route failed: /api/readings/latest', {
      hub: DASHBOARD_REALTIME_CONTEXT.hub,
      eventStream: DASHBOARD_REALTIME_CONTEXT.events,
      error: latestReadingsResult.reason
    });
  }

  if (alertsResult.status === 'rejected') {
    console.warn('[DashboardRealtime] Fallback route failed: /api/alerts/pending', {
      hub: DASHBOARD_ALERTS_REALTIME_CONTEXT.hub,
      eventStream: DASHBOARD_ALERTS_REALTIME_CONTEXT.events,
      error: alertsResult.reason
    });
  }

  const dashboardReadings =
    dashboardReadingsResult.status === 'fulfilled' ? dashboardReadingsResult.value : [];
  const latestReadings =
    latestReadingsResult.status === 'fulfilled' ? latestReadingsResult.value : [];
  const alertsData =
    alertsResult.status === 'fulfilled'
      ? alertsResult.value
      : {
          page: {
            items: [],
            totalCount: 0,
            pageNumber: 1,
            pageSize: DASHBOARD_ALERTS_PREVIEW_PAGE_SIZE
          },
          summary: null
        };
  const alerts = alertsData.page.items || [];
  const alertSummary = alertsData.summary;
  const statSubtextData = statSubtextResult.status === 'fulfilled' ? statSubtextResult.value : null;

  const readingsForTable = dashboardReadings.length > 0 ? dashboardReadings : latestReadings;
  syncRealtimeStateFromReadings(readingsForTable);
  updateReadingsTable(readingsForTable);
  updateAlertsSection(alerts);
  renderAlertsDistributionChart(alertSummary, alerts);
  const alertStat = $('#stat-alerts');
  if (alertStat) {
    alertStat.textContent = String(resolvePendingAlertsTotal(alertSummary, alertsData.page));
  }

  if (statSubtextData) {
    dashboardSubtextState = {
      propertiesCreatedThisMonth: Number(statSubtextData.propertiesCreatedThisMonth || 0),
      plotsCreatedThisMonth: Number(statSubtextData.plotsCreatedThisMonth || 0),
      activeSensorsCount: Number(statSubtextData.activeSensorsCount || 0),
      sensorsTotal: Number(statSubtextData.sensorsTotal || 0)
    };

    updateStatSubtextsFromData({
      ...dashboardSubtextState,
      pendingAlerts: alerts,
      newPendingInWindowCount: Number(alertSummary?.newPendingInWindowCount || 0)
    });
  }

  const freshestReading = pickFreshestReading(latestReadings, readingsForTable);
  if (freshestReading) {
    applyLatestReadingToMetrics(freshestReading);
  }
}

function stopFallbackPollingSilently() {
  fallbackPoller.stop('page-unload', { silent: true });
}

function normalizeRealtimeReadingPayload(reading) {
  return {
    ...reading,
    sensorId: reading.sensorId || reading.SensorId,
    plotId: reading.plotId || reading.PlotId,
    plotName: reading.plotName || reading.PlotName || '-',
    propertyName: reading.propertyName || reading.PropertyName || '-',
    sensorLabel: reading.sensorLabel || reading.SensorLabel || null,
    timestamp: reading.timestamp || reading.Timestamp || new Date().toISOString(),
    temperature: reading.temperature ?? reading.Temperature ?? null,
    humidity: reading.humidity ?? reading.Humidity ?? null,
    soilMoisture: reading.soilMoisture ?? reading.SoilMoisture ?? null,
    rainfall: reading.rainfall ?? reading.Rainfall ?? null
  };
}

function parseReadingTimestampMs(reading) {
  const parsed = new Date(reading?.timestamp || 0).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function buildRealtimeEventKey(reading) {
  const sensorId = reading?.sensorId || 'unknown';
  const timestampMs = parseReadingTimestampMs(reading);
  return `${sensorId}:${timestampMs}`;
}

function isValidGuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '').trim()
  );
}

function pushRealtimeReading(reading) {
  realtimeReadingsTimeline.unshift(reading);

  if (realtimeReadingsTimeline.length > MAX_REALTIME_TIMELINE_ITEMS) {
    realtimeReadingsTimeline.length = MAX_REALTIME_TIMELINE_ITEMS;
  }
}

function markRealtimeEventAsProcessed(eventKey) {
  processedRealtimeEventKeys.set(eventKey, Date.now());

  if (processedRealtimeEventKeys.size <= MAX_PROCESSED_REALTIME_EVENTS) {
    return;
  }

  const oldestKey = processedRealtimeEventKeys.keys().next().value;
  if (oldestKey) {
    processedRealtimeEventKeys.delete(oldestKey);
  }
}

function markAlertRealtimeEventAsProcessed(eventKey) {
  processedAlertRealtimeEventKeys.set(eventKey, Date.now());

  if (processedAlertRealtimeEventKeys.size <= MAX_PROCESSED_REALTIME_EVENTS) {
    return;
  }

  const oldestKey = processedAlertRealtimeEventKeys.keys().next().value;
  if (oldestKey) {
    processedAlertRealtimeEventKeys.delete(oldestKey);
  }
}

function syncRealtimeStateFromReadings(readings) {
  realtimeReadingsTimeline.length = 0;
  processedRealtimeEventKeys.clear();
  latestMetricsTimestampMs = 0;

  if (!Array.isArray(readings) || readings.length === 0) {
    return;
  }

  readings.forEach((reading) => {
    const normalized = normalizeRealtimeReadingPayload(reading);
    if (!normalized.sensorId) {
      return;
    }

    pushRealtimeReading(normalized);
    const eventKey = buildRealtimeEventKey(normalized);
    markRealtimeEventAsProcessed(eventKey);

    const timestampMs = parseReadingTimestampMs(normalized);
    if (timestampMs > latestMetricsTimestampMs) {
      latestMetricsTimestampMs = timestampMs;
    }
  });
}

function getRealtimeReadingsForTable(limit = 10) {
  return realtimeReadingsTimeline
    .slice()
    .sort((left, right) => parseReadingTimestampMs(right) - parseReadingTimestampMs(left))
    .slice(0, limit);
}

function updateRealtimeReadingsTable() {
  updateReadingsTable(getRealtimeReadingsForTable(10));
}

function computeAlertsDistribution(alerts) {
  const distribution = {
    critical: 0,
    warning: 0,
    info: 0
  };

  if (!Array.isArray(alerts)) {
    return distribution;
  }

  alerts.forEach((alert) => {
    const severity = String(alert?.severity || alert?.Severity || 'info').toLowerCase();

    if (severity === 'critical') {
      distribution.critical += 1;
      return;
    }

    if (severity === 'warning' || severity === 'high' || severity === 'medium') {
      distribution.warning += 1;
      return;
    }

    distribution.info += 1;
  });

  return distribution;
}

function renderAlertsDistributionChart(summary, alerts = []) {
  const container = $('#alerts-chart-container');
  if (!container) {
    return;
  }

  const distribution =
    summary && typeof summary === 'object'
      ? {
          critical: Number(summary?.criticalPendingCount || 0),
          warning:
            Number(summary?.highPendingCount || 0) + Number(summary?.mediumPendingCount || 0),
          info: Number(summary?.lowPendingCount || 0)
        }
      : computeAlertsDistribution(alerts);

  container.innerHTML = '<canvas id="alerts-chart"></canvas>';
  createAlertDistributionChart('alerts-chart', distribution);
}

function extractAlertEventTimestamp(payload) {
  const timestampValue =
    payload?.createdAt ||
    payload?.CreatedAt ||
    payload?.acknowledgedAt ||
    payload?.AcknowledgedAt ||
    payload?.resolvedAt ||
    payload?.ResolvedAt ||
    null;

  if (!timestampValue) {
    return 0;
  }

  const parsed = new Date(timestampValue).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function buildAlertRealtimeEventKey(eventType, payload) {
  const alertId = extractAlertId(payload) || 'unknown';
  const status = extractAlertStatus(payload, eventType || 'unknown');
  const timestamp = extractAlertEventTimestamp(payload);
  return `${eventType}:${alertId}:${status}:${timestamp}`;
}

function shouldUpdateMetrics(reading) {
  const timestampMs = parseReadingTimestampMs(reading);
  if (timestampMs === 0) {
    return true;
  }

  if (timestampMs >= latestMetricsTimestampMs) {
    latestMetricsTimestampMs = timestampMs;
    return true;
  }

  return false;
}

async function ensureOwnerGroupSubscriptions() {
  const realtimeOwnerId = getRealtimeOwnerScopeId();
  const shouldJoinSensor = sensorRealtimeState === 'connected';
  const shouldJoinAlerts = alertsRealtimeState === 'connected';
  const ownerScopeKey = realtimeOwnerId || '__self__';
  const attemptKey = `${ownerScopeKey}|sensor:${shouldJoinSensor}|alerts:${shouldJoinAlerts}`;

  if (isCurrentUserAdmin() && !realtimeOwnerId) {
    console.warn('[SignalR] Admin owner scope not selected. Skipping owner-group subscription.');
    return;
  }

  if (isCurrentUserAdmin() && realtimeOwnerId && !isValidGuid(realtimeOwnerId)) {
    console.warn('[SignalR] Invalid owner scope GUID. Skipping owner-group subscription.', {
      ownerId: realtimeOwnerId
    });
    return;
  }

  if (!shouldJoinSensor && !shouldJoinAlerts) {
    return;
  }

  if (ownerSubscriptionInFlight) {
    return ownerSubscriptionInFlight;
  }

  if (
    lastOwnerSubscriptionFailureKey === attemptKey &&
    Date.now() - lastOwnerSubscriptionFailedAt < OWNER_SUBSCRIPTION_RETRY_COOLDOWN_MS
  ) {
    return;
  }

  ownerSubscriptionInFlight = (async () => {
    let sensorJoined = true;
    let alertsJoined = true;

    if (shouldJoinSensor) {
      sensorJoined = await joinOwnerGroup(realtimeOwnerId);
    }

    if (shouldJoinAlerts) {
      alertsJoined = await joinAlertOwnerGroup(realtimeOwnerId);
    }

    if (!sensorJoined || !alertsJoined) {
      lastOwnerSubscriptionFailedAt = Date.now();
      lastOwnerSubscriptionFailureKey = attemptKey;

      console.warn('[SignalR] Failed to join one or more owner groups.', {
        sensorJoined,
        alertsJoined,
        ownerId: realtimeOwnerId
      });
      return;
    }

    lastOwnerSubscriptionFailureKey = null;
    lastOwnerSubscriptionFailedAt = 0;
  })();

  try {
    await ownerSubscriptionInFlight;
  } finally {
    ownerSubscriptionInFlight = null;
  }
}

const handleSensorReading = (reading) => {
  const normalized = normalizeRealtimeReadingPayload(reading);
  if (!normalized.sensorId) {
    return;
  }

  const eventKey = buildRealtimeEventKey(normalized);
  if (processedRealtimeEventKeys.has(eventKey)) {
    return;
  }

  markRealtimeEventAsProcessed(eventKey);
  pushRealtimeReading(normalized);

  if (shouldUpdateMetrics(normalized)) {
    applyLatestReadingToMetrics(normalized);
  }

  const timeLabel = new Date(normalized.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  addDataPoint(
    'readings-chart',
    timeLabel,
    [normalized.temperature ?? 0, normalized.humidity ?? 0, normalized.soilMoisture ?? 0],
    168
  );

  updateRealtimeReadingsTable();
};

function handleSensorConnectionChange(state) {
  sensorRealtimeState = state;
  updateRealtimeBadges();

  // Rejoin owner groups after reconnection (without creating a new connection)
  if (state === 'connected' && hasSetupForRealtime) {
    console.warn('[SignalR] Connected, (re)joining owner groups...');
    void ensureOwnerGroupSubscriptions();
  }

  if (state === 'reconnecting' || state === 'disconnected') {
    console.warn(
      '[DashboardRealtime] SignalR stream degraded. HTTP fallback remains active until recovery.',
      {
        state,
        hub: DASHBOARD_REALTIME_CONTEXT.hub,
        signalrEvents: DASHBOARD_REALTIME_CONTEXT.events,
        fallbackRoutes: DASHBOARD_REALTIME_CONTEXT.fallbackRoutes
      }
    );
  }

  syncFallbackMode('sensor');
}

function handleAlertConnectionChange(state) {
  alertsRealtimeState = state;
  updateRealtimeBadges();

  if (state === 'connected' && hasSetupForRealtime) {
    console.warn('[AlertSignalR] Connected, (re)joining owner groups...');
    void ensureOwnerGroupSubscriptions();
  }

  if (state === 'reconnecting' || state === 'disconnected') {
    console.warn(
      '[DashboardAlertsRealtime] AlertHub stream degraded. HTTP fallback remains active until recovery.',
      {
        state,
        hub: DASHBOARD_ALERTS_REALTIME_CONTEXT.hub,
        signalrEvents: DASHBOARD_ALERTS_REALTIME_CONTEXT.events,
        fallbackRoutes: DASHBOARD_ALERTS_REALTIME_CONTEXT.fallbackRoutes
      }
    );
  }

  syncFallbackMode('alerts');
}

function syncFallbackMode(source) {
  const sensorConnected = sensorRealtimeState === 'connected';
  const alertsConnected = alertsRealtimeState === 'connected';

  if (sensorConnected && alertsConnected) {
    if (fallbackPoller.isRunning()) {
      fallbackPoller.stop(`${source}-connection-state-connected`);
    }
    updateRealtimeBadges();
    return;
  }

  fallbackPoller.start(`sensor:${sensorRealtimeState}|alerts:${alertsRealtimeState}`);
  updateRealtimeBadges();
}

function updateRealtimeBadges() {
  const indicator = $('#connection-status');
  const transportIndicator = $('#transport-mode-status');
  const sensorConnected = sensorRealtimeState === 'connected';
  const alertsConnected = alertsRealtimeState === 'connected';
  const anyReconnecting =
    sensorRealtimeState === 'reconnecting' || alertsRealtimeState === 'reconnecting';
  const usingSignalR = sensorConnected && alertsConnected;

  if (indicator) {
    indicator.className = usingSignalR
      ? 'badge badge-success'
      : anyReconnecting
        ? 'badge badge-warning'
        : 'badge badge-danger';

    indicator.textContent = usingSignalR
      ? '● Live'
      : anyReconnecting
        ? '● Reconnecting'
        : '● Fallback active';

    indicator.title = usingSignalR
      ? 'Realtime connected via SignalR hubs.'
      : anyReconnecting
        ? 'Realtime reconnecting. HTTP fallback polling remains active.'
        : 'SignalR unavailable. Using HTTP fallback polling.';
  }

  if (transportIndicator) {
    transportIndicator.className = usingSignalR ? 'badge badge-info' : 'badge badge-warning';
    transportIndicator.textContent = usingSignalR ? 'SignalR' : 'HTTP Fallback';
    transportIndicator.title = usingSignalR
      ? 'Realtime transport: SignalR (WebSocket/SSE/LongPolling negotiation).'
      : 'Realtime transport: HTTP polling fallback (15s interval).';
  }
}

async function handleAlertRealtime(eventType, payload) {
  const eventKey = buildAlertRealtimeEventKey(eventType, payload);
  if (processedAlertRealtimeEventKeys.has(eventKey)) {
    return;
  }

  markAlertRealtimeEventAsProcessed(eventKey);

  const alertId = extractAlertId(payload);
  const fallbackStatus =
    eventType === 'resolved'
      ? 'Resolved'
      : eventType === 'acknowledged'
        ? 'Acknowledged'
        : 'Pending';
  const nextStatus = extractAlertStatus(payload, fallbackStatus);

  if (eventType === 'acknowledged' || eventType === 'resolved') {
    updateAlertCardVisualStatus(alertId, nextStatus);
  }

  try {
    const alertsData = await loadDashboardAlertsData(getSelectedOwnerIdForDashboard());
    const alertsPage = alertsData.page;
    const alertSummary = alertsData.summary;
    const alerts = alertsPage.items || [];

    updateAlertsSection(alerts);
    renderAlertsDistributionChart(alertSummary, alerts);

    const alertStat = $('#stat-alerts');
    if (alertStat) {
      alertStat.textContent = String(resolvePendingAlertsTotal(alertSummary, alertsPage));
    }

    updateStatSubtextsFromData({
      ...dashboardSubtextState,
      pendingAlerts: alerts,
      newPendingInWindowCount: Number(alertSummary?.newPendingInWindowCount || 0)
    });
  } catch (error) {
    console.warn(
      '[DashboardAlertsRealtime] Failed to refresh pending alerts after AlertHub event.',
      {
        hub: DASHBOARD_ALERTS_REALTIME_CONTEXT.hub,
        route: '/api/alerts/pending',
        error
      }
    );
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
