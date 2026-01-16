/**
 * TC Agro Solutions - Plots Page Entry Point
 */

import { getPlots, getProperties, deletePlot } from './api.js';
import { initProtectedPage } from './common.js';
import { toast } from './i18n.js';
import { $, $$, showConfirm, getPageUrl } from './utils.js';

// ============================================
// PAGE INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth and setup page (must be inside DOMContentLoaded for sidebar elements)
  if (!initProtectedPage()) {
    return;
  }

  await Promise.all([loadPlots(), loadPropertyFilter()]);
  setupEventListeners();
});

// ============================================
// DATA LOADING
// ============================================

async function loadPlots(propertyId = null) {
  const tbody = $('#plots-tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';

  try {
    const plots = await getPlots(propertyId);
    renderPlotsTable(plots);
  } catch (error) {
    console.error('Error loading plots:', error);
    tbody.innerHTML =
      '<tr><td colspan="7" class="text-center text-danger">Error loading plots</td></tr>';
    toast('plots.load_failed', 'error');
  }
}

async function loadPropertyFilter() {
  const select = $('#filter-property');
  if (!select) return;

  try {
    const properties = await getProperties();
    select.innerHTML = `<option value="">All Properties</option>${properties
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
        <a href="${getPageUrl('plots-form.html')}?id=${plot.id}" class="btn btn-sm btn-outline">✏️ Edit</a>
        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${plot.id}">🗑️</button>
      </td>
    </tr>
  `
    )
    .join('');
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
  propertyFilter?.addEventListener('change', (e) => {
    const propertyId = e.target.value || null;
    loadPlots(propertyId);
  });

  // Search filter
  const searchInput = $('#search-plots');
  searchInput?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const rows = $$('#plots-tbody tr');

    rows.forEach((row) => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(query) ? '' : 'none';
    });
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
