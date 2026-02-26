/**
 * TC Agro Solutions - Sensors Page Entry Point
 */

import {
  getSensorsPaginated,
  getReadingsLatest,
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
  hydrateInitialViewState();
  await loadSensors();
  setupRealTimeUpdates();
  setupEventListeners();

  syncIndicatorIntervalId = setInterval(() => {
    refreshHeaderSyncIndicator();
  }, 30000);
});

// Cleanup on page unload
window.addEventListener('beforeunload', async () => {
  if (ownerGroupJoined) {
    try {
      await leaveOwnerGroup(lastJoinedOwnerScopeId ?? currentOwnerScopeId);
    } catch (error) {
      console.warn(
        `Failed to leave owner group ${lastJoinedOwnerScopeId ?? currentOwnerScopeId}:`,
        error
      );
    }
  }

  stopFallbackPollingSilently();

  stopSignalRConnection();

  if (syncIndicatorIntervalId) {
    clearInterval(syncIndicatorIntervalId);
    syncIndicatorIntervalId = null;
  }
});

// ============================================
// DATA LOADING
// ============================================

const MONITORING_PAGE_SIZE_DEFAULT = 50;
const MONITORING_PAGE_SIZE_OPTIONS = [50, 100];
const SUMMARY_REFRESH_INTERVAL_MS = 60000;

const monitoringViewState = {
  search: '',
  status: '',
  type: '',
  pageNumber: 1,
  pageSize: MONITORING_PAGE_SIZE_DEFAULT,
  totalCount: 0,
  totalPages: 1,
  hasPreviousPage: false,
  hasNextPage: false
};

let isSensorsLoading = false;
let hasPendingReload = false;
let cachedSummaryStats = null;
let cachedSummaryOwnerScope = null;
let summaryStatsLoadedAt = 0;
let lastSyncTimestampIso = null;
let syncIndicatorIntervalId = null;

function hydrateInitialViewState() {
  readViewStateFromUrl();

  const searchInput = $('#searchInput');
  if (searchInput) {
    searchInput.value = monitoringViewState.search;
  }

  const statusSelect = $('#statusFilter');
  if (statusSelect) {
    statusSelect.value = monitoringViewState.status;
  }

  const typeSelect = $('#typeFilter');
  if (typeSelect) {
    typeSelect.value = monitoringViewState.type;
  }

  const pageSizeSelect = $('#sensors-page-size');

  if (pageSizeSelect) {
    pageSizeSelect.innerHTML = MONITORING_PAGE_SIZE_OPTIONS.map(
      (size) => `<option value="${size}">${size} / page</option>`
    ).join('');
    pageSizeSelect.value = String(monitoringViewState.pageSize);
  }
}

function readViewStateFromUrl() {
  const params = new URLSearchParams(window.location.search);

  const search = String(params.get('search') || '').trim();
  const status = normalizeSensorStatus(params.get('status') || '');
  const type = String(params.get('type') || '').trim();
  const pageNumber = Number(params.get('page') || 1);
  const pageSize = Number(params.get('pageSize') || MONITORING_PAGE_SIZE_DEFAULT);

  monitoringViewState.search = search;
  monitoringViewState.status = status;
  monitoringViewState.type = type;
  monitoringViewState.pageNumber = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;
  monitoringViewState.pageSize = MONITORING_PAGE_SIZE_OPTIONS.includes(pageSize)
    ? pageSize
    : MONITORING_PAGE_SIZE_DEFAULT;
}

function persistViewStateToUrl() {
  const url = new URL(window.location.href);
  const params = url.searchParams;

  const setOrDelete = (key, value, defaultValue = '') => {
    const normalized = String(value ?? '');
    const normalizedDefault = String(defaultValue ?? '');
    if (!normalized || normalized === normalizedDefault) {
      params.delete(key);
      return;
    }

    params.set(key, normalized);
  };

  setOrDelete('search', monitoringViewState.search, '');
  setOrDelete('status', monitoringViewState.status, '');
  setOrDelete('type', monitoringViewState.type, '');
  setOrDelete('page', monitoringViewState.pageNumber, 1);
  setOrDelete('pageSize', monitoringViewState.pageSize, MONITORING_PAGE_SIZE_DEFAULT);

  const next = `${url.pathname}${params.toString() ? `?${params.toString()}` : ''}${url.hash}`;
  window.history.replaceState({}, '', next);
}

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

