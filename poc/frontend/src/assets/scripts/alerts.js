/**
 * TC Agro Solutions - Alerts Page Entry Point
 */

import { initProtectedPage } from './common.js';
import { getAlerts, resolveAlert } from './api.js';
import { $id, showToast, showLoading, hideLoading, formatDate } from './utils.js';
import { t } from './i18n.js';

// Initialize protected page
await initProtectedPage();

// ============================================
// LOAD ALERTS
// ============================================

let allAlerts = [];

async function loadAlerts(status = null) {
  showLoading();

  try {
    allAlerts = await getAlerts(status);

    // Render alerts list - Use pendingAlerts container which is shown/hidden by tabs
    const alertsList = $id('pendingAlerts');
    if (alertsList && Array.isArray(allAlerts)) {
      if (allAlerts.length === 0) {
        alertsList.innerHTML =
          '<p style="padding: 2rem; text-align: center; color: #666;">No alerts found</p>';
      } else {
        alertsList.innerHTML = allAlerts
          .map(
            (a) => `
          <div class="alert-card alert-${a.severity}">
            <div class="alert-header">
              <div>
                <h4>${a.title}</h4>
                <p>${a.message}</p>
              </div>
              <span class="severity-badge badge-${a.severity}">${a.severity.toUpperCase()}</span>
            </div>
            
            <div class="alert-details">
              <span>📍 ${a.plotName}</span>
              <span>📡 ${a.sensorId || '-'}</span>
              <span>⏰ ${formatDate(a.createdAt, 'short')}</span>
            </div>

            <div class="alert-actions">
              ${
                a.status === 'pending'
                  ? `<button class="btn btn-sm btn-success" onclick="handleResolveAlert('${a.id}')">Resolve</button>`
                  : `<span class="badge badge-success">Resolved</span>`
              }
            </div>
          </div>
        `
          )
          .join('');
      }
    }

    hideLoading();
  } catch (err) {
    hideLoading();
    showToast(t('alerts.load_failed'), 'error');
  }
}

// Load initial alerts
await loadAlerts();

// ============================================
// TAB FILTERING
// ============================================

const tabs = document.querySelectorAll('[data-tab]');
tabs.forEach((tab) => {
  tab.addEventListener('click', (e) => {
    e.preventDefault();

    // Update active tab
    tabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');

    // Load alerts for this tab
    const tabName = tab.dataset.tab;
    const status = tabName === 'all' ? null : tabName;
    loadAlerts(status);

    // Update counts
    updateAlertCounts();
  });
});

// ============================================
// SEARCH/FILTER
// ============================================

const searchInput = $id('alertSearch');
if (searchInput) {
  searchInput.addEventListener('keyup', () => {
    const filter = searchInput.value.toLowerCase();
    const cards = document.querySelectorAll('.alert-card');

    cards.forEach((card) => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(filter) ? '' : 'none';
    });
  });
}

// ============================================
// ALERT COUNTS
// ============================================

async function updateAlertCounts() {
  try {
    const allAlerts = await getAlerts();

    const pending = allAlerts.filter((a) => a.status === 'pending').length;
    const resolved = allAlerts.filter((a) => a.status === 'resolved').length;
    const total = allAlerts.length;

    const pendingBadge = document.querySelector('[data-tab="pending"] .count-badge');
    const resolvedBadge = document.querySelector('[data-tab="resolved"] .count-badge');
    const allBadge = document.querySelector('[data-tab="all"] .count-badge');

    if (pendingBadge) pendingBadge.textContent = pending;
    if (resolvedBadge) resolvedBadge.textContent = resolved;
    if (allBadge) allBadge.textContent = total;
  } catch (err) {
    console.error('Failed to update alert counts:', err);
  }
}

await updateAlertCounts();

// ============================================
// RESOLVE ALERT
// ============================================

window.handleResolveAlert = async (alertId) => {
  showLoading();
  try {
    const result = await resolveAlert(alertId);
    if (result) {
      showToast(t('alerts.resolve_success'), 'success');
      await loadAlerts();
      await updateAlertCounts();
    }
  } catch (err) {
    showToast(t('alerts.resolve_failed'), 'error');
  } finally {
    hideLoading();
  }
};
