/**
 * TC Agro Solutions - Alerts Page Entry Point
 */

import { getAlerts, resolveAlert } from './api.js';
import { initProtectedPage } from './common.js';
import { toast } from './i18n.js';
import { $, $$, showConfirm, formatDate, formatRelativeTime } from './utils.js';

// ============================================
// PAGE INITIALIZATION
// ============================================

let currentFilter = 'pending';

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth and setup page (must be inside DOMContentLoaded for sidebar elements)
  if (!initProtectedPage()) {
    return;
  }

  await loadAlerts(currentFilter);
  setupEventListeners();
});

// ============================================
// DATA LOADING
// ============================================

async function loadAlerts(status = null) {
  const container = $('#alerts-container');
  if (!container) return;

  container.innerHTML = '<div class="loading">Loading alerts...</div>';

  try {
    const alerts = await getAlerts(status);
    renderAlerts(alerts);
    updateTabCounts(alerts);
  } catch (error) {
    console.error('Error loading alerts:', error);
    container.innerHTML = '<div class="error">Error loading alerts</div>';
    toast('alerts.load_failed', 'error');
  }
}

function renderAlerts(alerts) {
  const container = $('#alerts-container');
  if (!container) return;

  if (!alerts.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✅</div>
        <p>No alerts ${currentFilter === 'pending' ? 'pending' : currentFilter === 'resolved' ? 'resolved' : 'available'}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = alerts
    .map(
      (alert) => `
    <div class="alert-card ${alert.severity}" data-alert-id="${alert.id}">
      <div class="alert-header">
        <span class="alert-severity ${alert.severity}">
          ${getSeverityIcon(alert.severity)} ${formatSeverity(alert.severity)}
        </span>
        <span class="alert-time" title="${formatDate(alert.createdAt)}">
          ${formatRelativeTime(alert.createdAt)}
        </span>
      </div>
      
      <h3 class="alert-title">${alert.title}</h3>
      <p class="alert-message">${alert.message}</p>
      
      <div class="alert-meta">
        <span class="meta-item">📍 ${alert.plotName}</span>
        <span class="meta-item">📡 ${alert.sensorId}</span>
      </div>
      
      <div class="alert-actions">
        ${
          alert.status === 'pending'
            ? `
          <button class="btn btn-success btn-sm" data-action="resolve" data-id="${alert.id}">
            ✅ Resolve
          </button>
        `
            : `
          <span class="resolved-info">
            Resolved on ${formatDate(alert.resolvedAt)}
          </span>
        `
        }
        <button class="btn btn-outline btn-sm" data-action="details" data-id="${alert.id}">
          📋 Details
        </button>
      </div>
    </div>
  `
    )
    .join('');
}

function updateTabCounts(alerts) {
  // This would update badge counts on tabs if needed
  const pendingCount = alerts.filter((a) => a.status === 'pending').length;
  const resolvedCount = alerts.filter((a) => a.status === 'resolved').length;

  const pendingTab = $('[data-tab="pending"] .count');
  const resolvedTab = $('[data-tab="resolved"] .count');

  if (pendingTab) pendingTab.textContent = pendingCount;
  if (resolvedTab) resolvedTab.textContent = resolvedCount;
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

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Tab switching
  const tabs = $$('[data-tab]');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      // Update active state
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      // Load filtered alerts
      currentFilter = tab.dataset.tab;
      const status = currentFilter === 'all' ? null : currentFilter;
      loadAlerts(status);
    });
  });

  // Alert actions (event delegation)
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

  // Search filter
  const searchInput = $('#search-alerts');
  searchInput?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const cards = $$('.alert-card');

    cards.forEach((card) => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(query) ? '' : 'none';
    });
  });
}

async function handleResolve(alertId) {
  const confirmed = await showConfirm('Mark this alert as resolved?');

  if (confirmed) {
    try {
      await resolveAlert(alertId);
      toast('alerts.resolve_success', 'success');

      // Remove card with animation
      const card = $(`[data-alert-id="${alertId}"]`);
      if (card) {
        card.style.opacity = '0';
        card.style.transform = 'translateX(100%)';
        setTimeout(() => card.remove(), 300);
      }

      // Reload to update counts
      setTimeout(() => loadAlerts(currentFilter === 'all' ? null : currentFilter), 500);
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
  window.alertsDebug = { loadAlerts, handleResolve };
}
