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
import { $, $$, showConfirm, formatDate, formatRelativeTime, getUser } from './utils.js';

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
    const [alertsPage, summary] = await Promise.all([
      getPendingAlertsPage({ ownerId: selectedOwnerId, pageNumber: 1, pageSize: 500 }),
      getPendingAlertsSummary({ ownerId: selectedOwnerId, windowHours: 24 })
    ]);

    latestPendingAlerts = Array.isArray(alertsPage?.items) ? alertsPage.items : [];
    latestSummary = summary;

    renderStats(summary);
    renderAlertsForCurrentFilter();
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
    const alertsByTab = getAlertsForTab(currentFilter, {
      severity: severityFilter,
      status: statusFilter,
      search: searchTerm
    });

    renderAlerts(alertsByTab, currentFilter);
    renderStats(latestSummary, getAlertsForStats());
    updateTabCounts();
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
    const unavailableForFilter = activeFilter === 'resolved';
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✅</div>
        <p>${
          unavailableForFilter
            ? 'Resolved feed is not available on current API routes yet.'
            : `No alerts ${activeFilter === 'pending' ? 'pending' : 'available'}`
        }</p>
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

function updateTabCounts() {
  const pendingCount = getAlertsForTab('pending', {
    severity: severityFilter,
    status: statusFilter,
    search: searchTerm
  }).length;
  const resolvedCount = getAlertsForTab('resolved', {
    severity: severityFilter,
    status: statusFilter,
    search: searchTerm
  }).length;
  const allCount = getAlertsForTab('all', {
    severity: severityFilter,
    status: statusFilter,
    search: searchTerm
  }).length;

  const pendingTabBadge = $('[data-tab="pending"] .badge');
  const resolvedTabBadge = $('[data-tab="resolved"] .badge');
  const allTabBadge = $('[data-tab="all"] .badge');

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

function filterAlertsByCurrentTab(alerts, tab) {
  if (!Array.isArray(alerts)) {
    return [];
  }

  if (tab === 'pending' || tab === 'all') {
    return alerts;
  }

  return [];
}

function getAlertsForTab(tab, filters = {}) {
  const tabAlerts = filterAlertsByCurrentTab(latestPendingAlerts, tab);
  const filteredByAttributes = filterAlertsByAttributes(tabAlerts, {
    severity: filters.severity,
    status: filters.status
  });
  return filterAlertsBySearch(filteredByAttributes, filters.search || '');
}

function getAlertsForStats() {
  return getAlertsForTab('pending', {
    severity: severityFilter,
    status: statusFilter,
    search: searchTerm
  });
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

function filterAlertsByAttributes(alerts, filters) {
  if (!Array.isArray(alerts)) {
    return [];
  }

  const severity = normalizeAlertSeverityFilter(filters?.severity || '');
  const status = normalizeAlertStatusFilter(filters?.status || '');

  return alerts.filter((alert) => {
    const normalizedSeverity = normalizeAlertSeverity(alert?.severity);
    const normalizedStatus = normalizeAlertStatus(alert?.status);

    if (severity && normalizedSeverity !== severity) {
      return false;
    }

    if (status && normalizedStatus !== status) {
      return false;
    }

    return true;
  });
}

function filterAlertsBySearch(alerts, term) {
  if (!term) {
    return alerts;
  }

  const normalized = String(term).toLowerCase();
  return alerts.filter((alert) => {
    const text = [
      alert?.title,
      alert?.alertType,
      alert?.message,
      alert?.plotName,
      alert?.propertyName,
      alert?.sensorId
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return text.includes(normalized);
  });
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
      persistAlertsViewStateToUrl();
      renderAlertsForCurrentFilter();
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
    persistAlertsViewStateToUrl();

    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    searchDebounceTimer = setTimeout(() => {
      renderAlertsForCurrentFilter();
    }, 250);
  });

  const severitySelect = $('#alerts-severity-filter');
  severitySelect?.addEventListener('change', () => {
    severityFilter = normalizeAlertSeverityFilter(severitySelect.value);
    persistAlertsViewStateToUrl();
    renderAlertsForCurrentFilter();
  });

  const statusSelect = $('#alerts-status-filter');
  statusSelect?.addEventListener('change', () => {
    statusFilter = normalizeAlertStatusFilter(statusSelect.value);
    persistAlertsViewStateToUrl();
    renderAlertsForCurrentFilter();
  });

  const clearFiltersButton = $('#clear-alert-filters');
  clearFiltersButton?.addEventListener('click', () => {
    searchTerm = '';
    severityFilter = '';
    statusFilter = '';

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
    renderAlertsForCurrentFilter();
  });
}

async function handleResolve(alertId) {
  const confirmed = await showConfirm('Mark this alert as resolved?');

  if (confirmed) {
    try {
      await resolveAlert(alertId);
      toast('alerts.resolve_success', 'success');

      latestPendingAlerts = latestPendingAlerts.filter(
        (alert) => String(alert?.id) !== String(alertId)
      );
      renderStats(latestSummary);
      renderAlertsForCurrentFilter();
      setTimeout(() => void loadAlertsData(), 350);
    } catch (error) {
      console.error('Error resolving alert:', error);
      toast('alerts.resolve_failed', 'error');
    }
  }
}

function handleDetails(alertId) {
  // Could open a modal with full details
  toast('alerts.details', 'info', { id: alertId });
}

// Export for debugging
if (import.meta.env.DEV) {
  window.alertsDebug = { loadAlertsData, handleResolve };
}
