import {
  createCatalogCropType,
  getCatalogCropType,
  getCropTypesPaginated,
  getProperties,
  updateCatalogCropType
} from './api.js';
import { initProtectedPage } from './common.js';
import { toast } from './i18n.js';
import {
  IRRIGATION_TYPES,
  IRRIGATION_TYPE_ICONS,
  normalizeIrrigationType
} from './irrigation-types.js';
import { getQueryParam, navigateTo } from './utils.js';

const MONTH_OPTIONS = [
  { name: 'January', short: 'Jan' },
  { name: 'February', short: 'Feb' },
  { name: 'March', short: 'Mar' },
  { name: 'April', short: 'Apr' },
  { name: 'May', short: 'May' },
  { name: 'June', short: 'Jun' },
  { name: 'July', short: 'Jul' },
  { name: 'August', short: 'Aug' },
  { name: 'September', short: 'Sep' },
  { name: 'October', short: 'Oct' },
  { name: 'November', short: 'Nov' },
  { name: 'December', short: 'Dec' }
];

const MONTH_TOKEN_MAP = MONTH_OPTIONS.reduce((map, month, index) => {
  map.set(month.name.toLowerCase(), index + 1);
  map.set(month.short.toLowerCase(), index + 1);
  return map;
}, new Map());

const editId = String(getQueryParam('id') || '').trim();
const isEditMode = editId.length > 0;

const ui = {};
const state = {
  defaultPropertyId: '',
  loadedPlantingWindow: null,
  hasTouchedPlantingWindow: false
};

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

function cacheElements() {
  ui.pageTitle = document.getElementById('pageTitle');
  ui.breadcrumbCurrent = document.getElementById('breadcrumbCurrent');
  ui.formTitle = document.getElementById('formTitle');
  ui.saveCropTypeBtn = document.getElementById('saveCropTypeBtn');

  ui.cropTypeForm = document.getElementById('cropTypeForm');
  ui.cropCatalogFormErrors = document.getElementById('cropCatalogFormErrors');

  ui.catalogIdField = document.getElementById('catalogIdField');
  ui.cropTypeNameField = document.getElementById('cropTypeNameField');
  ui.suggestedImageField = document.getElementById('suggestedImageField');
  ui.descriptionField = document.getElementById('descriptionField');
  ui.harvestCycleField = document.getElementById('harvestCycleField');
  ui.irrigationTypeField = document.getElementById('irrigationTypeField');
  ui.minSoilMoistureField = document.getElementById('minSoilMoistureField');
  ui.maxTemperatureField = document.getElementById('maxTemperatureField');
  ui.minHumidityField = document.getElementById('minHumidityField');

  ui.plantingStartMonthField = document.getElementById('plantingStartMonthField');
  ui.plantingEndMonthField = document.getElementById('plantingEndMonthField');
  ui.plantingWindowPreview = document.getElementById('plantingWindowPreview');
}

function setSaveEnabled(enabled) {
  if (ui.saveCropTypeBtn) {
    ui.saveCropTypeBtn.disabled = !enabled;
  }
}

function clearFormErrors() {
  if (!ui.cropCatalogFormErrors) {
    return;
  }

  ui.cropCatalogFormErrors.style.display = 'none';
  ui.cropCatalogFormErrors.innerHTML = '';
}

function showFormErrors(messages) {
  if (!ui.cropCatalogFormErrors) {
    return;
  }

  const errors = Array.isArray(messages) ? messages.filter(Boolean) : [String(messages || '')];
  if (errors.length === 0) {
    clearFormErrors();
    return;
  }

  ui.cropCatalogFormErrors.innerHTML = `<ul style="margin: 0; padding-left: 18px">${errors
    .map((message) => `<li>${escapeHtml(message)}</li>`)
    .join('')}</ul>`;
  ui.cropCatalogFormErrors.style.display = 'block';
}

function populateIrrigationTypes() {
  if (!ui.irrigationTypeField) {
    return;
  }

  const options = ['<option value="">Select...</option>']
    .concat(
      IRRIGATION_TYPES.map((type) => {
        const icon = IRRIGATION_TYPE_ICONS[type] || '💦';
        return `<option value="${escapeHtml(type)}">${escapeHtml(`${icon} ${type}`)}</option>`;
      })
    )
    .join('');

  ui.irrigationTypeField.innerHTML = options;
}

