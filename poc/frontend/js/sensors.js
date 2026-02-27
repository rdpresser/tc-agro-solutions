/**
 * TC Agro Solutions - Sensors List Page Entry Point
 */

import {
  changeSensorOperationalStatus,
  fetchFarmSwagger,
  getSensorsPaginated,
  getProperties,
  getPlotsPaginated,
  normalizeError
} from './api.js';
import { initProtectedPage } from './common.js';
import { toast } from './i18n.js';
import {
  getSensorStatusBadgeClass,
  getSensorStatusDisplay,
  normalizeSensorStatus,
  SENSOR_STATUSES
} from './sensor-statuses.js';
import { getSensorTypeDisplay, SENSOR_TYPES } from './sensor-types.js';
import {
  $,
  debounce,
  formatDateTime,
  getPageUrl,
  getPaginatedItems,
  getPaginatedTotalCount,
  getPaginatedPageNumber,
  getPaginatedPageSize
} from './utils.js';

let lastPageState = {
  pageNumber: 1,
  pageCount: 1,
  hasNextPage: false,
  hasPreviousPage: false,
  totalCount: 0
};

let statusChangeContext = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!initProtectedPage()) {
    return;
  }

  await checkFarmApi();
  loadStatusFilterOptions();
  loadTypeFilterOptions();
  await Promise.all([loadPropertyFilter(), loadPlotFilter()]);
  await loadSensors();
  setupEventListeners();
});

