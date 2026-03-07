/**
 * TC Agro Solutions - Plots Page Entry Point
 */

import { getPlotsPaginated, getProperties, normalizeError } from './api.js';
import { initProtectedPage } from './common.js';
import { COMMON_CROP_TYPES, CROP_TYPE_ICONS } from './crop-types.js';
import { toast } from './i18n.js';
import { getIrrigationTypeDisplay, normalizeIrrigationType } from './irrigation-types.js';
import {
  normalizePlotStatus,
  getPlotStatusBadgeClass,
  getPlotStatusDisplay,
  getPlotStatusFilterOptionsHtml,
  getPlotSummaryCount,
  getPlotSummaryBadgeClass,
  getPlotSummaryBadgeText
} from './plot-statuses.js';
import {
  $,
  getPageUrl,
  debounce,
  formatArea,
  formatDate,
  getPaginatedItems,
  getPaginatedTotalCount,
  getPaginatedPageNumber,
  getPaginatedPageSize,
  getUser
} from './utils.js';
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
  loadStatusFilterOptions();
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

const GLOBAL_PLOTS_PAGE_SIZE = 200;
const GLOBAL_PLOTS_MAX_PAGES = 50;

// ============================================
// DATA LOADING
// ============================================

function getCurrentFilters() {
  const ownerId = getOwnerScopeIdForPlotsPage();

  return {
    pageNumber: Number($('#plots-page-number')?.value || 1),
    pageSize: Number($('#plots-page-size')?.value || 10),
    sortBy: $('#plots-sort-by')?.value || 'name',
    sortDirection: $('#plots-sort-direction')?.value || 'asc',
    ownerId: ownerId || '',
    propertyId: $('#filter-property')?.value || '',
    cropType: $('#filter-crop')?.value || '',
    status: $('#filter-status')?.value || '',
    filter: $('#search-plots')?.value?.trim() || ''
  };
}

