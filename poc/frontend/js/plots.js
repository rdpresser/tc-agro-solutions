/**
 * TC Agro Solutions - Plots Page Entry Point
 */

import { getPlotsPaginated, getProperties, normalizeError } from './api.js';
import { initProtectedPage } from './common.js';
import { COMMON_CROP_TYPES, CROP_TYPE_ICONS } from './crop-types.js';
import { toast } from './i18n.js';
import { getIrrigationTypeDisplay, normalizeIrrigationType } from './irrigation-types.js';
import { $, getPageUrl, debounce, formatArea, formatDate } from './utils.js';
// import { showConfirm } from './utils.js'; // Commented out - delete functionality disabled
// import { deletePlot } from './api.js'; // Commented out - no delete route available

// ============================================
// PAGE INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth and setup page (must be inside DOMContentLoaded for sidebar elements)
  if (!initProtectedPage()) {
    return;
  }

  loadCropFilterOptions();
  await Promise.all([loadPropertyFilter(), loadPlots()]);
  setupEventListeners();
});

let lastPageState = {
  pageNumber: 1,
  pageCount: 1,
  hasNextPage: false,
  hasPreviousPage: false,
  totalCount: 0
};

// ============================================
// DATA LOADING
// ============================================

function getCurrentFilters() {
  return {
    pageNumber: Number($('#plots-page-number')?.value || 1),
    pageSize: Number($('#plots-page-size')?.value || 10),
    sortBy: $('#plots-sort-by')?.value || 'name',
    sortDirection: $('#plots-sort-direction')?.value || 'asc',
    propertyId: $('#filter-property')?.value || '',
    cropType: $('#filter-crop')?.value || '',
    status: $('#filter-status')?.value || '',
    filter: $('#search-plots')?.value?.trim() || ''
  };
}

