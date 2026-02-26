/**
 * TC Agro Solutions - Alerts Page Entry Point
 */

import {
  getPendingAlertsPage,
  getPendingAlertsSummary,
  initAlertSignalRConnection,
  joinAlertOwnerGroup,
  leaveAlertOwnerGroup,
  stopAlertSignalRConnection,
  resolveAlert
} from './api.js';
import { initProtectedPage } from './common.js';
import { toast } from './i18n.js';
import { createFallbackPoller } from './realtime-fallback.js';
import {
  $,
  $$,
  formatDate,
  formatRelativeTime,
  getUser,
  getPaginatedTotalCount,
  getPaginatedPageNumber,
  getPaginatedPageSize
} from './utils.js';

// ============================================
// PAGE INITIALIZATION
// ============================================

let currentFilter = 'pending';
let latestPendingAlerts = [];
let latestSummary = null;
let ownerGroupJoined = false;
let ownerScopeId = null;
let searchTerm = '';
let severityFilter = '';
let statusFilter = '';
let isAlertsLoading = false;
let hasPendingAlertsReload = false;
let lastSyncTimestampIso = null;
let syncIndicatorIntervalId = null;
let alertIdPendingResolution = null;
let alertPendingDetails = null;

const ALERTS_PAGE_SIZE_DEFAULT = 10;
const ALERTS_PAGE_SIZE_OPTIONS = [5, 10, 20, 30, 40, 50, 100];

const alertsViewState = {
  pageNumber: 1,
  pageSize: ALERTS_PAGE_SIZE_DEFAULT,
  totalCount: 0,
  totalPages: 1,
  hasPreviousPage: false,
  hasNextPage: false
};