function populatePlantingMonthOptions() {
  const monthOptions = ['<option value="">Select...</option>']
    .concat(
      MONTH_OPTIONS.map(
        (month) => `<option value="${escapeHtml(month.name)}">${escapeHtml(month.name)}</option>`
      )
    )
    .join('');

  if (ui.plantingStartMonthField) {
    ui.plantingStartMonthField.innerHTML = monthOptions;
  }

  if (ui.plantingEndMonthField) {
    ui.plantingEndMonthField.innerHTML = monthOptions;
  }

  updatePlantingWindowPreview();
}

function getMonthNumber(value) {
  const token = String(value || '')
    .trim()
    .toLowerCase();
  if (!token) {
    return null;
  }

  if (MONTH_TOKEN_MAP.has(token)) {
    return MONTH_TOKEN_MAP.get(token) ?? null;
  }

  const numericMonth = Number.parseInt(token, 10);
  return Number.isFinite(numericMonth) && numericMonth >= 1 && numericMonth <= 12
    ? numericMonth
    : null;
}

function getMonthNameByNumber(monthNumber) {
  return MONTH_OPTIONS[monthNumber - 1]?.name || '';
}

function getMonthShortNameByNumber(monthNumber) {
  return MONTH_OPTIONS[monthNumber - 1]?.short || '';
}

function parsePlantingWindow(plantingWindow) {
  if (!plantingWindow || !String(plantingWindow).trim()) {
    return { startMonth: null, endMonth: null };
  }

  const candidate = String(plantingWindow).trim();
  const separators = [' to ', '-', '->', '/', '|'];

  for (const separator of separators) {
    const parts = candidate
      .split(separator)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length !== 2) {
      continue;
    }

    const startMonth = getMonthNumber(parts[0]);
    const endMonth = getMonthNumber(parts[1]);

    if (startMonth && endMonth) {
      return {
        startMonth,
        endMonth
      };
    }
  }

  const singleMonth = getMonthNumber(candidate);
  return singleMonth
    ? {
        startMonth: singleMonth,
        endMonth: singleMonth
      }
    : {
        startMonth: null,
        endMonth: null
      };
}

function buildPlantingWindow(startMonthValue, endMonthValue) {
  const startMonth = getMonthNumber(startMonthValue);
  const endMonth = getMonthNumber(endMonthValue || startMonthValue);

  if (!startMonth) {
    return null;
  }

  const resolvedEndMonth = endMonth || startMonth;
  const startLabel = getMonthShortNameByNumber(startMonth);
  const endLabel = getMonthShortNameByNumber(resolvedEndMonth);

  return startMonth === resolvedEndMonth ? startLabel : `${startLabel} to ${endLabel}`;
}

function getResolvedPlantingWindow() {
  const startMonth = toNullableTrimmedString(ui.plantingStartMonthField?.value);
  const endMonth = toNullableTrimmedString(ui.plantingEndMonthField?.value);

  if (!startMonth && !endMonth) {
    return state.hasTouchedPlantingWindow ? null : state.loadedPlantingWindow;
  }

  return buildPlantingWindow(startMonth || endMonth, endMonth || startMonth);
}

function updatePlantingWindowPreview() {
  if (!ui.plantingWindowPreview) {
    return;
  }

  ui.plantingWindowPreview.value =
    getResolvedPlantingWindow() || 'Select months to define the typical planting window';
}

function updateFormMode() {
  const modeLabel = isEditMode ? 'Edit Crop Type' : 'Add Crop Type';

  if (ui.pageTitle) {
    ui.pageTitle.textContent = modeLabel;
  }

  if (ui.breadcrumbCurrent) {
    ui.breadcrumbCurrent.textContent = isEditMode ? 'Edit' : 'Add New';
  }

  if (ui.formTitle) {
    ui.formTitle.textContent = modeLabel;
  }

  if (ui.saveCropTypeBtn) {
    ui.saveCropTypeBtn.textContent = isEditMode ? '💾 Save Changes' : '💾 Save';
  }

  if (ui.cropTypeNameField) {
    ui.cropTypeNameField.disabled = isEditMode;
  }
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

  return {
    catalogId,
    cropType,
    suggestedImage: toNullableTrimmedString(item?.suggestedImage ?? item?.SuggestedImage),
    plantingWindow: toNullableTrimmedString(item?.plantingWindow ?? item?.PlantingWindow),
    harvestCycleMonths: toNullableInteger(item?.harvestCycleMonths ?? item?.HarvestCycleMonths),
    suggestedIrrigationType: toNullableTrimmedString(
      item?.suggestedIrrigationType ??
        item?.SuggestedIrrigationType ??
        item?.recommendedIrrigationType ??
        item?.RecommendedIrrigationType
    ),
    minSoilMoisture: toNullableNumber(item?.minSoilMoisture ?? item?.MinSoilMoisture),
    maxTemperature: toNullableNumber(item?.maxTemperature ?? item?.MaxTemperature),
    minHumidity: toNullableNumber(item?.minHumidity ?? item?.MinHumidity),
    description: toNullableTrimmedString(item?.notes ?? item?.Notes)
  };
}

