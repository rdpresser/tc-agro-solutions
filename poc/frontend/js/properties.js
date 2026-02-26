/**
 * TC Agro Solutions - Properties Page Entry Point
 */

import { getProperties, normalizeError } from './api.js';
import { initProtectedPage } from './common.js';
import { toast } from './i18n.js';
import {
  $,
  getPageUrl,
  debounce,
  formatDate,
  formatArea,
  getPaginatedItems,
  getPaginatedTotalCount,
  getPaginatedPageNumber,
  getPaginatedPageSize
} from './utils.js';

// ============================================
// PAGE INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth and setup page (must be inside DOMContentLoaded for sidebar elements)
  if (!initProtectedPage()) {
    return;
  }

  await loadProperties();
  setupEventListeners();
});

let lastPageState = {
  pageNumber: 1,
  pageCount: 1,
  hasNextPage: false,
  hasPreviousPage: false
};

// ============================================
// DATA LOADING
// ============================================

function getFiltersFromUI() {
  return {
    pageNumber: Number($('#pageNumber')?.value || 1),
    pageSize: Number($('#pageSize')?.value || 10),
    sortBy: $('#sortBy')?.value || 'name',
    sortDirection: $('#sortDirection')?.value || 'asc',
    filter: $('#filterInput')?.value?.trim() || ''
  };
}

function updatePageOptions(pageCount, currentPage) {
  const pageSelect = $('#pageNumber');
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
  const prevBtn = $('#propertiesPrev');
  const nextBtn = $('#propertiesNext');
  if (!prevBtn || !nextBtn) return;

  prevBtn.disabled = !state.hasPreviousPage;
  nextBtn.disabled = !state.hasNextPage;
}

async function loadProperties(filters = getFiltersFromUI()) {
  const tbody = $('#properties-tbody');
  const summary = $('#propertiesSummary');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="8" class="text-center">Loading...</td></tr>';

  try {
    const data = await getProperties(filters);
    const normalized = normalizePropertiesResponse(data, filters);

    renderPropertiesTable(normalized.items);
    updatePageOptions(normalized.pageCount, normalized.pageNumber);
    updatePagerControls(normalized);
    lastPageState = normalized;

    if (summary) {
      const total = Number(normalized.totalCount || 0);
      const from = total === 0 ? 0 : (normalized.pageNumber - 1) * normalized.pageSize + 1;
      const to = total === 0 ? 0 : from + normalized.items.length - 1;
      summary.textContent = `Showing ${from}-${to} of ${total} (Page ${normalized.pageNumber}/${normalized.pageCount})`;
    }
  } catch (error) {
    const { message } = normalizeError(error);
    console.error('Error loading properties:', error);
    tbody.innerHTML =
      '<tr><td colspan="8" class="text-center text-danger">Error loading properties</td></tr>';
    if (summary) summary.textContent = 'Failed to load properties';
    toast(message || 'properties.load_failed', 'error');
  }
}

function normalizePropertiesResponse(data, filters) {
  if (Array.isArray(data)) {
    const totalCount = data.length;
    const pageSize = getPaginatedPageSize(null, filters?.pageSize || totalCount || 1);
    return {
      items: data,
      totalCount,
      pageNumber: getPaginatedPageNumber(null, filters?.pageNumber || 1),
      pageSize,
      pageCount: Math.max(1, Math.ceil(totalCount / pageSize))
    };
  }

  const items = getPaginatedItems(data, []);
  const totalCount = getPaginatedTotalCount(data, items.length);
  const pageNumber = getPaginatedPageNumber(data, filters?.pageNumber || 1);
  const pageSize = getPaginatedPageSize(data, filters?.pageSize || 10);
  const pageCount = Math.max(1, Math.ceil((totalCount || 0) / pageSize));
  const hasPreviousPage = data?.hasPreviousPage ?? pageNumber > 1;
  const hasNextPage = data?.hasNextPage ?? pageNumber < pageCount;

  return { items, totalCount, pageNumber, pageSize, pageCount, hasNextPage, hasPreviousPage };
}

