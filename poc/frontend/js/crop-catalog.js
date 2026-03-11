import { deactivateCatalogCropType, getCropTypesPaginated } from './api.js';
import { initProtectedPage } from './common.js';
import { toast } from './i18n.js';
import { getIrrigationTypeDisplay } from './irrigation-types.js';
import { navigateTo } from './utils.js';

let currentPage = 1;
let pageSize = 10;
let totalPages = 1;
let totalItems = 0;
let currentCatalogItems = [];

const ui = {};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toNullableNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableInteger(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableTrimmedString(value) {
  const text = String(value || '').trim();
  return text.length > 0 ? text : null;
}

function extractItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (Array.isArray(payload?.results)) {
    return payload.results;
  }

  return [];
}

function resolvePagination(payload, fallbackCount = 0) {
  const pageNumber =
    Number(payload?.pageNumber ?? payload?.PageNumber ?? currentPage) || currentPage;
  const candidateTotalPages = Number(payload?.totalPages ?? payload?.TotalPages ?? 1);
  const totalPagesValue =
    Number.isFinite(candidateTotalPages) && candidateTotalPages > 0 ? candidateTotalPages : 1;
  const totalCountCandidate = Number(payload?.totalCount ?? payload?.TotalCount ?? fallbackCount);
  const totalCountValue = Number.isFinite(totalCountCandidate)
    ? totalCountCandidate
    : fallbackCount;

  return {
    pageNumber,
    totalPages: totalPagesValue,
    totalCount: totalCountValue,
    hasPreviousPage: Boolean(
      payload?.hasPreviousPage ?? payload?.HasPreviousPage ?? pageNumber > 1
    ),
    hasNextPage: Boolean(
      payload?.hasNextPage ?? payload?.HasNextPage ?? pageNumber < totalPagesValue
    )
  };
}

function normalizeCatalogItem(item) {
  const catalogId = String(
    item?.catalogId ||
      item?.CatalogId ||
      item?.cropTypeCatalogId ||
      item?.CropTypeCatalogId ||
      item?.id ||
      item?.Id ||
      ''
  ).trim();

  const cropType = String(item?.cropType || item?.CropType || '').trim();
  if (!cropType) {
    return null;
  }

  const source = String(item?.source || item?.Source || 'Catalog').trim() || 'Catalog';

  return {
    catalogId,
    cropType,
    suggestedImage: toNullableTrimmedString(item?.suggestedImage ?? item?.SuggestedImage),
    source,
    isActive: item?.isActive ?? item?.IsActive ?? true,
    isStale: Boolean(item?.isStale ?? item?.IsStale),
    plantingWindow: toNullableTrimmedString(item?.plantingWindow ?? item?.PlantingWindow),
    harvestCycleMonths: toNullableInteger(item?.harvestCycleMonths ?? item?.HarvestCycleMonths),
    recommendedIrrigationType: toNullableTrimmedString(
      item?.recommendedIrrigationType ??
        item?.RecommendedIrrigationType ??
        item?.suggestedIrrigationType ??
        item?.SuggestedIrrigationType
    ),
    minSoilMoisture: toNullableNumber(item?.minSoilMoisture ?? item?.MinSoilMoisture),
    maxTemperature: toNullableNumber(item?.maxTemperature ?? item?.MaxTemperature),
    minHumidity: toNullableNumber(item?.minHumidity ?? item?.MinHumidity),
    notes: toNullableTrimmedString(item?.notes ?? item?.Notes),
    createdAt: item?.createdAt || item?.CreatedAt || null
  };
}

function cacheElements() {
  ui.addCropTypeBtn = document.getElementById('addCropTypeBtn');
  ui.catalogFilterForm = document.getElementById('catalogFilterForm');
  ui.filterInput = document.getElementById('filterInput');
  ui.includeInactiveFilter = document.getElementById('includeInactiveFilter');
  ui.clearFiltersBtn = document.getElementById('clearFiltersBtn');

  ui.catalogTableBody = document.getElementById('catalogTableBody');
  ui.prevPageBtn = document.getElementById('prevPageBtn');
  ui.nextPageBtn = document.getElementById('nextPageBtn');
  ui.pageInfo = document.getElementById('pageInfo');
  ui.pageSizeSelect = document.getElementById('pageSizeSelect');
  ui.catalogSummary = document.getElementById('catalogSummary');
}

function resolveStatusBadges(item) {
  const badges = [];

  if (item.isActive === false) {
    badges.push('<span class="badge badge-danger">Inactive</span>');
  }

  if (item.isStale) {
    badges.push('<span class="badge badge-warning">Stale</span>');
  }

  if (badges.length === 0) {
    badges.push('<span class="badge badge-success">Active</span>');
  }

  return badges.join(' ');
}