async function loadCreationContext() {
  try {
    const response = await getProperties({
      pageNumber: 1,
      pageSize: 500,
      sortBy: 'name',
      sortDirection: 'asc'
    });

    const items = extractItems(response);
    const firstProperty = items
      .map((property) => String(property?.id || property?.Id || '').trim())
      .find(Boolean);

    state.defaultPropertyId = firstProperty || '';

    if (!state.defaultPropertyId) {
      setSaveEnabled(false);
      showFormErrors([
        'At least one property must exist before creating tenant-scoped crop catalog entries.'
      ]);
      return;
    }

    setSaveEnabled(true);
  } catch (error) {
    console.error('Failed to load owner scope context for crop catalog creation.', error);
    setSaveEnabled(false);
    showFormErrors(['Failed to resolve the owner scope required to create this catalog entry.']);
    toast('Failed to load properties', 'error');
  }
}

async function loadCropTypeById(catalogId) {
  try {
    const direct = await getCatalogCropType(catalogId);
    const normalizedDirect = normalizeCatalogItem(direct);
    if (normalizedDirect) {
      return normalizedDirect;
    }
  } catch {
    // Fallback to paginated lookup when direct endpoint is unavailable.
  }

  const response = await getCropTypesPaginated({
    pageNumber: 1,
    pageSize: 200,
    source: 'Catalog',
    includeInactive: true
  });

  const found = extractItems(response).find((item) => {
    const foundId = String(
      item?.catalogId ||
        item?.CatalogId ||
        item?.cropTypeCatalogId ||
        item?.CropTypeCatalogId ||
        item?.id ||
        item?.Id ||
        ''
    ).trim();

    return foundId === catalogId;
  });

  return normalizeCatalogItem(found);
}

function applyEditValues(item) {
  if (!item) {
    return;
  }

  state.loadedPlantingWindow = item.plantingWindow || null;
  state.hasTouchedPlantingWindow = false;

  if (ui.catalogIdField) ui.catalogIdField.value = item.catalogId || editId;
  if (ui.cropTypeNameField) ui.cropTypeNameField.value = item.cropType || '';
  if (ui.suggestedImageField) ui.suggestedImageField.value = item.suggestedImage || '';
  if (ui.descriptionField) ui.descriptionField.value = item.description || '';
  if (ui.harvestCycleField) ui.harvestCycleField.value = item.harvestCycleMonths ?? '';
  if (ui.irrigationTypeField) {
    ui.irrigationTypeField.value = normalizeIrrigationType(item.suggestedIrrigationType) || '';
  }
  if (ui.minSoilMoistureField) ui.minSoilMoistureField.value = item.minSoilMoisture ?? '';
  if (ui.maxTemperatureField) ui.maxTemperatureField.value = item.maxTemperature ?? '';
  if (ui.minHumidityField) ui.minHumidityField.value = item.minHumidity ?? '';

  const parsedWindow = parsePlantingWindow(item.plantingWindow);
  if (parsedWindow.startMonth && ui.plantingStartMonthField) {
    ui.plantingStartMonthField.value = getMonthNameByNumber(parsedWindow.startMonth);
  }

  if (parsedWindow.endMonth && ui.plantingEndMonthField) {
    ui.plantingEndMonthField.value = getMonthNameByNumber(parsedWindow.endMonth);
  }

  updatePlantingWindowPreview();
}