const fallbackPoller = createFallbackPoller({
  refresh: refreshAlertsFromHttp,
  intervalMs: 15000,
  context: 'AlertsRealtime',
  connection: {
    page: 'alerts',
    hub: '/dashboard/alertshub',
    events: ['alertCreated', 'alertAcknowledged', 'alertResolved'],
    fallbackRoutes: ['/api/alerts/pending', '/api/alerts/pending/summary']
  },
  onError: (error) => {
    console.warn('[AlertsRealtime] HTTP fallback refresh failed.', error);
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  if (!initProtectedPage()) {
    return;
  }

  hydrateInitialAlertsViewState();
  setupAlertDialogs();
  await loadAlertsData();
  await setupAlertRealtime();
  setupEventListeners();

  syncIndicatorIntervalId = setInterval(() => {
    refreshAlertHeaderSyncIndicator();
    refreshAlertRelativeTimes();
  }, 30000);
});

window.addEventListener('beforeunload', async () => {
  if (ownerGroupJoined) {
    try {
      await leaveAlertOwnerGroup(ownerScopeId);
    } catch (error) {
      console.warn(`Failed to leave alert owner group ${ownerScopeId}:`, error);
    }
  }

  fallbackPoller.stop('page-unload', { silent: true });
  stopAlertSignalRConnection();

  if (syncIndicatorIntervalId) {
    clearInterval(syncIndicatorIntervalId);
    syncIndicatorIntervalId = null;
  }
});

// ============================================
// DATA LOADING
// ============================================

async function loadAlertsData() {
  if (isAlertsLoading) {
    hasPendingAlertsReload = true;
    return;
  }

  const selectedOwnerId = getSelectedOwnerIdForAlerts();
  const container = $('#alerts-container');
  const hasRenderedAlerts = Boolean(container?.querySelector('.alert-item'));

  isAlertsLoading = true;
  setAlertsLoadingState(true);

  if (!hasRenderedAlerts && container) {
    container.innerHTML = '<div class="loading">Loading alerts...</div>';
  }

  try {
    const requestedStatus = getRequestedAlertStatus();

    const [alertsPage, summary] = await Promise.all([
      getPendingAlertsPage({
        ownerId: selectedOwnerId,
        pageNumber: alertsViewState.pageNumber,
        pageSize: alertsViewState.pageSize,
        status: requestedStatus,
        severity: severityFilter || null,
        search: searchTerm || null
      }),
      getPendingAlertsSummary({ ownerId: selectedOwnerId, windowHours: 24 })
    ]);

    applyAlertsPageState(alertsPage);

    if (alertsViewState.totalCount > 0 && alertsViewState.pageNumber > alertsViewState.totalPages) {
      alertsViewState.pageNumber = alertsViewState.totalPages;
      hasPendingAlertsReload = true;
      return;
    }

    latestPendingAlerts = Array.isArray(alertsPage?.items) ? alertsPage.items : [];
    latestSummary = summary;

    renderStats(summary);
    renderAlertsForCurrentFilter();
    await updateTabCountsFromBackend();
    updateLastAlertsSyncTimestamp();
    persistAlertsViewStateToUrl();
  } finally {
    isAlertsLoading = false;
    setAlertsLoadingState(false);

    if (hasPendingAlertsReload) {
      hasPendingAlertsReload = false;
      void loadAlertsData();
    }
  }
}

function hydrateInitialAlertsViewState() {
  const params = new URLSearchParams(window.location.search);

  const tab = String(params.get('tab') || 'pending')
    .trim()
    .toLowerCase();
  const allowedTabs = ['pending', 'resolved', 'all'];
  currentFilter = allowedTabs.includes(tab) ? tab : 'pending';

  searchTerm = String(params.get('search') || '').trim();
  severityFilter = normalizeAlertSeverityFilter(params.get('severity') || '');
  statusFilter = normalizeAlertStatusFilter(params.get('status') || '');
  const pageNumber = Number(params.get('page') || 1);
  const pageSize = Number(params.get('pageSize') || ALERTS_PAGE_SIZE_DEFAULT);

  alertsViewState.pageNumber = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;
  alertsViewState.pageSize = ALERTS_PAGE_SIZE_OPTIONS.includes(pageSize)
    ? pageSize
    : ALERTS_PAGE_SIZE_DEFAULT;

  const searchInput = $('#search-alerts');
  if (searchInput) {
    searchInput.value = searchTerm;
  }

  const severitySelect = $('#alerts-severity-filter');
  if (severitySelect) {
    severitySelect.value = severityFilter;
  }

  const statusSelect = $('#alerts-status-filter');
  if (statusSelect) {
    statusSelect.value = statusFilter;
  }

  const pageSizeSelect = $('#alerts-page-size');
  if (pageSizeSelect) {
    pageSizeSelect.innerHTML = ALERTS_PAGE_SIZE_OPTIONS.map(
      (size) => `<option value="${size}">${size} / page</option>`
    ).join('');
    pageSizeSelect.value = String(alertsViewState.pageSize);
  }

  const tabs = $$('[data-tab]');
  tabs.forEach((tabButton) => {
    tabButton.classList.toggle('active', tabButton.dataset.tab === currentFilter);
  });
}

function persistAlertsViewStateToUrl() {
  const url = new URL(window.location.href);
  const params = url.searchParams;

  if (currentFilter && currentFilter !== 'pending') {
    params.set('tab', currentFilter);
  } else {
    params.delete('tab');
  }

  if (searchTerm) {
    params.set('search', searchTerm);
  } else {
    params.delete('search');
  }

  if (severityFilter) {
    params.set('severity', severityFilter);
  } else {
    params.delete('severity');
  }

  if (statusFilter) {
    params.set('status', statusFilter);
  } else {
    params.delete('status');
  }

  if (alertsViewState.pageNumber > 1) {
    params.set('page', String(alertsViewState.pageNumber));
  } else {
    params.delete('page');
  }

  if (alertsViewState.pageSize !== ALERTS_PAGE_SIZE_DEFAULT) {
    params.set('pageSize', String(alertsViewState.pageSize));
  } else {
    params.delete('pageSize');
  }

  const next = `${url.pathname}${params.toString() ? `?${params.toString()}` : ''}${url.hash}`;
  window.history.replaceState({}, '', next);
}

async function refreshAlertsFromHttp() {
  try {
    await loadAlertsData();
  } catch (error) {
    console.warn('[AlertsRealtime] Failed to refresh alerts from HTTP.', error);
  }
}

async function setupAlertRealtime() {
  const connection = await initAlertSignalRConnection({
    onAlertCreated: () => void loadAlertsData(),
    onAlertAcknowledged: () => void loadAlertsData(),
    onAlertResolved: () => void loadAlertsData(),
    onConnectionChange: handleConnectionChange
  });

  if (!connection || connection.isMock) {
    fallbackPoller.start('initial-connect-failed');
    return;
  }

  ownerScopeId = getOwnerScopeForAlerts();
  ownerGroupJoined = await joinAlertOwnerGroup(ownerScopeId);
}

function handleConnectionChange(state) {
  if (state === 'connected') {
    fallbackPoller.stop('signalr-restored');
    return;
  }

  if (state === 'reconnecting' || state === 'disconnected') {
    fallbackPoller.start(state);
  }
}

function renderAlertsForCurrentFilter() {
  const container = $('#alerts-container');
  if (!container) return;

  try {
    renderAlerts(latestPendingAlerts, currentFilter);
    renderPaginationControls();
    persistAlertsViewStateToUrl();
  } catch (error) {
    console.error('Error loading alerts:', error);
    container.innerHTML = '<div class="error">Error loading alerts</div>';
    toast('alerts.load_failed', 'error');
  }
}

function renderAlerts(alerts, activeFilter) {
  const container = $('#alerts-container');
  if (!container) return;

  if (!alerts.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✅</div>
        <p>No alerts ${activeFilter === 'pending' ? 'pending' : 'available'}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = alerts
    .map((alert) => {
      const normalizedSeverity = normalizeAlertSeverity(alert?.severity);
      const normalizedStatus = normalizeAlertStatus(alert?.status);

      return `
    <div class="alert-item ${normalizedSeverity}" data-alert-id="${alert.id}">
      <div class="alert-item-icon">${getSeverityIcon(normalizedSeverity)}</div>
      <div class="alert-item-content">
        <div class="alert-item-header">
          <span class="badge ${getSeverityBadgeClass(normalizedSeverity)}">${formatSeverity(normalizedSeverity)}</span>
          <span class="alert-item-time" data-alert-time="${alert.createdAt || ''}" title="${formatDate(alert.createdAt)}">
            ${formatRelativeTime(alert.createdAt)}
          </span>
        </div>

        <h4 class="alert-item-title">${alert.title || alert.alertType || 'Alert'}</h4>
        <p class="alert-item-description">${alert.message || '-'}</p>

        <div class="alert-item-meta">
          <span>📍 ${alert.plotName || '-'}</span>
          <span>📡 ${alert.sensorId || '-'}</span>
        </div>

        <div class="alert-item-actions">
        ${
          normalizedStatus === 'pending'
            ? `
          <button class="btn btn-success btn-sm" data-action="resolve" data-id="${alert.id}">
            ✅ Resolve
          </button>
        `
            : `
          <span class="text-muted" style="font-size: 0.9em">
            Resolved on ${alert.resolvedAt ? formatDate(alert.resolvedAt) : '-'}
          </span>
        `
        }
          <button class="btn btn-outline btn-sm" data-action="details" data-id="${alert.id}">
          📋 Details
        </button>
        </div>
      </div>
    </div>
  `;
    })
    .join('');

  refreshAlertRelativeTimes();
}

async function updateTabCountsFromBackend() {
  const pendingTabBadge = $('[data-tab="pending"] .badge');
  const resolvedTabBadge = $('[data-tab="resolved"] .badge');
  const allTabBadge = $('[data-tab="all"] .badge');

  const ownerId = getSelectedOwnerIdForAlerts();
  const severity = severityFilter || null;
  const search = searchTerm || null;
  const getCount = (status) =>
    getPendingAlertsPage({
      ownerId,
      pageNumber: 1,
      pageSize: 1,
      status,
      severity,
      search
    })
      .then((response) => Number(response?.totalCount || 0))
      .catch(() => 0);

  const [pendingCount, resolvedCount, allCount] = await Promise.all([
    getCount('pending'),
    getCount('resolved'),
    getCount('all')
  ]);

  if (pendingTabBadge) {
    pendingTabBadge.textContent = String(pendingCount);
  }

  if (resolvedTabBadge) {
    resolvedTabBadge.textContent = String(resolvedCount);
  }

  if (allTabBadge) {
    allTabBadge.textContent = String(allCount);
  }
}

function renderStats(summary, alertsOverride = null) {
  const usingOverride = Array.isArray(alertsOverride);

  const critical = usingOverride
    ? alertsOverride.filter((alert) => normalizeAlertSeverity(alert?.severity) === 'critical')
        .length
    : Number(summary?.criticalPendingCount || 0);
  const warning = usingOverride
    ? alertsOverride.filter((alert) => normalizeAlertSeverity(alert?.severity) === 'warning').length
    : Number(summary?.highPendingCount || 0) + Number(summary?.mediumPendingCount || 0);
  const info = usingOverride
    ? alertsOverride.filter((alert) => normalizeAlertSeverity(alert?.severity) === 'info').length
    : Number(summary?.lowPendingCount || 0);

  const pendingTotal = usingOverride
    ? alertsOverride.length
    : Number(summary?.pendingAlertsTotal || latestPendingAlerts.length || 0);
  const resolvedToday = 0;

  const statCritical = $('#alerts-stat-critical');
  const statWarning = $('#alerts-stat-warning');
  const statInfo = $('#alerts-stat-info');
  const statResolved = $('#alerts-stat-resolved-today');
  const navPendingBadge = $('#alerts-nav-pending-count');

  if (statCritical) statCritical.textContent = String(critical);
  if (statWarning) statWarning.textContent = String(warning);
  if (statInfo) statInfo.textContent = String(info);
  if (statResolved) statResolved.textContent = String(resolvedToday);
  if (navPendingBadge) navPendingBadge.textContent = String(pendingTotal);
}

function setAlertsLoadingState(isLoading) {
  const refreshButton = $('#refresh-alerts');
  const indicator = $('#alerts-updating-indicator');
  const container = $('#alerts-container');
  const hasCards = Boolean(container?.querySelector('.alert-item'));
  const previousButton = $('#alerts-prev-page');
  const nextButton = $('#alerts-next-page');
  const pageSizeSelect = $('#alerts-page-size');

  if (refreshButton) {
    refreshButton.disabled = isLoading;
    refreshButton.textContent = isLoading ? '⟳ Updating...' : '⟳ Refresh';
  }

  if (indicator) {
    indicator.style.display = 'inline';
    if (isLoading) {
      indicator.textContent = '⟳ Updating data...';
    } else {
      refreshAlertHeaderSyncIndicator();
    }
  }

  if (container && hasCards) {
    container.style.opacity = isLoading ? '0.78' : '1';
    container.style.transition = 'opacity 0.2s ease';
  }

  if (previousButton) previousButton.disabled = isLoading || !alertsViewState.hasPreviousPage;
  if (nextButton) nextButton.disabled = isLoading || !alertsViewState.hasNextPage;
  if (pageSizeSelect) pageSizeSelect.disabled = isLoading;
}

function updateLastAlertsSyncTimestamp(timestamp = null) {
  lastSyncTimestampIso = timestamp || new Date().toISOString();
  refreshAlertHeaderSyncIndicator();
}

function refreshAlertHeaderSyncIndicator() {
  const indicator = $('#alerts-updating-indicator');
  if (!indicator) {
    return;
  }

  if (!lastSyncTimestampIso) {
    indicator.textContent = 'Updated just now';
    return;
  }

  indicator.textContent = `✓ Updated ${formatRelativeTime(lastSyncTimestampIso)}`;
}

function refreshAlertRelativeTimes() {
  const timeNodes = $$('[data-alert-time]');
  timeNodes.forEach((node) => {
    const rawTime = node.getAttribute('data-alert-time');
    if (!rawTime) {
      return;
    }

    node.textContent = formatRelativeTime(rawTime);
    node.title = formatDate(rawTime);
  });
}

function getRequestedAlertStatus() {
  const normalizedStatusFilter = normalizeAlertStatusFilter(statusFilter);
  if (normalizedStatusFilter) {
    return normalizedStatusFilter;
  }

  if (currentFilter === 'resolved') {
    return 'resolved';
  }

  if (currentFilter === 'all') {
    return 'all';
  }

  return 'pending';
}

function applyAlertsPageState(alertsPage) {
  const totalCount = getPaginatedTotalCount(alertsPage, 0);
  const pageSizeFromResponse = getPaginatedPageSize(alertsPage, alertsViewState.pageSize);
  const pageNumberFromResponse = getPaginatedPageNumber(alertsPage, alertsViewState.pageNumber);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSizeFromResponse));

  alertsViewState.totalCount = totalCount;
  alertsViewState.pageSize = pageSizeFromResponse;
  alertsViewState.pageNumber = Math.min(Math.max(pageNumberFromResponse, 1), totalPages);
  alertsViewState.totalPages = totalPages;
  alertsViewState.hasPreviousPage = alertsViewState.pageNumber > 1;
  alertsViewState.hasNextPage = alertsViewState.pageNumber < totalPages;
}

