/**
 * TC Agro Solutions - Properties Page Entry Point
 */

import { getProperties, deleteProperty, normalizeError } from './api.js';
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

  await loadProperties();
  setupEventListeners();
});

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

async function loadProperties(filters = getFiltersFromUI()) {
  const tbody = $('#properties-tbody');
  const summary = $('#propertiesSummary');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';

  try {
    const data = await getProperties(filters);
    const normalized = normalizePropertiesResponse(data, filters);

    renderPropertiesTable(normalized.items);
    updatePageOptions(normalized.pageCount, normalized.pageNumber);

    if (summary) {
      summary.textContent = `Showing ${normalized.items.length} of ${normalized.totalCount} properties · Page ${normalized.pageNumber} of ${normalized.pageCount}`;
    }
  } catch (error) {
    const { message } = normalizeError(error);
    console.error('Error loading properties:', error);
    tbody.innerHTML =
      '<tr><td colspan="7" class="text-center text-danger">Error loading properties</td></tr>';
    if (summary) summary.textContent = 'Failed to load properties';
    toast(message || 'properties.load_failed', 'error');
  }
}

function normalizePropertiesResponse(data, filters) {
  if (Array.isArray(data)) {
    const totalCount = data.length;
    const pageSize = filters?.pageSize || totalCount || 1;
    return {
      items: data,
      totalCount,
      pageNumber: filters?.pageNumber || 1,
      pageSize,
      pageCount: Math.max(1, Math.ceil(totalCount / pageSize))
    };
  }

  const items = data?.data || data?.items || data?.results || [];
  const totalCount = data?.totalCount ?? data?.total ?? items.length;
  const pageNumber = data?.pageNumber || filters?.pageNumber || 1;
  const pageSize = data?.pageSize || filters?.pageSize || 10;
  const pageCount = Math.max(1, Math.ceil((totalCount || 0) / pageSize));

  return { items, totalCount, pageNumber, pageSize, pageCount };
}

function renderPropertiesTable(properties) {
  const tbody = $('#properties-tbody');
  if (!tbody) return;

  if (!properties.length) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="text-center text-muted">No properties found</td></tr>';
    return;
  }

  tbody.innerHTML = properties
    .map((prop) => {
      const id = prop.id || '';
      const location = [prop.city, prop.state, prop.country].filter(Boolean).join(', ') || '-';
      const area = Number(prop.areaHectares || 0);
      const plots = Number(prop.plotCount || 0);
      const isActive = prop.isActive !== false;
      const createdAt = prop.createdAt ? new Date(prop.createdAt).toLocaleDateString('en-US') : '-';

      return `
    <tr data-id="${id}">
      <td><strong>${prop.name || '-'}</strong></td>
      <td>${location}</td>
      <td>${area.toLocaleString('en-US')} ha</td>
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
    await loadProperties();
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
  const confirmed = await showConfirm('Are you sure you want to delete this property?');

  if (confirmed) {
    try {
      await deleteProperty(id);
      toast('properties.delete_success', 'success');
      await loadProperties();
    } catch (error) {
      console.error('Error deleting property:', error);
      toast('properties.delete_failed', 'error');
    }
  }
}

// Export for debugging
if (import.meta.env.DEV) {
  window.propertiesDebug = { loadProperties, handleDelete };
}