function validateForm() {
  const errors = [];
  const cropType = toNullableTrimmedString(ui.cropTypeNameField?.value);
  const suggestedImage = toNullableTrimmedString(ui.suggestedImageField?.value);
  const description = toNullableTrimmedString(ui.descriptionField?.value);
  const minSoilMoisture = toNullableNumber(ui.minSoilMoistureField?.value);
  const maxTemperature = toNullableNumber(ui.maxTemperatureField?.value);
  const minHumidity = toNullableNumber(ui.minHumidityField?.value);
  const harvestCycleMonths = toNullableInteger(ui.harvestCycleField?.value);

  if (!cropType) {
    errors.push('Crop type name is required.');
  }

  if (!isEditMode && !state.defaultPropertyId) {
    errors.push('A property must exist before creating crop catalog entries.');
  }

  if (suggestedImage && suggestedImage.length > 10) {
    errors.push('Suggested image must not exceed 10 characters.');
  }

  if (description && description.length > 500) {
    errors.push('Description must not exceed 500 characters.');
  }

  if (minSoilMoisture !== null && (minSoilMoisture < 0 || minSoilMoisture > 100)) {
    errors.push('Min soil moisture must be between 0 and 100.');
  }

  if (maxTemperature !== null && (maxTemperature < -30 || maxTemperature > 80)) {
    errors.push('Max temperature must be between -30 and 80.');
  }

  if (minHumidity !== null && (minHumidity < 0 || minHumidity > 100)) {
    errors.push('Min humidity must be between 0 and 100.');
  }

  if (harvestCycleMonths !== null && (harvestCycleMonths < 1 || harvestCycleMonths > 36)) {
    errors.push('Harvest cycle must be between 1 and 36 months.');
  }

  return errors;
}

function buildBasePayload() {
  return {
    cropType: toNullableTrimmedString(ui.cropTypeNameField?.value),
    plantingWindow: getResolvedPlantingWindow(),
    harvestCycleMonths: toNullableInteger(ui.harvestCycleField?.value),
    suggestedIrrigationType: toNullableTrimmedString(
      normalizeIrrigationType(ui.irrigationTypeField?.value)
    ),
    minSoilMoisture: toNullableNumber(ui.minSoilMoistureField?.value),
    maxTemperature: toNullableNumber(ui.maxTemperatureField?.value),
    minHumidity: toNullableNumber(ui.minHumidityField?.value),
    notes: toNullableTrimmedString(ui.descriptionField?.value),
    suggestedImage: toNullableTrimmedString(ui.suggestedImageField?.value)
  };
}

function buildCreatePayload() {
  return {
    propertyId: state.defaultPropertyId,
    ...buildBasePayload()
  };
}

function buildUpdatePayload() {
  return buildBasePayload();
}

async function handleFormSubmit(event) {
  event.preventDefault();
  clearFormErrors();

  const validationErrors = validateForm();
  if (validationErrors.length > 0) {
    showFormErrors(validationErrors);
    return;
  }

  try {
    if (isEditMode) {
      await updateCatalogCropType(editId, buildUpdatePayload());
      toast('Crop type updated successfully', 'success');
    } else {
      await createCatalogCropType(buildCreatePayload());
      toast('Crop type created successfully', 'success');
    }

    navigateTo('crop-catalog.html');
  } catch (error) {
    console.error('Failed to save crop type.', error);

    const backendError =
      error?.response?.data?.title ||
      error?.response?.data?.message ||
      error?.response?.data?.detail ||
      'Failed to save crop type.';

    showFormErrors([backendError]);
    toast(backendError, 'error');
  }
}

function bindEvents() {
  [ui.plantingStartMonthField, ui.plantingEndMonthField].filter(Boolean).forEach((field) => {
    field.addEventListener('change', () => {
      state.hasTouchedPlantingWindow = true;
      updatePlantingWindowPreview();
    });
  });

  ui.cropTypeForm?.addEventListener('submit', handleFormSubmit);
}

async function initializePage() {
  if (!initProtectedPage()) {
    return;
  }

  cacheElements();
  clearFormErrors();
  updateFormMode();
  populateIrrigationTypes();
  populatePlantingMonthOptions();
  bindEvents();

  if (!isEditMode) {
    await loadCreationContext();
    ui.cropTypeNameField?.focus();
  }

  if (isEditMode) {
    const item = await loadCropTypeById(editId);
    if (!item) {
      showFormErrors(['Crop type catalog entry not found.']);
      toast('Crop type entry not found', 'error');
      return;
    }

    applyEditValues(item);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initializePage();
});