function renderPaginationControls() {
  const info = $('#alerts-page-info');
  const previousButton = $('#alerts-prev-page');
  const nextButton = $('#alerts-next-page');

  if (info) {
    const total = alertsViewState.totalCount;
    const from = total === 0 ? 0 : (alertsViewState.pageNumber - 1) * alertsViewState.pageSize + 1;
    const to = Math.min(total, alertsViewState.pageNumber * alertsViewState.pageSize);

    info.textContent = `Showing ${from}-${to} of ${total} (Page ${alertsViewState.pageNumber}/${alertsViewState.totalPages})`;
  }

  if (previousButton) {
    previousButton.disabled = !alertsViewState.hasPreviousPage;
  }

  if (nextButton) {
    nextButton.disabled = !alertsViewState.hasNextPage;
  }
}

function normalizeAlertSeverity(severity) {
  const normalized = String(severity || '')
    .trim()
    .toLowerCase();

  if (normalized === 'critical' || normalized === 'high') {
    return 'critical';
  }

  if (normalized === 'warning' || normalized === 'medium') {
    return 'warning';
  }

  return 'info';
}

function normalizeAlertStatus(status) {
  const normalized = String(status || '')
    .trim()
    .toLowerCase();
  if (normalized === 'resolved' || normalized === 'acknowledged') {
    return normalized;
  }

  return 'pending';
}