async function loadPlots() {
  const tbody = $('#plots-tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="10" class="text-center">Loading...</td></tr>';

  try {
    const filters = getCurrentFilters();
    const data = await getPlotsPaginated(filters);
    const normalized = normalizePlotsResponse(data, filters);
    const plots = normalized.items;

    updatePageOptions(normalized.pageCount, normalized.pageNumber);
    updatePagerControls(normalized);
    lastPageState = normalized;

    renderPlotsTable(plots);
    renderSummary(normalized);
  } catch (error) {
    const { message } = normalizeError(error);
    console.error('Error loading plots:', error);
    tbody.innerHTML =
      '<tr><td colspan="10" class="text-center text-danger">Error loading plots</td></tr>';
    renderSummary({ items: [], totalCount: 0, pageNumber: 1, pageCount: 1 });
    toast(message || 'plots.load_failed', 'error');
  }
}

function normalizePlotsResponse(data, filters) {
  if (Array.isArray(data)) {
    const normalizedItems = data.map(normalizePlotItem);
    const filteredItems = applyStatusFilter(normalizedItems, filters?.status);
    const pageSize = filters?.pageSize || 10;
    const pageNumber = filters?.pageNumber || 1;
    const totalCount = filteredItems.length;
    const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.min(Math.max(1, pageNumber), pageCount);
    const start = (safePage - 1) * pageSize;

    return {
      items: filteredItems.slice(start, start + pageSize),
      totalCount,
      pageNumber: safePage,
      pageSize,
      pageCount,
      hasPreviousPage: safePage > 1,
      hasNextPage: safePage < pageCount
    };
  }

  const items = data?.data || data?.items || data?.results || [];
  const normalizedItems = (Array.isArray(items) ? items : []).map(normalizePlotItem);
  const filteredItems = applyStatusFilter(normalizedItems, filters?.status);
  const totalCount =
    filters?.status && Number.isFinite(Number(data?.totalCount))
      ? filteredItems.length
      : Number(data?.totalCount ?? filteredItems.length);
  const pageNumber = Number(data?.pageNumber || filters?.pageNumber || 1);
  const pageSize = Number(data?.pageSize || filters?.pageSize || 10);
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const hasPreviousPage = data?.hasPreviousPage ?? pageNumber > 1;
  const hasNextPage = data?.hasNextPage ?? pageNumber < pageCount;

  return {
    items: filteredItems,
    totalCount,
    pageNumber,
    pageSize,
    pageCount,
    hasPreviousPage,
    hasNextPage
  };
}

function applyStatusFilter(items, status) {
  if (!status) return items;
  return items.filter((item) => item.status === status);
}

function updatePageOptions(pageCount, currentPage) {
  const pageSelect = $('#plots-page-number');
  if (!pageSelect) return;

  const pages = Math.max(1, pageCount || 1);
  pageSelect.innerHTML = Array.from({ length: pages }, (_, index) => {
    const page = index + 1;
    return `<option value="${page}">${page}</option>`;
  }).join('');

  const safePage = Math.min(Math.max(1, currentPage || 1), pages);
  pageSelect.value = String(safePage);
}

function updatePagerControls(state) {
  const prevBtn = $('#plots-prev');
  const nextBtn = $('#plots-next');
  if (!prevBtn || !nextBtn) return;

  prevBtn.disabled = !state.hasPreviousPage;
  nextBtn.disabled = !state.hasNextPage;
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
    plantingDate: plot?.plantingDate || null,
    expectedHarvestDate: plot?.expectedHarvestDate || plot?.expectedHarvest || null,
    irrigationType: normalizeIrrigationType(plot?.irrigationType || ''),
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

function loadCropFilterOptions() {
  const select = $('#filter-crop');
  if (!select) return;

  const currentValue = select.value;

  select.innerHTML = [`<option value="">All Crops</option>`]
    .concat(
      COMMON_CROP_TYPES.map((cropType) => {
        const icon = CROP_TYPE_ICONS[cropType] || '🌿';
        return `<option value="${cropType}">${icon} ${cropType}</option>`;
      })
    )
    .join('');

  if (currentValue) {
    select.value = currentValue;
  }
}

function renderPlotsTable(plots) {
  const tbody = $('#plots-tbody');
  if (!tbody) return;

  if (!plots.length) {
    tbody.innerHTML =
      '<tr><td colspan="10" class="text-center text-muted">No plots found</td></tr>';
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
      <td>${formatDate(plot.plantingDate)}</td>
      <td>${formatDate(plot.expectedHarvestDate)}</td>
      <td>${getIrrigationTypeDisplay(plot.irrigationType)}</td>
      <td>${formatArea(plot.areaHectares)}</td>
      <td>${plot.sensorsCount} sensor(es)</td>
      <td>
        <span class="badge ${getStatusBadgeClass(plot.status)}">
          ${getStatusIcon(plot.status)} ${formatStatus(plot.status)}
        </span>
      </td>
      <td class="actions">
        <a href="${getPageUrl('plots-form.html')}?id=${encodeURIComponent(plot.id)}" class="btn btn-sm btn-outline">✏️ Edit</a>
        <!-- Delete button commented out - no delete route available for plots -->
        <!-- <button class="btn btn-sm btn-danger" data-action="delete" data-id="${plot.id}">🗑️</button> -->
      </td>
    </tr>
  `
    )
    .join('');
}

function renderSummary(state) {
  const summaryText = $('#plots-summary-text');
  const summaryArea = $('#plots-summary-area');
  const healthyBadge = $('#plots-summary-healthy');
  const warningBadge = $('#plots-summary-warning');
  const alertBadge = $('#plots-summary-alert');

  const plots = state?.items || [];
  const totalArea = plots.reduce((sum, plot) => sum + Number(plot.areaHectares || 0), 0);
  const healthyCount = plots.filter((plot) => plot.status === 'healthy').length;
  const warningCount = plots.filter((plot) => plot.status === 'warning').length;
  const alertCount = plots.filter(
    (plot) => plot.status === 'alert' || plot.status === 'critical'
  ).length;

  if (summaryText) {
    const total = Number(state?.totalCount ?? plots.length ?? 0);
    const pageNumber = Number(state?.pageNumber ?? 1);
    const pageSize = Number(state?.pageSize ?? plots.length ?? 1);
    const from = total === 0 ? 0 : (pageNumber - 1) * pageSize + 1;
    const to = total === 0 ? 0 : from + plots.length - 1;
    summaryText.textContent = `Showing ${from}-${to} of ${total} (Page ${pageNumber}/${state?.pageCount ?? 1})`;
  }
  if (summaryArea) summaryArea.textContent = `Total Area: ${formatArea(totalArea)}`;
  if (healthyBadge) healthyBadge.textContent = `${healthyCount} ● Healthy`;
  if (warningBadge) warningBadge.textContent = `${warningCount} ● Needs Attention`;
  if (alertBadge) alertBadge.textContent = `${alertCount} ● Alert Active`;
}

// ============================================
// HELPERS
// ============================================

function formatCropType(cropType) {
  const value = String(cropType || '').trim();
  if (!value) return '-';

  const normalized = value.toLowerCase();
  const match = COMMON_CROP_TYPES.find((item) => item.toLowerCase() === normalized);
  return match || value;
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
  const filtersForm = $('#plotsFilterForm');
  filtersForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const pageSelect = $('#plots-page-number');
    if (pageSelect) pageSelect.value = '1';
    loadPlots();
  });

  const propertyFilter = $('#filter-property');
  propertyFilter?.addEventListener('change', () => {
    const pageSelect = $('#plots-page-number');
    if (pageSelect) pageSelect.value = '1';
    loadPlots();
  });

  const cropFilter = $('#filter-crop');
  cropFilter?.addEventListener('change', () => {
    const pageSelect = $('#plots-page-number');
    if (pageSelect) pageSelect.value = '1';
    loadPlots();
  });

  const statusFilter = $('#filter-status');
  statusFilter?.addEventListener('change', () => {
    const pageSelect = $('#plots-page-number');
    if (pageSelect) pageSelect.value = '1';
    loadPlots();
  });

  const pageNumber = $('#plots-page-number');
  pageNumber?.addEventListener('change', () => {
    loadPlots();
  });

  const pageSize = $('#plots-page-size');
  pageSize?.addEventListener('change', () => {
    const pageSelect = $('#plots-page-number');
    if (pageSelect) pageSelect.value = '1';
    loadPlots();
  });

  const sortBy = $('#plots-sort-by');
  sortBy?.addEventListener('change', () => {
    loadPlots();
  });

  const sortDirection = $('#plots-sort-direction');
  sortDirection?.addEventListener('change', () => {
    loadPlots();
  });

  const searchInput = $('#search-plots');
  const debouncedSearch = debounce(() => {
    const pageSelect = $('#plots-page-number');
    if (pageSelect) pageSelect.value = '1';
    loadPlots();
  }, 300);

  searchInput?.addEventListener('input', () => {
    debouncedSearch();
  });

  const prevBtn = $('#plots-prev');
  prevBtn?.addEventListener('click', async () => {
    if (!lastPageState.hasPreviousPage) return;
    const pageSelect = $('#plots-page-number');
    const current = Number(pageSelect?.value || 1);
    if (pageSelect && current > 1) {
      pageSelect.value = String(current - 1);
      await loadPlots();
    }
  });

  const nextBtn = $('#plots-next');
  nextBtn?.addEventListener('click', async () => {
    if (!lastPageState.hasNextPage) return;
    const pageSelect = $('#plots-page-number');
    const current = Number(pageSelect?.value || 1);
    if (pageSelect && current < lastPageState.pageCount) {
      pageSelect.value = String(current + 1);
      await loadPlots();
    }
  });

  searchInput?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const pageSelect = $('#plots-page-number');
    if (pageSelect) pageSelect.value = '1';
    loadPlots();
  });

  // Delete button handler (event delegation)
  // Commented out - no delete route available for plots
  // const tbody = $('#plots-tbody');
  // tbody?.addEventListener('click', async (e) => {
  //   const deleteBtn = e.target.closest('[data-action="delete"]');
  //   if (deleteBtn) {
  //     const id = deleteBtn.dataset.id;
  //     await handleDelete(id);
  //   }
  // });
}

// Commented out - no delete route available for plots
// async function handleDelete(id) {
//   const confirmed = await showConfirm('Are you sure you want to delete this plot?');
//
//   if (confirmed) {
//     try {
//       await deletePlot(id);
//       toast('plots.delete_success', 'success');
//       await loadPlots();
//     } catch (error) {
//       console.error('Error deleting plot:', error);
//       toast('plots.delete_failed', 'error');
//     }
//   }
// }

// Export for debugging
if (import.meta.env.DEV) {
  window.plotsDebug = { loadPlots };
}