async function loadSensors({ forceSummaryRefresh = false } = {}) {
  if (isSensorsLoading) {
    hasPendingReload = true;
    return;
  }

  const grid = $('#sensors-grid');
  if (!grid) return;

  const hasRenderedCards = Boolean(grid.querySelector('.sensor-card'));

  isSensorsLoading = true;
  setSensorsLoadingState(true);

  if (!hasRenderedCards) {
    grid.innerHTML = '<div class="loading">Loading sensors...</div>';
  }

  try {
    const ownerId = getOwnerScopeIdForMonitoring();
    const [sensorsPage, latestReadings, summaryStats] = await Promise.all([
      getSensorsPaginated({
        pageNumber: monitoringViewState.pageNumber,
        pageSize: monitoringViewState.pageSize,
        sortBy: 'installedAt',
        sortDirection: 'desc',
        filter: monitoringViewState.search,
        ownerId: ownerId || '',
        type: monitoringViewState.type,
        status: monitoringViewState.status
      }),
      getReadingsLatest({
        pageNumber: 1,
        pageSize: 1000,
        ownerId: ownerId || null
      }).catch(() => []),
      getSummaryStatsWithCache(ownerId, forceSummaryRefresh)
    ]);

    const latestReadingsMap = new Map(
      (Array.isArray(latestReadings) ? latestReadings : [])
        .filter((reading) => reading?.sensorId)
        .map((reading) => [String(reading.sensorId).toLowerCase(), reading])
    );

    const rawItems = sensorsPage?.data || sensorsPage?.items || sensorsPage?.results || [];
    const sensors = rawItems.map((sensor) => mapSensorForMonitoring(sensor, latestReadingsMap));

    syncPaginationState(sensorsPage, sensors.length);
    renderSensorsGrid(sensors);
    updateStatusSummary(summaryStats || null);
    renderPaginationControls();
    updateLastSyncTimestamp();
    persistViewStateToUrl();
  } catch (error) {
    console.error('Error loading sensors:', error);
    if (!hasRenderedCards) {
      grid.innerHTML = `<div class="error">${t('sensors.load_failed')}</div>`;
    }
    toast('sensors.load_failed', 'error');
  } finally {
    isSensorsLoading = false;
    setSensorsLoadingState(false);

    if (hasPendingReload) {
      hasPendingReload = false;
      void loadSensors();
    }
  }
}

function setSensorsLoadingState(isLoading) {
  const refreshBtn = $('#refresh-sensors');
  const updatingIndicator = $('#sensors-updating-indicator');
  const previousButton = $('#sensors-prev-page');
  const nextButton = $('#sensors-next-page');
  const pageSizeSelect = $('#sensors-page-size');
  const grid = $('#sensors-grid');
  const pageInfo = $('#sensors-page-info');

  if (grid && grid.querySelector('.sensor-card')) {
    grid.style.opacity = isLoading ? '0.72' : '1';
    grid.style.transition = 'opacity 0.2s ease';
  }

  if (refreshBtn) {
    refreshBtn.disabled = isLoading;
    refreshBtn.textContent = isLoading ? '⟳ Updating...' : '⟳ Refresh';
  }

  if (updatingIndicator) {
    updatingIndicator.style.display = 'inline';
    if (isLoading) {
      updatingIndicator.textContent = '⟳ Updating data...';
    } else {
      refreshHeaderSyncIndicator();
    }
  }

  if (pageInfo && isLoading && monitoringViewState.totalCount > 0) {
    pageInfo.textContent = `Updating... (Page ${monitoringViewState.pageNumber}/${monitoringViewState.totalPages})`;
  }

  if (previousButton) previousButton.disabled = isLoading || !monitoringViewState.hasPreviousPage;
  if (nextButton) nextButton.disabled = isLoading || !monitoringViewState.hasNextPage;
  if (pageSizeSelect) pageSizeSelect.disabled = isLoading;
}

async function getSummaryStatsWithCache(ownerId, forceRefresh = false) {
  const now = Date.now();
  const ownerScope = ownerId || '__self__';
  const cacheValid =
    !forceRefresh &&
    cachedSummaryStats &&
    cachedSummaryOwnerScope === ownerScope &&
    now - summaryStatsLoadedAt < SUMMARY_REFRESH_INTERVAL_MS;

  if (cacheValid) {
    return cachedSummaryStats;
  }

  const summary = await loadSensorSummaryStats(ownerId);
  cachedSummaryStats = summary;
  cachedSummaryOwnerScope = ownerScope;
  summaryStatsLoadedAt = now;
  return summary;
}