function normalizeAlertSeverityFilter(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  if (normalized === 'critical' || normalized === 'warning' || normalized === 'info') {
    return normalized;
  }

  return '';
}

function normalizeAlertStatusFilter(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  if (normalized === 'pending' || normalized === 'acknowledged' || normalized === 'resolved') {
    return normalized;
  }

  return '';
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

function getOwnerScopeForAlerts() {
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

function getSelectedOwnerIdForAlerts() {
  return getOwnerScopeForAlerts();
}

// ============================================
// HELPERS
// ============================================

function getSeverityIcon(severity) {
  const icons = {
    critical: '🚨',
    warning: '⚠️',
    info: 'ℹ️'
  };
  return icons[severity] || 'ℹ️';
}

function formatSeverity(severity) {
  const labels = {
    critical: 'Critical',
    warning: 'Warning',
    info: 'Info'
  };
  return labels[severity] || severity;
}

function getSeverityBadgeClass(severity) {
  if (severity === 'critical') return 'badge-danger';
  if (severity === 'warning') return 'badge-warning';
  return 'badge-info';
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  const tabs = $$('[data-tab]');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      currentFilter = tab.dataset.tab;
      alertsViewState.pageNumber = 1;
      persistAlertsViewStateToUrl();
      void loadAlertsData();
    });
  });

  const refreshButton = $('#refresh-alerts');
  refreshButton?.addEventListener('click', async () => {
    await loadAlertsData();
  });

  const container = $('#alerts-container');
  container?.addEventListener('click', async (e) => {
    const resolveBtn = e.target.closest('[data-action="resolve"]');
    if (resolveBtn) {
      await handleResolve(resolveBtn.dataset.id);
      return;
    }

    const detailsBtn = e.target.closest('[data-action="details"]');
    if (detailsBtn) {
      handleDetails(detailsBtn.dataset.id);
    }
  });

  const searchInput = $('#search-alerts');
  let searchDebounceTimer = null;
  searchInput?.addEventListener('input', (e) => {
    searchTerm = String(e?.target?.value || '').trim();
    alertsViewState.pageNumber = 1;
    persistAlertsViewStateToUrl();

    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    searchDebounceTimer = setTimeout(() => {
      void loadAlertsData();
    }, 250);
  });

  const severitySelect = $('#alerts-severity-filter');
  severitySelect?.addEventListener('change', () => {
    severityFilter = normalizeAlertSeverityFilter(severitySelect.value);
    alertsViewState.pageNumber = 1;
    persistAlertsViewStateToUrl();
    void loadAlertsData();
  });

  const statusSelect = $('#alerts-status-filter');
  statusSelect?.addEventListener('change', () => {
    statusFilter = normalizeAlertStatusFilter(statusSelect.value);
    alertsViewState.pageNumber = 1;
    persistAlertsViewStateToUrl();
    void loadAlertsData();
  });

  const clearFiltersButton = $('#clear-alert-filters');
  clearFiltersButton?.addEventListener('click', () => {
    searchTerm = '';
    severityFilter = '';
    statusFilter = '';
    alertsViewState.pageNumber = 1;

    if (searchInput) {
      searchInput.value = '';
    }

    if (severitySelect) {
      severitySelect.value = '';
    }

    if (statusSelect) {
      statusSelect.value = '';
    }

    persistAlertsViewStateToUrl();
    void loadAlertsData();
  });

  const previousButton = $('#alerts-prev-page');
  previousButton?.addEventListener('click', () => {
    if (!alertsViewState.hasPreviousPage) {
      return;
    }

    alertsViewState.pageNumber -= 1;
    persistAlertsViewStateToUrl();
    void loadAlertsData();
  });

  const nextButton = $('#alerts-next-page');
  nextButton?.addEventListener('click', () => {
    if (!alertsViewState.hasNextPage) {
      return;
    }

    alertsViewState.pageNumber += 1;
    persistAlertsViewStateToUrl();
    void loadAlertsData();
  });

  const pageSizeSelect = $('#alerts-page-size');
  pageSizeSelect?.addEventListener('change', () => {
    const nextSize = Number(pageSizeSelect.value || ALERTS_PAGE_SIZE_DEFAULT);
    alertsViewState.pageSize = ALERTS_PAGE_SIZE_OPTIONS.includes(nextSize)
      ? nextSize
      : ALERTS_PAGE_SIZE_DEFAULT;
    alertsViewState.pageNumber = 1;
    persistAlertsViewStateToUrl();
    void loadAlertsData();
  });
}

