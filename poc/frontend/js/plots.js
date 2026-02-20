/**
 * TC Agro Solutions - Plots Page Entry Point
 */

import { getPlotsPaginated, getProperties, deletePlot, normalizeError } from './api.js';
import { initProtectedPage } from './common.js';
import { toast } from './i18n.js';
import { $, showConfirm, getPageUrl } from './utils.js';

// ============================================
// PAGE INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth and setup page (must be inside DOMContentLoaded for sidebar elements)
  if (!initProtectedPage()) {
    return;
  }

  await Promise.all([loadPropertyFilter(), loadPlots()]);
  setupEventListeners();
});

// ============================================
// DATA LOADING
// ============================================

function getCurrentFilters() {
  return {
    propertyId: $('#filter-property')?.value || '',
    cropType: $('#filter-crop')?.value || '',
    filter: $('#search-plots')?.value?.trim() || ''
  };
}

async function loadPlots() {
  const tbody = $('#plots-tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';

  try {
    const data = await getPlotsPaginated({ pageNumber: 1, pageSize: 100, ...getCurrentFilters() });
    const plots = normalizePlotsResponse(data);
    renderPlotsTable(plots);
    renderSummary(plots);
  } catch (error) {
    const { message } = normalizeError(error);
    console.error('Error loading plots:', error);
    tbody.innerHTML =
      '<tr><td colspan="7" class="text-center text-danger">Error loading plots</td></tr>';
    renderSummary([]);
    toast(message || 'plots.load_failed', 'error');
  }
}

function normalizePlotsResponse(data) {
  if (Array.isArray(data)) {
    return data.map(normalizePlotItem);
  }

  const items = data?.data || data?.items || data?.results || [];
  return (Array.isArray(items) ? items : []).map(normalizePlotItem);
}

function normalizePlotItem(plot) {
  const area = Number(plot?.areaHectares ?? plot?.area ?? 0);
  const sensorsCount = Number(
    plot?.sensorsCount ?? plot?.sensorCount ?? plot?.sensors?.length ?? 0
  );

  return {
    id: plot?.id || '',
    name: plot?.name || '-',
    propertyName: plot?.propertyName || plot?.property?.name || '-',
    cropType: plot?.cropType || '-',
    areaHectares: Number.isFinite(area) ? area : 0,
    sensorsCount: Number.isFinite(sensorsCount) ? sensorsCount : 0,
    status: normalizeStatus(plot)
  };
}

function normalizeStatus(plot) {
  const raw = String(plot?.status || plot?.healthStatus || '').toLowerCase();
  if (raw === 'warning' || raw === 'alert' || raw === 'critical' || raw === 'healthy') return raw;
  if (raw === 'active' || raw === 'ok' || raw === 'normal') return 'healthy';
  return 'healthy';
}

async function loadPropertyFilter() {
  const select = $('#filter-property');
  if (!select) return;

  try {
    const response = await getProperties();
    const properties = response?.data || response || [];
    select.innerHTML = `<option value="">All Properties</option>${(Array.isArray(properties)
      ? properties
      : []
    )
      .map((p) => `<option value="${p.id}">${p.name}</option>`)
      .join('')}`;
  } catch (error) {
    console.error('Error loading properties for filter:', error);
  }
}

function renderPlotsTable(plots) {
  const tbody = $('#plots-tbody');
  if (!tbody) return;

  if (!plots.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No plots found</td></tr>';
    return;
  }

  tbody.innerHTML = plots
    .map(
      (plot) => `
    <tr data-id="${plot.id}">
      <td><strong>${plot.name}</strong></td>
      <td>${plot.propertyName}</td>
      <td>
        <span class="badge badge-info">${formatCropType(plot.cropType)}</span>
      </td>
      <td>${plot.areaHectares.toLocaleString('en-US')} ha</td>
      <td>${plot.sensorsCount} sensor(es)</td>
      <td>
        <span class="badge ${getStatusBadgeClass(plot.status)}">
          ${getStatusIcon(plot.status)} ${formatStatus(plot.status)}
        </span>
      </td>
      <td class="actions">
        <a href="${getPageUrl('plots-form.html')}?id=${encodeURIComponent(plot.id)}" class="btn btn-sm btn-outline">✏️ Edit</a>
        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${plot.id}">🗑️</button>
      </td>
    </tr>
  `
    )
    .join('');
}

function renderSummary(plots) {
  const summaryText = $('#plots-summary-text');
  const summaryArea = $('#plots-summary-area');
  const healthyBadge = $('#plots-summary-healthy');
  const warningBadge = $('#plots-summary-warning');
  const alertBadge = $('#plots-summary-alert');

  const totalArea = plots.reduce((sum, plot) => sum + Number(plot.areaHectares || 0), 0);
  const healthyCount = plots.filter((plot) => plot.status === 'healthy').length;
  const warningCount = plots.filter((plot) => plot.status === 'warning').length;
  const alertCount = plots.filter(
    (plot) => plot.status === 'alert' || plot.status === 'critical'
  ).length;

  if (summaryText) summaryText.textContent = `Showing ${plots.length} plot(s)`;
  if (summaryArea) summaryArea.textContent = `Total Area: ${totalArea.toLocaleString('en-US')} ha`;
  if (healthyBadge) healthyBadge.textContent = `${healthyCount} Healthy`;
  if (warningBadge) warningBadge.textContent = `${warningCount} Warning`;
  if (alertBadge) alertBadge.textContent = `${alertCount} Alert`;
}

// ============================================
// HELPERS
// ============================================

function formatCropType(cropType) {
  const types = {
    soybean: 'Soja',
    corn: 'Milho',
    coffee: 'Coffee',
    sugarcane: 'Sugarcane',
    cotton: 'Cotton',
    wheat: 'Trigo',
    rice: 'Arroz'
  };
  return types[cropType] || cropType;
}

function formatStatus(status) {
  const statuses = {
    healthy: 'Healthy',
    warning: 'Warning',
    alert: 'Alerta',
    critical: 'Critical'
  };
  return statuses[status] || status;
}

function getStatusBadgeClass(status) {
  const classes = {
    healthy: 'badge-success',
    warning: 'badge-warning',
    alert: 'badge-danger',
    critical: 'badge-danger'
  };
  return classes[status] || 'badge-secondary';
}

function getStatusIcon(status) {
  const icons = {
    healthy: '✅',
    warning: '⚠️',
    alert: '🚨',
    critical: '🔴'
  };
  return icons[status] || '';
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Property filter
  const propertyFilter = $('#filter-property');
  propertyFilter?.addEventListener('change', () => {
    loadPlots();
  });

  const cropFilter = $('#filter-crop');
  cropFilter?.addEventListener('change', () => {
    loadPlots();
  });

  // Search filter
  const searchInput = $('#search-plots');
  searchInput?.addEventListener('input', () => {
    loadPlots();
  });

  // Delete button handler (event delegation)
  const tbody = $('#plots-tbody');
  tbody?.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('[data-action="delete"]');
    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      await handleDelete(id);
    }
  });
}

async function handleDelete(id) {
  const confirmed = await showConfirm('Are you sure you want to delete this plot?');

  if (confirmed) {
    try {
      await deletePlot(id);
      toast('plots.delete_success', 'success');
      await loadPlots();
    } catch (error) {
      console.error('Error deleting plot:', error);
      toast('plots.delete_failed', 'error');
    }
  }
}

// Export for debugging
if (import.meta.env.DEV) {
  window.plotsDebug = { loadPlots, handleDelete };
}