async function loadPlots() {
  const tbody = $('#plots-tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="11" class="text-center">Loading...</td></tr>';

  try {
    const filters = getCurrentFilters();
    const [data, globalPlots] = await Promise.all([
      getPlotsPaginated(filters),
      loadGlobalPlotsForSummary(filters)
    ]);

    const pagedState = normalizePlotsResponse(data, filters);
    const tableState = filters.status ? normalizePlotsResponse(globalPlots, filters) : pagedState;

    updatePageOptions(tableState.pageCount, tableState.pageNumber);
    updatePagerControls(tableState);
    lastPageState = tableState;

    renderPlotsTable(tableState.items);
    renderSummary(tableState, globalPlots);
  } catch (error) {
    const { message } = normalizeError(error);
    console.error('Error loading plots:', error);
    tbody.innerHTML =
      '<tr><td colspan="11" class="text-center text-danger">Error loading plots</td></tr>';
    renderSummary({ items: [], totalCount: 0, pageNumber: 1, pageCount: 1, pageSize: 10 }, []);
    toast(message || 'plots.load_failed', 'error');
  }
}

function normalizePlotsResponse(data, filters) {
  if (Array.isArray(data)) {
    const normalizedItems = data.map(normalizePlotItem);
    const filteredItems = applyStatusFilter(normalizedItems, filters?.status);
    const pageSize = getPaginatedPageSize(null, filters?.pageSize || 10);
    const pageNumber = getPaginatedPageNumber(null, filters?.pageNumber || 1);
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

  const items = getPaginatedItems(data, []);
  const normalizedItems = (Array.isArray(items) ? items : []).map(normalizePlotItem);
  const filteredItems = applyStatusFilter(normalizedItems, filters?.status);
  const hasServerTotal = Number.isFinite(Number(data?.totalCount ?? data?.TotalCount));
  const totalCount =
    filters?.status && hasServerTotal
      ? filteredItems.length
      : getPaginatedTotalCount(data, filteredItems.length);
  const pageNumber = getPaginatedPageNumber(data, filters?.pageNumber || 1);
  const pageSize = getPaginatedPageSize(data, filters?.pageSize || 10);
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
    ownerName: plot?.ownerName || plot?.OwnerName || plot?.owner?.name || '-',
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
  return normalizePlotStatus(plot?.status || plot?.healthStatus);
}

async function loadGlobalPlotsForSummary(filters) {
  const allPlots = [];

  const baseFilters = {
    pageNumber: 1,
    pageSize: GLOBAL_PLOTS_PAGE_SIZE,
    sortBy: filters?.sortBy || 'name',
    sortDirection: filters?.sortDirection || 'asc',
    ownerId: filters?.ownerId || '',
    propertyId: filters?.propertyId || '',
    cropType: filters?.cropType || '',
    filter: filters?.filter || ''
  };

  let response = await getPlotsPaginated(baseFilters);

  if (Array.isArray(response)) {
    return response.map(normalizePlotItem);
  }

  allPlots.push(...getPaginatedItems(response, []));

  let pageNumber = getPaginatedPageNumber(response, 1);
  let hasNextPage = Boolean(response?.hasNextPage);
  let pagesFetched = 1;

  while (hasNextPage && pagesFetched < GLOBAL_PLOTS_MAX_PAGES) {
    pageNumber += 1;
    response = await getPlotsPaginated({
      ...baseFilters,
      pageNumber
    });

    if (Array.isArray(response)) {
      allPlots.push(...response);
      break;
    }

    allPlots.push(...getPaginatedItems(response, []));
    hasNextPage = Boolean(response?.hasNextPage);
    pagesFetched += 1;
  }

  return allPlots.map(normalizePlotItem);
}

function isCurrentUserAdminForPlotsPage() {
  const user = getUser();
  if (!user) {
    return false;
  }

  const roleCandidates = [];

  if (Array.isArray(user.role)) {
    roleCandidates.push(...user.role);
  } else if (user.role) {
    roleCandidates.push(user.role);
  }

  if (Array.isArray(user.roles)) {
    roleCandidates.push(...user.roles);
  } else if (user.roles) {
    roleCandidates.push(user.roles);
  }

  return roleCandidates.some(
    (role) =>
      String(role || '')
        .trim()
        .toLowerCase() === 'admin'
  );
}

function getOwnerScopeIdForPlotsPage() {
  if (isCurrentUserAdminForPlotsPage()) {
    return '';
  }

  const user = getUser();
  if (!user) {
    return '';
  }

  const ownerIdCandidates = [user.ownerId, user.sub, user.id, user.userId, user.nameIdentifier];
  const ownerId = ownerIdCandidates.find((candidate) => String(candidate || '').trim().length > 0);

  return ownerId ? String(ownerId).trim() : '';
}

async function loadPropertyFilter() {
  const select = $('#filter-property');
  if (!select) return;

  try {
    const currentValue = select.value;
    const ownerId = getOwnerScopeIdForPlotsPage();
    const response = await getProperties({
      pageNumber: 1,
      pageSize: 1000,
      sortBy: 'name',
      sortDirection: 'asc',
      ownerId: ownerId || ''
    });
    const properties = getPaginatedItems(response, []);

    select.innerHTML = `<option value="">All Properties</option>${(Array.isArray(properties)
      ? properties
      : []
    )
      .map((p) => `<option value="${p.id}">${p.name}</option>`)
      .join('')}`;

    const isCurrentValueStillAvailable = (Array.isArray(properties) ? properties : []).some(
      (property) => property.id === currentValue
    );

    if (currentValue && isCurrentValueStillAvailable) {
      select.value = currentValue;
    }
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

function loadStatusFilterOptions() {
  const select = $('#filter-status');
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = getPlotStatusFilterOptionsHtml('All Status');

  if (currentValue) {
    select.value = normalizePlotStatus(currentValue);
  }
}

function renderPlotsTable(plots) {
  const tbody = $('#plots-tbody');
  if (!tbody) return;

  if (!plots.length) {
    tbody.innerHTML =
      '<tr><td colspan="11" class="text-center text-muted">No plots found</td></tr>';
    return;
  }

  tbody.innerHTML = plots
    .map(
      (plot) => `
    <tr data-id="${plot.id}">
      <td>${plot.ownerName}</td>
      <td><strong>${plot.name}</strong></td>
      <td>${plot.propertyName}</td>
      <td>${formatCropType(plot.cropType)}</td>
      <td>${formatDate(plot.plantingDate)}</td>
      <td>${formatDate(plot.expectedHarvestDate)}</td>
      <td>${getIrrigationTypeDisplay(plot.irrigationType)}</td>
      <td>${formatArea(plot.areaHectares)}</td>
      <td>${plot.sensorsCount} sensor(es)</td>
      <td>
        <span class="badge ${getPlotStatusBadgeClass(plot.status)}">
          ${getPlotStatusDisplay(plot.status)}
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

function renderSummary(state, globalPlots = null) {
  const summaryText = $('#plots-summary-text');
  const summaryArea = $('#plots-summary-area');
  const healthyBadge = $('#plots-summary-healthy');
  const warningBadge = $('#plots-summary-warning');
  const alertBadge = $('#plots-summary-alert');

  const plots = state?.items || [];
  const summarySource = Array.isArray(globalPlots) ? globalPlots : [];
  const source = summarySource.length ? summarySource : plots;
  const totalArea = source.reduce((sum, plot) => sum + Number(plot.areaHectares || 0), 0);
  const healthyCount = getPlotSummaryCount(source, 'healthy');
  const warningCount = getPlotSummaryCount(source, 'warning');
  const alertCount = getPlotSummaryCount(source, 'alert');

  if (summaryText) {
    const total = Number(state?.totalCount ?? plots.length ?? 0);
    const pageNumber = Number(state?.pageNumber ?? 1);
    const pageSize = Number(state?.pageSize ?? plots.length ?? 1);
    const from = total === 0 ? 0 : (pageNumber - 1) * pageSize + 1;
    const to = total === 0 ? 0 : from + plots.length - 1;
    summaryText.textContent = `Showing ${from}-${to} of ${total} (Page ${pageNumber}/${state?.pageCount ?? 1})`;
  }
  if (summaryArea) summaryArea.textContent = `Total Area: ${formatArea(totalArea)}`;
  if (healthyBadge) {
    healthyBadge.className = `badge plot-status-summary-badge ${getPlotSummaryBadgeClass('healthy')}`;
    healthyBadge.textContent = getPlotSummaryBadgeText('healthy', healthyCount);
  }
  if (warningBadge) {
    warningBadge.className = `badge plot-status-summary-badge ${getPlotSummaryBadgeClass('warning')}`;
    warningBadge.textContent = getPlotSummaryBadgeText('warning', warningCount);
  }
  if (alertBadge) {
    alertBadge.className = `badge plot-status-summary-badge ${getPlotSummaryBadgeClass('alert')}`;
    alertBadge.textContent = getPlotSummaryBadgeText('alert', alertCount);
  }
}

// ============================================
// HELPERS
// ============================================

function formatCropType(cropType) {
  const value = String(cropType || '').trim();
  if (!value || value === '-') return '-';

  const normalized = value.toLowerCase();
  const match = COMMON_CROP_TYPES.find((item) => item.toLowerCase() === normalized) || value;
  const icon = CROP_TYPE_ICONS[match] || '🌿';
  return `${icon} ${match}`;
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