async function handleResolve(alertId) {
  const alert = getAlertById(alertId);
  if (!alert) {
    toast('Alert not found in current list.', 'warning');
    return;
  }

  openResolveAlertDialog(alert);
}

function handleDetails(alertId) {
  const alert = getAlertById(alertId);
  if (!alert) {
    toast('Alert details unavailable for this item.', 'warning');
    return;
  }

  openAlertDetailsDialog(alert);
}

function setupAlertDialogs() {
  const resolveModal = $('#resolve-alert-modal');
  const detailsModal = $('#alert-details-modal');
  const resolveCloseButton = $('#resolve-alert-modal-close');
  const resolveCancelButton = $('#resolve-alert-cancel');
  const resolveConfirmButton = $('#resolve-alert-confirm');
  const detailsResolveButton = $('#alert-details-resolve');
  const detailsCloseButton = $('#alert-details-close');
  const detailsHeaderCloseButton = $('#alert-details-modal-close');

  const closeResolve = () => closeModal(resolveModal);
  const closeDetails = () => closeModal(detailsModal);

  resolveCloseButton?.addEventListener('click', closeResolve);
  resolveCancelButton?.addEventListener('click', closeResolve);
  resolveConfirmButton?.addEventListener('click', () => {
    void submitResolveAlert();
  });

  detailsResolveButton?.addEventListener('click', () => {
    const alert = alertPendingDetails;
    if (!alert) {
      toast('No alert selected to resolve.', 'warning');
      return;
    }

    closeDetails();
    openResolveAlertDialog(alert);
  });

  detailsCloseButton?.addEventListener('click', closeDetails);
  detailsHeaderCloseButton?.addEventListener('click', closeDetails);

  resolveModal?.addEventListener('click', (event) => {
    if (event.target === resolveModal) {
      closeResolve();
    }
  });

  detailsModal?.addEventListener('click', (event) => {
    if (event.target === detailsModal) {
      closeDetails();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }

    if (resolveModal?.classList.contains('open')) {
      closeResolve();
    }

    if (detailsModal?.classList.contains('open')) {
      closeDetails();
    }
  });
}

