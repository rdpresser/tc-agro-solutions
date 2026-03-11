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
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

const WEEK_OPTIONS = ['1', '2', '3', '4', '5'];

const editId = String(getQueryParam('id') || '').trim();
const isEditMode = editId.length > 0;

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

function cacheElements() {
  ui.pageTitle = document.getElementById('pageTitle');
  ui.breadcrumbCurrent = document.getElementById('breadcrumbCurrent');
  ui.formTitle = document.getElementById('formTitle');
  ui.saveCropTypeBtn = document.getElementById('saveCropTypeBtn');

  ui.cropTypeForm = document.getElementById('cropTypeForm');
  ui.cropCatalogFormErrors = document.getElementById('cropCatalogFormErrors');

  ui.catalogIdField = document.getElementById('catalogIdField');
  ui.cropTypeNameField = document.getElementById('cropTypeNameField');
  ui.propertyIdField = document.getElementById('propertyIdField');
  ui.plantingWindowField = document.getElementById('plantingWindowField');
  ui.harvestCycleField = document.getElementById('harvestCycleField');
  ui.irrigationTypeField = document.getElementById('irrigationTypeField');
  ui.minSoilMoistureField = document.getElementById('minSoilMoistureField');
  ui.maxTemperatureField = document.getElementById('maxTemperatureField');
  ui.minHumidityField = document.getElementById('minHumidityField');
  ui.notesField = document.getElementById('notesField');

  ui.plantingStartMonthField = document.getElementById('plantingStartMonthField');
  ui.plantingStartWeekField = document.getElementById('plantingStartWeekField');
  ui.plantingEndMonthField = document.getElementById('plantingEndMonthField');
  ui.plantingEndWeekField = document.getElementById('plantingEndWeekField');
  ui.plantingWindowPreview = document.getElementById('plantingWindowPreview');
  ui.applyPlantingWindowPresetBtn = document.getElementById('applyPlantingWindowPresetBtn');
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

function populatePlantingWindowBuilderOptions() {
  const monthOptions = ['<option value="">Select...</option>']
    .concat(
      MONTH_OPTIONS.map(
        (month) => `<option value="${escapeHtml(month)}">${escapeHtml(month)}</option>`
      )
    )
    .join('');

  if (ui.plantingStartMonthField) {
    ui.plantingStartMonthField.innerHTML = monthOptions;
  }

  if (ui.plantingEndMonthField) {
    ui.plantingEndMonthField.innerHTML = monthOptions;
  }

  const weekOptions = ['<option value="">Any week</option>']
    .concat(WEEK_OPTIONS.map((week) => `<option value="${week}">Week ${week}</option>`))
    .join('');

  if (ui.plantingStartWeekField) {
    ui.plantingStartWeekField.innerHTML = weekOptions;
  }

  if (ui.plantingEndWeekField) {
    ui.plantingEndWeekField.innerHTML = weekOptions;
  }

  updatePlantingWindowPreview();
}

function buildPlantingWindowFromBuilder() {
  const startMonth = String(ui.plantingStartMonthField?.value || '').trim();
  const startWeek = String(ui.plantingStartWeekField?.value || '').trim();
  const endMonth = String(ui.plantingEndMonthField?.value || '').trim();
  const endWeek = String(ui.plantingEndWeekField?.value || '').trim();

  if (!startMonth && !endMonth) {
    return '';
  }

  if (startMonth && !endMonth && !startWeek) {
    return startMonth;
  }

  if (startMonth && !endMonth && startWeek) {
    return `${startMonth} (Week ${startWeek})`;
  }

  if (startMonth && endMonth && startMonth === endMonth) {
    if (startWeek && endWeek) {
      if (startWeek === endWeek) {
        return `${startMonth} (Week ${startWeek})`;
      }
      return `${startMonth} (Weeks ${startWeek}-${endWeek})`;
    }

    if (startWeek) {
      return `${startMonth} (from Week ${startWeek})`;
    }

    if (endWeek) {
      return `${startMonth} (until Week ${endWeek})`;
    }

    return startMonth;
  }

  const safeStartMonth = startMonth || endMonth;
  const safeEndMonth = endMonth || startMonth;
  const startLabel = startWeek ? `${safeStartMonth} (Week ${startWeek})` : safeStartMonth;
  const endLabel = endWeek ? `${safeEndMonth} (Week ${endWeek})` : safeEndMonth;

  return `${startLabel} - ${endLabel}`;
}

function updatePlantingWindowPreview() {
  if (!ui.plantingWindowPreview) {
    return;
  }

  const generatedWindow = buildPlantingWindowFromBuilder();
  ui.plantingWindowPreview.value =
    generatedWindow || 'Select months/weeks to generate a planting window';
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

  if (ui.propertyIdField) {
    ui.propertyIdField.disabled = isEditMode;
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
    propertyId: String(item?.propertyId || item?.PropertyId || '').trim(),
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
    notes: toNullableTrimmedString(item?.notes ?? item?.Notes)
  };
}

async function loadProperties() {
  try {
    const response = await getProperties({
      pageNumber: 1,
      pageSize: 500,
      sortBy: 'name',
      sortDirection: 'asc'
    });

    const items = Array.isArray(response)
      ? response
      : Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.items)
          ? response.items
          : [];

    if (ui.propertyIdField) {
      ui.propertyIdField.innerHTML = ['<option value="">Select property...</option>']
        .concat(
          items
            .map((property) => {
              const id = String(property?.id || property?.Id || '').trim();
              if (!id) {
                return null;
              }

              const name = String(property?.name || property?.Name || 'Unnamed Property').trim();
              return `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`;
            })
            .filter(Boolean)
        )
        .join('');
    }
  } catch (error) {
    console.error('Failed to load properties.', error);
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
    pageSize: 500,
    includeStale: true,
    includeInactive: true
  });

  const items = Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response?.items)
      ? response.items
      : Array.isArray(response?.results)
        ? response.results
        : [];

  const found = items.find((item) => {
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

  if (ui.catalogIdField) ui.catalogIdField.value = item.catalogId || editId;
  if (ui.cropTypeNameField) ui.cropTypeNameField.value = item.cropType || '';
  if (ui.propertyIdField) ui.propertyIdField.value = item.propertyId || '';
  if (ui.plantingWindowField) ui.plantingWindowField.value = item.plantingWindow || '';
  if (ui.harvestCycleField) ui.harvestCycleField.value = item.harvestCycleMonths ?? '';
  if (ui.irrigationTypeField) {
    ui.irrigationTypeField.value = normalizeIrrigationType(item.recommendedIrrigationType) || '';
  }
  if (ui.minSoilMoistureField) ui.minSoilMoistureField.value = item.minSoilMoisture ?? '';
  if (ui.maxTemperatureField) ui.maxTemperatureField.value = item.maxTemperature ?? '';
  if (ui.minHumidityField) ui.minHumidityField.value = item.minHumidity ?? '';
  if (ui.notesField) ui.notesField.value = item.notes || '';
}

function validateForm() {
  const errors = [];

  if (!isEditMode) {
    if (!toNullableTrimmedString(ui.cropTypeNameField?.value)) {
      errors.push('Crop type name is required.');
    }

    if (!toNullableTrimmedString(ui.propertyIdField?.value)) {
      errors.push('Property is required.');
    }
  }

  const minSoilMoisture = toNullableNumber(ui.minSoilMoistureField?.value);
  const maxTemperature = toNullableNumber(ui.maxTemperatureField?.value);
  const minHumidity = toNullableNumber(ui.minHumidityField?.value);
  const harvestCycleMonths = toNullableInteger(ui.harvestCycleField?.value);

  if (minSoilMoisture !== null && (minSoilMoisture < 0 || minSoilMoisture > 100)) {
    errors.push('Min soil moisture must be between 0 and 100.');
  }

  if (maxTemperature !== null && (maxTemperature < -50 || maxTemperature > 70)) {
    errors.push('Max temperature must be between -50 and 70.');
  }

  if (minHumidity !== null && (minHumidity < 0 || minHumidity > 100)) {
    errors.push('Min humidity must be between 0 and 100.');
  }

  if (harvestCycleMonths !== null && (harvestCycleMonths < 1 || harvestCycleMonths > 36)) {
    errors.push('Harvest cycle must be between 1 and 36 months.');
  }

  return errors;
}

function buildCreatePayload() {
  return {
    propertyId: toNullableTrimmedString(ui.propertyIdField?.value),
    cropType: toNullableTrimmedString(ui.cropTypeNameField?.value),
    plantingWindow: toNullableTrimmedString(ui.plantingWindowField?.value),
    harvestCycleMonths: toNullableInteger(ui.harvestCycleField?.value),
    recommendedIrrigationType: toNullableTrimmedString(
      normalizeIrrigationType(ui.irrigationTypeField?.value)
    ),
    minSoilMoisture: toNullableNumber(ui.minSoilMoistureField?.value),
    maxTemperature: toNullableNumber(ui.maxTemperatureField?.value),
    minHumidity: toNullableNumber(ui.minHumidityField?.value),
    notes: toNullableTrimmedString(ui.notesField?.value)
  };
}

function buildUpdatePayload() {
  return {
    plantingWindow: toNullableTrimmedString(ui.plantingWindowField?.value),
    harvestCycleMonths: toNullableInteger(ui.harvestCycleField?.value),
    recommendedIrrigationType: toNullableTrimmedString(
      normalizeIrrigationType(ui.irrigationTypeField?.value)
    ),
    minSoilMoisture: toNullableNumber(ui.minSoilMoistureField?.value),
    maxTemperature: toNullableNumber(ui.maxTemperatureField?.value),
    minHumidity: toNullableNumber(ui.minHumidityField?.value),
    notes: toNullableTrimmedString(ui.notesField?.value)
  };
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
  [
    ui.plantingStartMonthField,
    ui.plantingStartWeekField,
    ui.plantingEndMonthField,
    ui.plantingEndWeekField
  ]
    .filter(Boolean)
    .forEach((field) => {
      field.addEventListener('change', updatePlantingWindowPreview);
    });

  ui.applyPlantingWindowPresetBtn?.addEventListener('click', () => {
    const generated = buildPlantingWindowFromBuilder();
    if (!generated) {
      toast('Select at least one month to generate planting window', 'warning');
      return;
    }

    if (ui.plantingWindowField) {
      ui.plantingWindowField.value = generated;
    }

    toast('Planting window generated', 'success');
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
  populatePlantingWindowBuilderOptions();
  bindEvents();

  await loadProperties();

  if (isEditMode) {
    const item = await loadCropTypeById(editId);
    if (!item) {
      showFormErrors(['Crop type entry not found.']);
      toast('Crop type entry not found', 'error');
      return;
    }

    applyEditValues(item);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initializePage();
});