function mapSensorForMonitoring(sensor, latestReadingsMap) {
  const sensorId = sensor?.id || sensor?.sensorId || sensor?.SensorId;
  const normalizedSensorId = String(sensorId || '').toLowerCase();
  const reading = latestReadingsMap.get(normalizedSensorId) || null;
  const timestamp = reading?.timestamp || reading?.time || reading?.Time || null;

  return {
    id: sensorId,
    sensorId,
    sensorLabel: sensor?.label || sensor?.sensorLabel || sensor?.name || null,
    type: sensor?.type || sensor?.sensorType || '',
    plotName: sensor?.plotName || reading?.plotName || '-',
    propertyName: sensor?.propertyName || reading?.propertyName || '-',
    status: sensor?.status || deriveSensorStatusFromTimestamp(timestamp),
    battery: reading?.batteryLevel ?? reading?.battery ?? null,
    lastReading: timestamp,
    temperature: reading?.temperature ?? null,
    humidity: reading?.humidity ?? null,
    soilMoisture: reading?.soilMoisture ?? null
  };
}

async function loadSensorSummaryStats(ownerId) {
  const baseQuery = {
    pageNumber: 1,
    pageSize: 1,
    sortBy: 'installedAt',
    sortDirection: 'desc',
    filter: '',
    ownerId: ownerId || '',
    type: ''
  };

  const [total, active, inactive, maintenance, faulty] = await Promise.all([
    getSensorsPaginated({ ...baseQuery }),
    getSensorsPaginated({ ...baseQuery, status: 'Active' }),
    getSensorsPaginated({ ...baseQuery, status: 'Inactive' }),
    getSensorsPaginated({ ...baseQuery, status: 'Maintenance' }),
    getSensorsPaginated({ ...baseQuery, status: 'Faulty' })
  ]);

  return {
    total: getPaginatedTotal(total),
    Active: getPaginatedTotal(active),
    Inactive: getPaginatedTotal(inactive),
    Maintenance: getPaginatedTotal(maintenance),
    Faulty: getPaginatedTotal(faulty)
  };
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

  const items = payload?.data || payload?.items || payload?.results || [];
  return Array.isArray(items) ? items.length : 0;
}

function syncPaginationState(payload, currentItemsCount) {
  const totalCount = getPaginatedTotal(payload);
  const totalPagesRaw = payload?.totalPages || payload?.TotalPages;
  const hasPreviousPageRaw = payload?.hasPreviousPage || payload?.HasPreviousPage;
  const hasNextPageRaw = payload?.hasNextPage || payload?.HasNextPage;

  monitoringViewState.totalCount = totalCount;
  monitoringViewState.totalPages =
    typeof totalPagesRaw === 'number' && totalPagesRaw > 0
      ? totalPagesRaw
      : Math.max(1, Math.ceil(totalCount / monitoringViewState.pageSize));
  monitoringViewState.hasPreviousPage =
    typeof hasPreviousPageRaw === 'boolean'
      ? hasPreviousPageRaw
      : monitoringViewState.pageNumber > 1;
  monitoringViewState.hasNextPage =
    typeof hasNextPageRaw === 'boolean'
      ? hasNextPageRaw
      : monitoringViewState.pageNumber < monitoringViewState.totalPages;

  if (currentItemsCount === 0 && monitoringViewState.pageNumber > 1) {
    monitoringViewState.pageNumber = 1;
  }
}

function renderPaginationControls() {
  const info = $('#sensors-page-info');
  const previousButton = $('#sensors-prev-page');
  const nextButton = $('#sensors-next-page');

  if (info) {
    const total = monitoringViewState.totalCount;
    const from =
      total === 0 ? 0 : (monitoringViewState.pageNumber - 1) * monitoringViewState.pageSize + 1;
    const to = Math.min(total, monitoringViewState.pageNumber * monitoringViewState.pageSize);

    info.textContent = `Showing ${from}-${to} of ${total} (Page ${monitoringViewState.pageNumber}/${monitoringViewState.totalPages})`;
  }

  if (previousButton) {
    previousButton.disabled = !monitoringViewState.hasPreviousPage;
  }

  if (nextButton) {
    nextButton.disabled = !monitoringViewState.hasNextPage;
  }
}