function openResolveAlertDialog(alert) {
  const modal = $('#resolve-alert-modal');
  const summary = $('#resolve-alert-summary');
  const notesField = $('#resolve-alert-notes');
  if (!modal || !summary || !notesField) {
    return;
  }

  const alertId = String(alert?.id || '').trim();
  if (!alertId) {
    toast('Invalid alert selected.', 'warning');
    return;
  }

  alertIdPendingResolution = alertId;
  notesField.value = '';

  const ownerScope = getSelectedOwnerIdForAlerts();
  const scopeLabel = ownerScope ? `Owner scope: ${ownerScope}` : 'Owner scope: current user';

  summary.textContent = `${alert?.title || alert?.alertType || 'Alert'} • ${scopeLabel}`;
  setResolveDialogBusy(false);
  openModal(modal);
  notesField.focus();
}

async function submitResolveAlert() {
  const alertId = String(alertIdPendingResolution || '').trim();
  if (!alertId) {
    toast('No alert selected to resolve.', 'warning');
    return;
  }

  const notesField = $('#resolve-alert-notes');
  const notes = String(notesField?.value || '').trim();
  if (notes.length > 1000) {
    toast('Resolution notes must be up to 1000 characters.', 'warning');
    return;
  }

  setResolveDialogBusy(true);
  try {
    await resolveAlert(alertId, notes || null);
    closeModal($('#resolve-alert-modal'));
    toast('alerts.resolve_success', 'success');

    latestPendingAlerts = latestPendingAlerts.filter(
      (alert) => String(alert?.id) !== String(alertId)
    );
    renderStats(latestSummary);
    renderAlertsForCurrentFilter();
    setTimeout(() => void loadAlertsData(), 350);
  } catch (error) {
    console.error('Error resolving alert:', error);
    const backendMessage =
      error?.response?.data?.message ||
      error?.response?.data?.detail ||
      (Array.isArray(error?.response?.data?.errors) && error.response.data.errors[0]?.reason) ||
      null;

    toast(backendMessage || 'alerts.resolve_failed', 'error');
  } finally {
    setResolveDialogBusy(false);
  }
}