function renderPropertiesTable(properties) {
  const tbody = $('#properties-tbody');
  if (!tbody) return;

  if (!properties.length) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="text-center text-muted">No properties found</td></tr>';
    return;
  }

  tbody.innerHTML = properties
    .map((prop) => {
      const id = prop.id || '';
      const ownerName = prop.ownerName || '-';
      const location = [prop.city, prop.state, prop.country].filter(Boolean).join(', ') || '-';
      const area = Number(prop.areaHectares || 0);
      const plots = Number(prop.plotCount || 0);
      const isActive = prop.isActive !== false;
      const createdAt = formatDate(prop.createdAt);

      return `
    <tr data-id="${id}">
      <td><strong>${ownerName}</strong></td>
      <td>${prop.name || '-'}</td>
      <td>${location}</td>
      <td>${formatArea(area)}</td>
      <td>${plots} plot(s)</td>
      <td>
        <span class="badge ${isActive ? 'badge-success' : 'badge-secondary'}">
          ${isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td>${createdAt}</td>
      <td class="actions">
        <a href="${getPageUrl('properties-form.html')}?id=${encodeURIComponent(id)}" class="btn btn-sm btn-outline">✏️ Edit</a>
        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${id}">🗑️</button>
      </td>
    </tr>
  `;
    })
    .join('');
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  const filterForm = $('#propertiesFilterForm');
  filterForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await loadProperties();
  });

  const pageNumber = $('#pageNumber');
  pageNumber?.addEventListener('change', async () => {
    await loadProperties();
  });

  const pageSize = $('#pageSize');
  pageSize?.addEventListener('change', async () => {
    const pageSelect = $('#pageNumber');
    if (pageSelect) pageSelect.value = '1';
    await loadProperties();
  });

  const sortBy = $('#sortBy');
  sortBy?.addEventListener('change', async () => {
    await loadProperties();
  });

  const sortDirection = $('#sortDirection');
  sortDirection?.addEventListener('change', async () => {
    await loadProperties();
  });

  // Debounced search on input (300ms delay)
  const filterInput = $('#filterInput');
  const debouncedSearch = debounce(() => {
    const pageSelect = $('#pageNumber');
    if (pageSelect) pageSelect.value = '1';
    loadProperties();
  }, 300);

  filterInput?.addEventListener('input', () => {
    debouncedSearch();
  });

  // Immediate search on Enter key
  filterInput?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const pageSelect = $('#pageNumber');
    if (pageSelect) pageSelect.value = '1';
    loadProperties();
  });

  const prevBtn = $('#propertiesPrev');
  prevBtn?.addEventListener('click', async () => {
    if (!lastPageState.hasPreviousPage) return;
    const pageSelect = $('#pageNumber');
    const current = Number(pageSelect?.value || 1);
    if (pageSelect && current > 1) {
      pageSelect.value = String(current - 1);
      await loadProperties();
    }
  });

  const nextBtn = $('#propertiesNext');
  nextBtn?.addEventListener('click', async () => {
    if (!lastPageState.hasNextPage) return;
    const pageSelect = $('#pageNumber');
    const current = Number(pageSelect?.value || 1);
    if (pageSelect && current < lastPageState.pageCount) {
      pageSelect.value = String(current + 1);
      await loadProperties();
    }
  });

  // Delete button handler (event delegation)
  const tbody = $('#properties-tbody');
  tbody?.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('[data-action="delete"]');
    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      await handleDelete(id);
    }
  });
}

async function handleDelete(id) {
  void id;
  window.alert(
    'Property deletion will be implemented in a future version with the client, considering plot and sensor relationships.'
  );
}

// Export for debugging
if (import.meta.env.DEV) {
  window.propertiesDebug = { loadProperties, handleDelete };
}