function loadStatusFilterOptions() {
  const select = $('#filter-status');
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
  const select = $('#filter-type');
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

async function checkFarmApi() {
  try {
    await fetchFarmSwagger();
  } catch (error) {
    const { message } = normalizeError(error);
    toast(message || 'Farm API is not reachable', 'warning');
  }
}

function getCurrentFilters() {
  return {
    pageNumber: Number($('#sensors-page-number')?.value || 1),
    pageSize: Number($('#sensors-page-size')?.value || 10),
    sortBy: $('#sensors-sort-by')?.value || 'installedAt',
    sortDirection: $('#sensors-sort-direction')?.value || 'desc',
    filter: $('#search-sensors')?.value?.trim() || '',
    propertyId: $('#filter-property')?.value || '',
    plotId: $('#filter-plot')?.value || '',
    type: $('#filter-type')?.value || '',
    status: $('#filter-status')?.value || ''
  };
}

async function loadSensors() {
  const tbody = $('#sensors-tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="8" class="text-center">Loading...</td></tr>';

  try {
    const filters = getCurrentFilters();
    const data = await getSensorsPaginated(filters);
    const normalized = normalizeSensorsResponse(data, filters);

    renderSensorsTable(normalized.items);
    updatePageOptions(normalized.pageCount, normalized.pageNumber);
    updatePagerControls(normalized);
    renderSummary(normalized);
    lastPageState = normalized;
  } catch (error) {
    const { message } = normalizeError(error);
    console.error('Error loading sensors:', error);
    tbody.innerHTML =
      '<tr><td colspan="8" class="text-center text-danger">Error loading sensors</td></tr>';
    renderSummary({ items: [], totalCount: 0, pageNumber: 1, pageCount: 1 });
    toast(message || 'sensors.load_failed', 'error');
  }
}

function normalizeSensorsResponse(data, filters) {
  if (Array.isArray(data)) {
    const totalCount = data.length;
    const pageSize = getPaginatedPageSize(null, filters?.pageSize || 10);
    const pageNumber = getPaginatedPageNumber(null, filters?.pageNumber || 1);
    const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.min(Math.max(1, pageNumber), pageCount);
    const start = (safePage - 1) * pageSize;

    return {
      items: data.slice(start, start + pageSize),
      totalCount,
      pageNumber: safePage,
      pageSize,
      pageCount,
      hasPreviousPage: safePage > 1,
      hasNextPage: safePage < pageCount
    };
  }

  const items = getPaginatedItems(data, []);
  const totalCount = getPaginatedTotalCount(data, items.length);
  const pageNumber = getPaginatedPageNumber(data, filters?.pageNumber || 1);
  const pageSize = getPaginatedPageSize(data, filters?.pageSize || 10);
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const hasPreviousPage = data?.hasPreviousPage ?? pageNumber > 1;
  const hasNextPage = data?.hasNextPage ?? pageNumber < pageCount;

  return {
    items,
    totalCount,
    pageNumber,
    pageSize,
    pageCount,
    hasPreviousPage,
    hasNextPage
  };
}

function renderSensorsTable(sensors) {
  const tbody = $('#sensors-tbody');
  if (!tbody) return;

  if (!sensors.length) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="text-center text-muted">No sensors found</td></tr>';
    return;
  }

  tbody.innerHTML = sensors
    .map((sensor) => {
      const installedAt = formatDateTime(sensor.installedAt);
      const ownerName = sensor.ownerName || sensor.OwnerName || sensor.owner?.name || '-';

      return `
    <tr data-id="${sensor.id}">
      <td>${ownerName}</td>
      <td><strong>${sensor.label || '-'}</strong></td>
      <td>${sensor.type ? getSensorTypeDisplay(sensor.type) : '-'}</td>
      <td>
        <span class="badge ${getSensorStatusBadgeClass(sensor.status)}">${getSensorStatusDisplay(sensor.status)}</span>
      </td>
      <td>${sensor.plotName || '-'}</td>
      <td>${sensor.propertyName || '-'}</td>
      <td>${installedAt}</td>
      <td class="actions">
        <a href="${getPageUrl('sensors-form.html')}?id=${encodeURIComponent(sensor.id)}" class="btn btn-sm btn-outline">👁️ View</a>
        <button
          type="button"
          class="btn btn-sm btn-primary js-change-status"
          data-sensor-id="${sensor.id}"
          data-sensor-label="${escapeHtmlAttribute(sensor.label || '-')}"
          data-current-status="${normalizeSensorStatus(sensor.status)}"
        >
          🔄 Change Status
        </button>
      </td>
    </tr>
  `;
    })
    .join('');
}

function escapeHtmlAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function loadModalStatusOptions(selectedStatus = '') {
  const select = $('#sensor-new-status');
  if (!select) return;

  select.innerHTML = [`<option value="">Select status</option>`]
    .concat(
      SENSOR_STATUSES.map(
        (status) => `<option value="${status}">${getSensorStatusDisplay(status)}</option>`
      )
    )
    .join('');

  if (selectedStatus) {
    select.value = normalizeSensorStatus(selectedStatus);
  }
}

function openModal(modal) {
  if (!modal) return;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function openStatusChangeModal(context) {
  const modal = $('#sensor-status-modal');
  const summary = $('#sensor-status-modal-summary');
  const reasonField = $('#sensor-status-reason');

  if (!modal || !summary || !reasonField) return;

  statusChangeContext = context;

  summary.innerHTML = `
    <div><strong>Sensor:</strong> ${context.sensorLabel || '-'}</div>
    <div style="margin-top: 8px"><strong>Current status:</strong> ${getSensorStatusDisplay(
      context.currentStatus
    )}</div>
  `;

  loadModalStatusOptions(context.currentStatus);
  reasonField.value = '';

  const submitBtn = $('#sensor-status-submit');
  if (submitBtn) submitBtn.disabled = false;

  openModal(modal);
}

function closeStatusChangeModal() {
  statusChangeContext = null;
  closeModal($('#sensor-status-modal'));
}

async function submitStatusChange(event) {
  event.preventDefault();

  if (!statusChangeContext?.sensorId) {
    toast('Sensor not selected', 'error');
    return;
  }

  const newStatus = normalizeSensorStatus($('#sensor-new-status')?.value || '');
  const reason = ($('#sensor-status-reason')?.value || '').trim();
  const submitBtn = $('#sensor-status-submit');

  if (!newStatus) {
    toast('Select a valid status', 'warning');
    return;
  }

  try {
    if (submitBtn) submitBtn.disabled = true;

    await changeSensorOperationalStatus(statusChangeContext.sensorId, {
      newStatus,
      ...(reason ? { reason } : {})
    });

    closeStatusChangeModal();
    toast('Sensor status updated successfully', 'success');
    await loadSensors();
  } catch (error) {
    const { message } = normalizeError(error);
    toast(message || 'Failed to update sensor status', 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function renderSummary(state) {
  const summaryText = $('#sensors-summary-text');
  const activeBadge = $('#sensors-summary-active');
  const inactiveBadge = $('#sensors-summary-inactive');
  const maintenanceBadge = $('#sensors-summary-maintenance');

  const sensors = state?.items || [];
  const activeCount = sensors.filter((s) => normalizeSensorStatus(s.status) === 'Active').length;
  const inactiveCount = sensors.filter(
    (s) => normalizeSensorStatus(s.status) === 'Inactive'
  ).length;
  const maintenanceCount = sensors.filter(
    (s) => normalizeSensorStatus(s.status) === 'Maintenance'
  ).length;

  if (summaryText) {
    const total = Number(state?.totalCount ?? sensors.length ?? 0);
    const pageNumber = Number(state?.pageNumber ?? 1);
    const pageSize = Number(state?.pageSize ?? sensors.length ?? 1);
    const from = total === 0 ? 0 : (pageNumber - 1) * pageSize + 1;
    const to = total === 0 ? 0 : from + sensors.length - 1;
    summaryText.textContent = `Showing ${from}-${to} of ${total} (Page ${pageNumber}/${state?.pageCount ?? 1})`;
  }
  if (activeBadge) activeBadge.textContent = `${activeCount} ● Active`;
  if (inactiveBadge) inactiveBadge.textContent = `${inactiveCount} ● Inactive`;
  if (maintenanceBadge) maintenanceBadge.textContent = `${maintenanceCount} ● Maintenance`;
}

function updatePageOptions(pageCount, currentPage) {
  const pageSelect = $('#sensors-page-number');
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
  const prevBtn = $('#sensors-prev');
  const nextBtn = $('#sensors-next');
  if (!prevBtn || !nextBtn) return;

  prevBtn.disabled = !state.hasPreviousPage;
  nextBtn.disabled = !state.hasNextPage;
}

async function fetchAllPages(fetchFn, baseParams = {}) {
  const allItems = [];
  let pageNumber = 1;
  const pageSize = 100;
  let keepFetching = true;
  let maxPagesSafety = 25;

  while (keepFetching && maxPagesSafety > 0) {
    const response = await fetchFn({ ...baseParams, pageNumber, pageSize });
    const items = response?.data || response?.items || response?.results || [];
    allItems.push(...(Array.isArray(items) ? items : []));

    if (response?.hasNextPage === true) {
      pageNumber += 1;
      maxPagesSafety -= 1;
    } else {
      keepFetching = false;
    }
  }

  return allItems;
}

async function loadPropertyFilter() {
  const select = $('#filter-property');
  if (!select) return;

  const currentValue = select.value;

  try {
    const properties = await fetchAllPages((params) => getProperties(params), {
      sortBy: 'name',
      sortDirection: 'asc',
      filter: ''
    });

    select.innerHTML = `<option value="">All Properties</option>${properties
      .map((property) => `<option value="${property.id}">${property.name}</option>`)
      .join('')}`;

    if (currentValue) {
      select.value = currentValue;
    }
  } catch (error) {
    console.error('Error loading property filter options:', error);
  }
}

async function loadPlotFilter(propertyId = '') {
  const select = $('#filter-plot');
  if (!select) return;

  const currentValue = select.value;

  try {
    const plots = await fetchAllPages((params) => getPlotsPaginated(params), {
      sortBy: 'name',
      sortDirection: 'asc',
      filter: '',
      propertyId: propertyId || ''
    });

    select.innerHTML = `<option value="">All Plots</option>${plots
      .map((plot) => `<option value="${plot.id}">${plot.name} • ${plot.propertyName}</option>`)
      .join('')}`;

    if (currentValue && !propertyId) {
      select.value = currentValue;
    }
  } catch (error) {
    console.error('Error loading plot filter options:', error);
  }
}

function setupEventListeners() {
  const filterForm = $('#sensorsFilterForm');
  filterForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const pageSelect = $('#sensors-page-number');
    if (pageSelect) pageSelect.value = '1';
    await loadSensors();
  });

  const propertyFilter = $('#filter-property');
  propertyFilter?.addEventListener('change', async () => {
    const selectedPropertyId = propertyFilter.value || '';
    await loadPlotFilter(selectedPropertyId);
    const pageSelect = $('#sensors-page-number');
    if (pageSelect) pageSelect.value = '1';
    await loadSensors();
  });

  const plotFilter = $('#filter-plot');
  plotFilter?.addEventListener('change', async () => {
    const pageSelect = $('#sensors-page-number');
    if (pageSelect) pageSelect.value = '1';
    await loadSensors();
  });

  const typeFilter = $('#filter-type');
  typeFilter?.addEventListener('change', async () => {
    const pageSelect = $('#sensors-page-number');
    if (pageSelect) pageSelect.value = '1';
    await loadSensors();
  });

  const statusFilter = $('#filter-status');
  statusFilter?.addEventListener('change', async () => {
    const pageSelect = $('#sensors-page-number');
    if (pageSelect) pageSelect.value = '1';
    await loadSensors();
  });

  const pageNumber = $('#sensors-page-number');
  pageNumber?.addEventListener('change', async () => {
    await loadSensors();
  });

  const pageSize = $('#sensors-page-size');
  pageSize?.addEventListener('change', async () => {
    const pageSelect = $('#sensors-page-number');
    if (pageSelect) pageSelect.value = '1';
    await loadSensors();
  });

  const sortBy = $('#sensors-sort-by');
  sortBy?.addEventListener('change', async () => {
    await loadSensors();
  });

  const sortDirection = $('#sensors-sort-direction');
  sortDirection?.addEventListener('change', async () => {
    await loadSensors();
  });

  const searchInput = $('#search-sensors');
  const debouncedSearch = debounce(() => {
    const pageSelect = $('#sensors-page-number');
    if (pageSelect) pageSelect.value = '1';
    loadSensors();
  }, 300);

  searchInput?.addEventListener('input', () => {
    debouncedSearch();
  });

  searchInput?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const pageSelect = $('#sensors-page-number');
    if (pageSelect) pageSelect.value = '1';
    loadSensors();
  });

  const prevBtn = $('#sensors-prev');
  prevBtn?.addEventListener('click', async () => {
    if (!lastPageState.hasPreviousPage) return;
    const pageSelect = $('#sensors-page-number');
    const current = Number(pageSelect?.value || 1);
    if (pageSelect && current > 1) {
      pageSelect.value = String(current - 1);
      await loadSensors();
    }
  });

  const nextBtn = $('#sensors-next');
  nextBtn?.addEventListener('click', async () => {
    if (!lastPageState.hasNextPage) return;
    const pageSelect = $('#sensors-page-number');
    const current = Number(pageSelect?.value || 1);
    if (pageSelect && current < lastPageState.pageCount) {
      pageSelect.value = String(current + 1);
      await loadSensors();
    }
  });

  const tbody = $('#sensors-tbody');
  tbody?.addEventListener('click', (event) => {
    const button = event.target.closest('.js-change-status');
    if (!button) return;

    const sensorId = button.dataset.sensorId;
    const sensorLabel = button.dataset.sensorLabel || '-';
    const currentStatus = button.dataset.currentStatus || 'Inactive';

    if (!sensorId) {
      toast('Sensor ID not found', 'error');
      return;
    }

    openStatusChangeModal({
      sensorId,
      sensorLabel,
      currentStatus
    });
  });

  const modal = $('#sensor-status-modal');
  const modalCloseButton = $('#sensor-status-modal-close');
  const modalCancelButton = $('#sensor-status-cancel');
  const modalForm = $('#sensor-status-form');

  modalCloseButton?.addEventListener('click', closeStatusChangeModal);
  modalCancelButton?.addEventListener('click', closeStatusChangeModal);
  modalForm?.addEventListener('submit', submitStatusChange);

  modal?.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeStatusChangeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!modal?.classList.contains('open')) return;
    closeStatusChangeModal();
  });
}

if (import.meta.env.DEV) {
  window.sensorsDebug = { loadSensors };
}