function setResolveDialogBusy(isBusy) {
  const confirmButton = $('#resolve-alert-confirm');
  const cancelButton = $('#resolve-alert-cancel');
  const closeButton = $('#resolve-alert-modal-close');
  const notesField = $('#resolve-alert-notes');

  if (confirmButton) {
    confirmButton.disabled = isBusy;
    confirmButton.textContent = isBusy ? 'Resolving...' : 'Resolve';
  }

  if (cancelButton) {
    cancelButton.disabled = isBusy;
  }

  if (closeButton) {
    closeButton.disabled = isBusy;
  }

  if (notesField) {
    notesField.disabled = isBusy;
  }
}

function openAlertDetailsDialog(alert) {
  const modal = $('#alert-details-modal');
  const content = $('#alert-details-content');
  const resolveButton = $('#alert-details-resolve');
  if (!modal || !content) {
    return;
  }

  const createdAt = alert?.createdAt;
  const acknowledgedAt = alert?.acknowledgedAt;
  const resolvedAt = alert?.resolvedAt;
  const normalizedSeverity = normalizeAlertSeverity(alert?.severity);
  const normalizedStatus = normalizeAlertStatus(alert?.status);
  alertPendingDetails = alert;

  const rows = [
    ['Alert ID', alert?.id],
    ['Type', alert?.alertType || alert?.title || '-'],
    ['Status', normalizedStatus],
    ['Severity', normalizedSeverity],
    ['Message', alert?.message || '-'],
    ['Sensor', formatDiagnosticText(alert?.sensorId)],
    ['Plot', formatDiagnosticText(alert?.plotName)],
    ['Property', formatDiagnosticText(alert?.propertyName)],
    ['Value', formatMaybeNumber(alert?.value)],
    ['Threshold', formatMaybeNumber(alert?.threshold)],
    ['Created At', formatDiagnosticDate(createdAt)],
    ['Acknowledged At', formatDiagnosticDate(acknowledgedAt)],
    ['Resolved At', formatDiagnosticDate(resolvedAt)],
    ['Resolved By', formatDiagnosticText(alert?.resolvedBy)],
    ['Resolution Notes', formatDiagnosticText(alert?.resolutionNotes)]
  ];

  content.innerHTML = `
    <div class="table-container" style="box-shadow: none; margin: 0">
      <table class="table">
        <tbody>
          ${rows
            .map(
              ([label, value]) => `
            <tr>
              <th style="width: 170px">${escapeHtml(label)}</th>
              <td>${escapeHtml(value ?? '-')}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  if (resolveButton) {
    const canResolve = normalizedStatus === 'pending';
    resolveButton.style.display = canResolve ? 'inline-flex' : 'none';
  }

  openModal(modal);
}