function renderCatalogTable() {
  if (!ui.catalogTableBody) {
    return;
  }

  if (!Array.isArray(currentCatalogItems) || currentCatalogItems.length === 0) {
    ui.catalogTableBody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center text-muted">No crop types found for the selected filters.</td>
      </tr>
    `;
    return;
  }

  ui.catalogTableBody.innerHTML = currentCatalogItems
    .map((item) => {
      const createdAt = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-';
      const irrigationDisplay = getIrrigationTypeDisplay(item.recommendedIrrigationType);
      const suggestedImageDisplay = item.suggestedImage
        ? `<span>${escapeHtml(item.suggestedImage)}</span>`
        : '<span class="text-muted">-</span>';
      const thresholds = [
        item.minSoilMoisture !== null ? `${item.minSoilMoisture}%` : null,
        item.maxTemperature !== null ? `${item.maxTemperature}°C` : null,
        item.minHumidity !== null ? `${item.minHumidity}%` : null
      ]
        .filter(Boolean)
        .join(' · ');

      const actionButtons = item.catalogId
        ? `
          <button class="btn btn-sm btn-outline" data-action="edit" data-id="${escapeHtml(item.catalogId)}">Edit</button>
          <button class="btn btn-sm btn-danger" data-action="deactivate" data-id="${escapeHtml(item.catalogId)}">Deactivate</button>
        `
        : '<span class="text-muted">Unavailable</span>';

      return `
        <tr>
          <td>
            <strong>${escapeHtml(item.cropType)}</strong>
            <div class="text-muted" style="font-size: 12px">${escapeHtml(item.notes || '')}</div>
          </td>
          <td>${suggestedImageDisplay}</td>
          <td>${escapeHtml(item.plantingWindow || '-')}</td>
          <td>${item.harvestCycleMonths ?? '-'}</td>
          <td>${escapeHtml(irrigationDisplay)}</td>
          <td>${escapeHtml(thresholds || '-')}</td>
          <td>${resolveStatusBadges(item)}</td>
          <td>${escapeHtml(createdAt)}</td>
          <td class="d-flex" style="gap: 6px; flex-wrap: wrap">${actionButtons}</td>
        </tr>
      `;
    })
    .join('');
}

function updatePaginationUi(meta) {
  currentPage = meta.pageNumber;
  totalPages = meta.totalPages;
  totalItems = meta.totalCount;

  if (ui.pageInfo) {
    ui.pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  }

  if (ui.catalogSummary) {
    ui.catalogSummary.textContent = `${totalItems} item(s) found`;
  }

  if (ui.prevPageBtn) {
    ui.prevPageBtn.disabled = !meta.hasPreviousPage;
  }

  if (ui.nextPageBtn) {
    ui.nextPageBtn.disabled = !meta.hasNextPage;
  }
}

async function loadCatalog() {
  try {
    const response = await getCropTypesPaginated({
      pageNumber: currentPage,
      pageSize,
      sortBy: 'createdAt',
      sortDirection: 'desc',
      filter: String(ui.filterInput?.value || '').trim(),
      source: 'Catalog',
      includeInactive: Boolean(ui.includeInactiveFilter?.checked)
    });

    currentCatalogItems = extractItems(response).map(normalizeCatalogItem).filter(Boolean);

    renderCatalogTable();
    updatePaginationUi(resolvePagination(response, currentCatalogItems.length));
  } catch (error) {
    console.error('Failed to load crop catalog.', error);
    currentCatalogItems = [];
    renderCatalogTable();
    updatePaginationUi(resolvePagination({}, 0));
    toast('Failed to load crop catalog', 'error');
  }
}

async function handleDeactivate(catalogId) {
  if (!catalogId) {
    return;
  }

  const selected = currentCatalogItems.find((item) => item.catalogId === catalogId);
  const cropLabel = selected?.cropType || 'this crop type';

  const confirmed = window.confirm(`Deactivate ${cropLabel}?`);
  if (!confirmed) {
    return;
  }

  try {
    await deactivateCatalogCropType(catalogId);
    toast('Crop type deactivated successfully', 'success');

    if (currentPage > 1 && currentCatalogItems.length === 1) {
      currentPage -= 1;
    }

    await loadCatalog();
  } catch (error) {
    console.error('Failed to deactivate crop type.', error);
    toast('Failed to deactivate crop type', 'error');
  }
}

function bindCatalogTableActions() {
  if (!ui.catalogTableBody) {
    return;
  }

  ui.catalogTableBody.addEventListener('click', (event) => {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') {
      return;
    }

    const button = target.closest('button[data-action]');
    if (!button) {
      return;
    }

    const action = String(button.getAttribute('data-action') || '');
    const catalogId = String(button.getAttribute('data-id') || '');

    if (!catalogId) {
      return;
    }

    if (action === 'edit') {
      navigateTo(`crop-catalog-form.html?id=${encodeURIComponent(catalogId)}`);
      return;
    }

    if (action === 'deactivate') {
      handleDeactivate(catalogId);
    }
  });
}

function bindEvents() {
  ui.addCropTypeBtn?.addEventListener('click', () => {
    navigateTo('crop-catalog-form.html');
  });

  ui.catalogFilterForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    currentPage = 1;
    await loadCatalog();
  });

  ui.clearFiltersBtn?.addEventListener('click', async () => {
    if (ui.filterInput) ui.filterInput.value = '';
    if (ui.includeInactiveFilter) ui.includeInactiveFilter.checked = false;

    currentPage = 1;
    await loadCatalog();
  });

  ui.pageSizeSelect?.addEventListener('change', async () => {
    pageSize = Number(ui.pageSizeSelect?.value || 10);
    currentPage = 1;
    await loadCatalog();
  });

  ui.prevPageBtn?.addEventListener('click', async () => {
    if (currentPage <= 1) {
      return;
    }

    currentPage -= 1;
    await loadCatalog();
  });

  ui.nextPageBtn?.addEventListener('click', async () => {
    if (currentPage >= totalPages) {
      return;
    }

    currentPage += 1;
    await loadCatalog();
  });

  bindCatalogTableActions();
}

async function initializePage() {
  if (!initProtectedPage()) {
    return;
  }

  cacheElements();
  bindEvents();

  pageSize = Number(ui.pageSizeSelect?.value || 10);

  await loadCatalog();
}

document.addEventListener('DOMContentLoaded', () => {
  initializePage();
});