function deriveSensorStatusFromTimestamp(timestamp) {
  if (!timestamp) return 'Inactive';

  const ageMs = Date.now() - new Date(timestamp).getTime();
  if (Number.isNaN(ageMs)) return 'Inactive';
  if (ageMs <= 15 * 60 * 1000) return 'Active';
  if (ageMs <= 60 * 60 * 1000) return 'Maintenance';
  return 'Inactive';
}

function renderSensorsGrid(sensors) {
  const grid = $('#sensors-grid');
  if (!grid) return;

  if (!sensors.length) {
    grid.innerHTML = '<div class="empty">No sensors registered</div>';
    return;
  }

  grid.innerHTML = sensors.map((sensor) => createSensorCardHtml(sensor, sensor.status)).join('');
}

function getSensorDisplayName(sensor) {
  return sensor.sensorLabel || sensor.sensorId || sensor.id || '-';
}

function formatSensorLocation(sensor) {
  const plotName = sensor.plotName || '-';
  const propertyName = sensor.propertyName || '';
  return propertyName ? `${plotName} - ${propertyName}` : plotName;
}

/**
 * Update status summary KPI cards based on sensor array or rendered cards
 * @param {Array} [sensors] - Array of sensor objects. If not provided, counts from rendered cards
 */
function updateStatusSummary(summary = null) {
  let counts = {
    total: 0,
    Active: 0,
    Inactive: 0,
    Maintenance: 0,
    Faulty: 0
  };

  if (summary && typeof summary === 'object' && !Array.isArray(summary)) {
    counts = {
      total: Number(summary.total || 0),
      Active: Number(summary.Active || 0),
      Inactive: Number(summary.Inactive || 0),
      Maintenance: Number(summary.Maintenance || 0),
      Faulty: Number(summary.Faulty || 0)
    };
  } else if (Array.isArray(summary)) {
    counts.total = summary.length;
    summary.forEach((sensor) => {
      const normalized = normalizeSensorStatus(sensor.status);
      if (counts[normalized] !== undefined) {
        counts[normalized]++;
      }
    });
  } else {
    const cards = $$('.sensor-card');
    counts.total = cards.length;
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
let lastJoinedOwnerScopeId = null;
const processedRealtimeEventKeys = new Map();
const latestRealtimeTimestampBySensor = new Map();
const MAX_PROCESSED_REALTIME_EVENTS = 1000;
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
      handleRealtimeSensorReading(reading);
    },
    onSensorStatus: (data) => {
      const card = $(`[data-sensor-id="${data.sensorId}"]`);
      if (card) {
        const oldStatus = normalizeSensorStatus(card.dataset.status);
        const newStatus = normalizeSensorStatus(data.status);

        const badgeClass = getSensorStatusBadgeClass(newStatus);
        card.className = 'card sensor-card';
        card.style.cssText = getSensorCardStyle(newStatus);
        card.dataset.status = newStatus;

        const statusEl = card.querySelector('.badge');
        if (statusEl) {
          statusEl.className = `badge ${badgeClass}`;
          statusEl.textContent = getSensorStatusDisplay(newStatus);
        }

        if (oldStatus !== newStatus) {
          void loadSensors();
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
        void ensureOwnerGroupSubscription();
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
  if (isCurrentUserAdmin()) {
    const ownerId = new URLSearchParams(window.location.search).get('ownerId');
    return ownerId || null;
  }

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

async function ensureOwnerGroupSubscription() {
  if (realtimeConnectionState !== 'connected') {
    return;
  }

  currentOwnerScopeId = getOwnerScopeIdForMonitoring();

  if (isCurrentUserAdmin() && !currentOwnerScopeId) {
    ownerGroupJoined = false;
    console.warn(
      '[SensorsRealtime] Admin user without ownerId query param. Skipping owner-group subscription.'
    );
    fallbackPoller.start('admin-owner-scope-required');
    return;
  }

  if (isCurrentUserAdmin() && !isValidGuid(currentOwnerScopeId)) {
    ownerGroupJoined = false;
    console.warn(
      '[SensorsRealtime] Invalid ownerId query param. Skipping owner-group subscription.',
      {
        ownerId: currentOwnerScopeId
      }
    );
    fallbackPoller.start('admin-owner-scope-invalid');
    return;
  }

  if (ownerGroupJoined && lastJoinedOwnerScopeId === currentOwnerScopeId) {
    return;
  }

  if (
    ownerGroupJoined &&
    lastJoinedOwnerScopeId &&
    lastJoinedOwnerScopeId !== currentOwnerScopeId
  ) {
    await leaveOwnerGroup(lastJoinedOwnerScopeId);
  }

  ownerGroupJoined = await joinOwnerGroup(currentOwnerScopeId);

  if (!ownerGroupJoined) {
    console.warn('[SensorsRealtime] Failed to join owner group.', {
      ownerId: currentOwnerScopeId
    });
    fallbackPoller.start('owner-join-failed');
    return;
  }

  lastJoinedOwnerScopeId = currentOwnerScopeId;
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

function isValidGuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '').trim()
  );
}

function parseReadingTimestampMs(reading) {
  const parsed = new Date(reading?.timestamp || 0).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function buildRealtimeEventKey(reading) {
  return `${reading?.sensorId || 'unknown'}:${parseReadingTimestampMs(reading)}`;
}

function markRealtimeEventProcessed(eventKey) {
  processedRealtimeEventKeys.set(eventKey, Date.now());

  if (processedRealtimeEventKeys.size <= MAX_PROCESSED_REALTIME_EVENTS) {
    return;
  }

  const oldestKey = processedRealtimeEventKeys.keys().next().value;
  if (oldestKey) {
    processedRealtimeEventKeys.delete(oldestKey);
  }
}

function isReadingStale(reading) {
  const sensorId = reading?.sensorId;
  if (!sensorId) return true;

  const incomingTimestamp = parseReadingTimestampMs(reading);
  const previousTimestamp = latestRealtimeTimestampBySensor.get(sensorId) || 0;

  if (incomingTimestamp > 0 && incomingTimestamp < previousTimestamp) {
    return true;
  }

  if (incomingTimestamp > 0) {
    latestRealtimeTimestampBySensor.set(sensorId, incomingTimestamp);
  }

  return false;
}

function handleRealtimeSensorReading(reading) {
  const normalized = normalizeRealtimeReading(reading);
  if (!normalized.sensorId) {
    return;
  }

  const eventKey = buildRealtimeEventKey(normalized);
  if (processedRealtimeEventKeys.has(eventKey)) {
    return;
  }

  markRealtimeEventProcessed(eventKey);

  if (isReadingStale(normalized)) {
    return;
  }

  upsertSensorCard(normalized);
  updateLastSyncTimestamp(normalized.timestamp);
}

function updateLastSyncTimestamp(timestamp = null) {
  const target = $('#lastSync');
  if (!target) {
    return;
  }

  const value = timestamp || new Date().toISOString();
  lastSyncTimestampIso = value;
  target.textContent = formatRelativeTime(value);
  refreshHeaderSyncIndicator();
}

function refreshHeaderSyncIndicator() {
  const indicator = $('#sensors-updating-indicator');
  if (!indicator) {
    return;
  }

  if (!lastSyncTimestampIso) {
    indicator.textContent = 'Updated just now';
    return;
  }

  indicator.textContent = `✓ Updated ${formatRelativeTime(lastSyncTimestampIso)}`;
}

function createSensorCardHtml(sensor, status = 'Active') {
  const normalizedStatus = normalizeSensorStatus(status);
  const badgeClass = getSensorStatusBadgeClass(normalizedStatus);
  const cardStyle = getSensorCardStyle(normalizedStatus);

  return `
    <div class="card sensor-card" data-sensor-id="${sensor.id}" data-status="${normalizedStatus}" style="${cardStyle}">
      <div class="d-flex justify-between align-center" style="margin-bottom: 12px">
        <span class="badge ${badgeClass}">${getSensorStatusDisplay(normalizedStatus)}</span>
        <span class="text-muted last-update" style="font-size: 0.85em" title="${sensor.lastReading}">
          ${formatRelativeTime(sensor.lastReading)}
        </span>
      </div>

      <h3 class="sensor-id" style="margin: 0 0 4px 0">📡 ${getSensorDisplayName(sensor)}</h3>
      <p class="text-muted sensor-location" style="margin: 0 0 16px 0; font-size: 0.9em">
        ${formatSensorLocation(sensor)}
      </p>

      <div class="sensor-readings">
        <div class="sensor-reading">
          <span class="sensor-reading-label">🌡️ Temperature</span>
          <span class="sensor-reading-value" data-metric="temperature">
            ${formatTemperature(sensor.temperature)}
          </span>
        </div>
        <div class="sensor-reading">
          <span class="sensor-reading-label">💧 Humidity</span>
          <span class="sensor-reading-value" data-metric="humidity">
            ${formatPercentage(sensor.humidity)}
          </span>
        </div>
        <div class="sensor-reading">
          <span class="sensor-reading-label">🌱 Soil Moisture</span>
          <span class="sensor-reading-value" data-metric="soilMoisture">
            ${formatPercentage(sensor.soilMoisture)}
          </span>
        </div>
      </div>

      <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
        <span class="text-muted" style="font-size: 0.9em">🔋 ${formatPercentage(sensor.battery)}</span>
        <button class="btn btn-outline btn-sm" type="button">📊 View History</button>
      </div>
    </div>
  `;
}

function getSensorCardStyle(status) {
  if (status === 'Maintenance') return 'border-left: 4px solid #ffc107';
  if (status === 'Faulty') return 'border-left: 4px solid #dc3545; opacity: 0.85';
  if (status === 'Inactive') return 'border-left: 4px solid #adb5bd; opacity: 0.9';
  return '';
}

function upsertSensorCard(reading) {
  const sensorId = reading.sensorId;
  if (!sensorId) return;

  const existingCard = $(`[data-sensor-id="${sensorId}"]`);
  if (existingCard) {
    updateSensorCard(sensorId, reading);
  }
}

function updateSensorCard(sensorId, reading) {
  const card = $(`[data-sensor-id="${sensorId}"]`);
  if (!card) return;

  const headerEl = card.querySelector('.sensor-id');
  if (headerEl && reading.sensorLabel) {
    headerEl.textContent = `📡 ${reading.sensorLabel}`;
  }

  const plotEl = card.querySelector('.sensor-plot');
  if (plotEl) {
    plotEl.textContent = `📍 ${formatSensorLocation(reading)}`;
  }

  const locationEl = card.querySelector('.sensor-location');
  if (locationEl) {
    locationEl.textContent = formatSensorLocation(reading);
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
    const timestamp = reading.timestamp || new Date().toISOString();
    timeEl.textContent = formatRelativeTime(timestamp);
    timeEl.title = timestamp;
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  const refreshBtn = $('#refresh-sensors');
  refreshBtn?.addEventListener('click', async () => {
    await loadSensors({ forceSummaryRefresh: true });
    toast('sensors.updated', 'success');
  });

  const searchInput = $('#searchInput');
  let searchDebounceTimer = null;
  searchInput?.addEventListener('input', (event) => {
    monitoringViewState.search = String(event?.target?.value || '').trim();
    monitoringViewState.pageNumber = 1;
    persistViewStateToUrl();

    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    searchDebounceTimer = setTimeout(() => {
      void loadSensors();
    }, 250);
  });

  const statusFilter = $('#statusFilter');
  statusFilter?.addEventListener('change', () => {
    monitoringViewState.status = normalizeSensorStatus(statusFilter.value);
    monitoringViewState.pageNumber = 1;
    persistViewStateToUrl();
    void loadSensors();
  });

  const typeFilter = $('#typeFilter');
  typeFilter?.addEventListener('change', () => {
    monitoringViewState.type = String(typeFilter.value || '').trim();
    monitoringViewState.pageNumber = 1;
    persistViewStateToUrl();
    void loadSensors();
  });

  const pageSizeSelect = $('#sensors-page-size');
  pageSizeSelect?.addEventListener('change', () => {
    const nextSize = Number(pageSizeSelect.value || MONITORING_PAGE_SIZE_DEFAULT);
    monitoringViewState.pageSize = MONITORING_PAGE_SIZE_OPTIONS.includes(nextSize)
      ? nextSize
      : MONITORING_PAGE_SIZE_DEFAULT;
    monitoringViewState.pageNumber = 1;
    persistViewStateToUrl();
    void loadSensors();
  });

  const previousButton = $('#sensors-prev-page');
  previousButton?.addEventListener('click', () => {
    if (!monitoringViewState.hasPreviousPage) {
      return;
    }

    monitoringViewState.pageNumber -= 1;
    persistViewStateToUrl();
    void loadSensors();
  });

  const nextButton = $('#sensors-next-page');
  nextButton?.addEventListener('click', () => {
    if (!monitoringViewState.hasNextPage) {
      return;
    }

    monitoringViewState.pageNumber += 1;
    persistViewStateToUrl();
    void loadSensors();
  });
}

// Export for debugging
if (import.meta.env.DEV) {
  window.sensorsDebug = { loadSensors, updateSensorCard };
}