function getAlertById(alertId) {
  const normalizedId = String(alertId || '').trim();
  if (!normalizedId) {
    return null;
  }

  return (
    latestPendingAlerts.find((alert) => String(alert?.id || '').trim() === normalizedId) || null
  );
}

function openModal(modal) {
  if (!modal) {
    return;
  }

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
  if (!modal) {
    return;
  }

  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');

  if (modal.id === 'resolve-alert-modal') {
    alertIdPendingResolution = null;
    setResolveDialogBusy(false);
  }

  if (modal.id === 'alert-details-modal') {
    alertPendingDetails = null;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatMaybeNumber(value) {
  if (value === undefined) {
    return '(field missing in API payload)';
  }

  if (value === null) {
    return '(not provided)';
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return '(not provided)';
  }

  return parsed % 1 === 0 ? String(parsed) : parsed.toFixed(2);
}

function formatDiagnosticText(value) {
  if (value === undefined) {
    return '(field missing in API payload)';
  }

  if (value === null) {
    return '(not provided)';
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : '(not provided)';
}

function formatDiagnosticDate(value) {
  if (value === undefined) {
    return '(field missing in API payload)';
  }

  if (value === null) {
    return '(not provided)';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '(not provided)';
  }

  return formatDate(value);
}

// Export for debugging
if (import.meta.env.DEV) {
  window.alertsDebug = { loadAlertsData, handleResolve };
}
