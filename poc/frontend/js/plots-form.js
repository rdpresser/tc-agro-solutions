/**
 * Plots Form Page - TC Agro Solutions
 * Entry point script for plot create/edit
 */

import {
  createPlot,
  fetchFarmSwagger,
  getPlot,
  getProperties,
  normalizeError,
  getOwnersPaginated,
  getOwnersQueryParameterMapFromSwagger
} from './api.js';
import { requireAuth } from './auth.js';
import { initProtectedPage } from './common.js';
import { COMMON_CROP_TYPES, CROP_TYPE_ICONS, normalizeCropType } from './crop-types.js';
import { toast, t } from './i18n.js';
import {
  IRRIGATION_TYPES,
  IRRIGATION_TYPE_ICONS,
  normalizeIrrigationType
} from './irrigation-types.js';
import { $id, getQueryParam, navigateTo, showLoading, hideLoading, getUser } from './utils.js';

// ============================================
// Page State
// ============================================

const editId = getQueryParam('id');
const isEditMode = !!editId;
const ADDITIONAL_NOTES_MAX_LENGTH = 1000;
const OWNER_PAGE_SIZE = 1000;
const OWNER_SORT_BY = 'name';
const OWNER_SORT_DIRECTION = 'asc';

// ============================================
// Page Initialization
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Verify authentication
  if (!requireAuth()) return;

  // Initialize protected page (sidebar, user display)
  initProtectedPage();

  await checkFarmApi();
  await setupOwnerSelector();

  loadCropTypeOptions();
  loadIrrigationTypeOptions();
  await loadPropertyOptions();

  if (isEditMode) {
    await setupEditMode();
  }

  // Setup form handler
  setupFormHandler();
});

function isCurrentUserAdmin() {
  const currentUser = getUser();
  if (!currentUser) return false;

  const roleValues = Array.isArray(currentUser.role)
    ? currentUser.role
    : [currentUser.role].filter(Boolean);

  return roleValues.some((role) => String(role).trim().toLowerCase() === 'admin');
}

async function setupOwnerSelector() {
  const ownerFieldGroup = $id('ownerFieldGroup');
  const ownerSelect = $id('ownerId');

  if (!ownerFieldGroup || !ownerSelect) return;

  if (!isCurrentUserAdmin()) {
    ownerFieldGroup.style.display = 'none';
    ownerSelect.required = false;
    return;
  }

  ownerFieldGroup.style.display = 'block';
  ownerSelect.disabled = true;
  ownerSelect.innerHTML = '<option value="">Loading owners...</option>';

  try {
    let parameterMap = null;
    try {
      parameterMap = await getOwnersQueryParameterMapFromSwagger();
    } catch {
      parameterMap = null;
    }

    const owners = await getAllOwners(parameterMap);
    renderOwnerOptions(owners);

    ownerSelect.required = !isEditMode;

    if (isEditMode) {
      ownerSelect.disabled = true;
    }
  } catch (error) {
    const { message } = normalizeError(error);
    ownerSelect.innerHTML = '<option value="">Failed to load owners</option>';
    ownerSelect.disabled = true;
    showFormError(message || 'Failed to load owners for admin selection.');
  }
}

async function getAllOwners(parameterMap) {
  const allOwners = [];
  let pageNumber = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await getOwnersPaginated(
      {
        pageNumber,
        pageSize: OWNER_PAGE_SIZE,
        sortBy: OWNER_SORT_BY,
        sortDirection: OWNER_SORT_DIRECTION,
        filter: ''
      },
      parameterMap
    );

    const items = response?.data || response?.items || response?.results || [];
    allOwners.push(...items);

    hasNextPage = Boolean(response?.hasNextPage);
    pageNumber += 1;
  }

  return Array.from(new Map(allOwners.map((owner) => [owner.id, owner])).values());
}

function renderOwnerOptions(owners) {
  const ownerSelect = $id('ownerId');
  if (!ownerSelect) return;

  const sortedOwners = [...owners].sort((left, right) => {
    const leftName = String(left?.name || '').toLowerCase();
    const rightName = String(right?.name || '').toLowerCase();
    return leftName.localeCompare(rightName);
  });

  ownerSelect.innerHTML = [
    '<option value="">Select an owner</option>',
    ...sortedOwners.map((owner) => {
      const name = escapeHtml(owner?.name || 'Unnamed owner');
      const email = escapeHtml(owner?.email || 'no-email');
      return `<option value="${owner.id}">${name} (${email})</option>`;
    })
  ].join('');

  ownerSelect.disabled = false;
}

async function checkFarmApi() {
  try {
    await fetchFarmSwagger();
  } catch (error) {
    const { message } = normalizeError(error);
    toast(message || 'Farm API is not reachable', 'warning');
  }
}

async function loadPropertyOptions() {
  const select = $id('propertyId');
  if (!select) return;

  const currentValue = select.value;

  try {
    const response = await getProperties();
    const properties = response?.data || response || [];

    if (!Array.isArray(properties) || properties.length === 0) {
      return;
    }

    select.innerHTML = `<option value="">Select a property...</option>${properties
      .map((property) => `<option value="${property.id}">${property.name}</option>`)
      .join('')}`;

    if (currentValue) {
      select.value = currentValue;
    }
  } catch (error) {
    console.error('Error loading properties for plot form:', error);
  }
}

// ============================================
// Edit Mode Setup
// ============================================

async function setupEditMode() {
  const pageTitle = $id('pageTitle');
  const formTitle = $id('formTitle');
  const breadcrumbCurrent = $id('breadcrumbCurrent');
  const sensorsSection = $id('sensorsSection');

  if (pageTitle) pageTitle.textContent = 'Edit Plot';
  if (formTitle) formTitle.textContent = 'Edit Plot';
  if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Edit';
  if (sensorsSection) sensorsSection.style.display = 'block';

  setReadOnlyEditMode();

  try {
    const plot = await getPlot(editId);
    populateForm(plot);
    loadSensors();
    toast('Edit mode is not available yet. Fields are read-only.', 'warning');
  } catch (error) {
    const { message } = normalizeError(error);
    showFormError(message || 'Failed to load plot');
    toast(message || 'Failed to load plot', 'error');
  }
}

function setReadOnlyEditMode() {
  const form = $id('plotForm');
  if (!form) return;

  const interactiveElements = form.querySelectorAll('input, select, textarea, button');
  interactiveElements.forEach((element) => {
    element.disabled = true;
  });

  const formLinks = form.querySelectorAll('a');
  formLinks.forEach((link) => {
    const isCancelLink =
      link.closest('.form-actions') && link.getAttribute('href') === 'plots.html';
    if (isCancelLink) {
      return;
    }

    link.setAttribute('aria-disabled', 'true');
    link.setAttribute('tabindex', '-1');
    link.style.pointerEvents = 'none';
    link.style.opacity = '0.6';
  });

  const sensorsSection = $id('sensorsSection');
  const sensorsButtons = sensorsSection?.querySelectorAll('button') || [];
  sensorsButtons.forEach((button) => {
    button.disabled = true;
  });

  const formError = $id('formErrors');
  if (formError) {
    formError.textContent = 'Edit mode is not available yet. This screen is read-only.';
    formError.style.display = 'block';
  }
}

// ============================================
// Populate Form
// ============================================

function populateForm(plot) {
  const normalizedCropType = normalizeCropType(plot.cropType);

  const fields = {
    plotId: plot.id,
    ownerId: plot.ownerId || '',
    propertyId: plot.propertyId,
    name: plot.name,
    areaHectares: plot.areaHectares,
    cropType: normalizedCropType,
    plantingDate: formatDateForInput(plot.plantingDate),
    expectedHarvest: formatDateForInput(plot.expectedHarvestDate || plot.expectedHarvest),
    irrigationType: normalizeIrrigationType(plot.irrigationType || ''),
    minSoilMoisture: plot.minSoilMoisture || 30,
    maxTemperature: plot.maxTemperature || 35,
    minHumidity: plot.minHumidity || 40,
    status: plot.status || 'active',
    notes: plot.additionalNotes || ''
  };

  Object.entries(fields).forEach(([id, value]) => {
    const element = $id(id);
    if (element) element.value = value;
  });
}

function loadCropTypeOptions() {
  const select = $id('cropType');
  if (!select) return;

  const currentValue = select.value;

  select.innerHTML = [`<option value="">Select crop type...</option>`]
    .concat(
      COMMON_CROP_TYPES.map((cropType) => {
        const icon = CROP_TYPE_ICONS[cropType] || '🌿';
        return `<option value="${cropType}">${icon} ${cropType}</option>`;
      })
    )
    .join('');

  const normalizedCurrent = normalizeCropType(currentValue);
  if (normalizedCurrent) {
    select.value = normalizedCurrent;
  }
}

function loadIrrigationTypeOptions() {
  const select = $id('irrigationType');
  if (!select) return;

  const currentValue = normalizeIrrigationType(select.value);

  select.innerHTML = [`<option value="">Select...</option>`]
    .concat(
      IRRIGATION_TYPES.map((type) => {
        const icon = IRRIGATION_TYPE_ICONS[type] || '💦';
        return `<option value="${type}">${icon} ${type}</option>`;
      })
    )
    .join('');

  if (currentValue) {
    select.value = currentValue;
  }
}

// ============================================
// Load Sensors for Plot
// ============================================

function loadSensors() {
  const mockSensors = [
    { id: 'S001', type: 'Temperature & Humidity', status: 'online', lastReading: '5 min ago' },
    { id: 'S002', type: 'Soil Moisture', status: 'online', lastReading: '5 min ago' },
    { id: 'S003', type: 'Rain Gauge', status: 'warning', lastReading: '1 hour ago' }
  ];

  const sensorsList = $id('sensorsList');
  if (!sensorsList) return;

  const html = mockSensors
    .map(
      (s) => `
    <div class="d-flex justify-between align-center" style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
      <div>
        <strong>📡 ${s.id}</strong> - ${s.type}
        <div class="text-muted" style="font-size: 0.85em;">Last reading: ${s.lastReading}</div>
      </div>
      <span class="badge badge-${s.status === 'online' ? 'success' : 'warning'}">${s.status}</span>
    </div>
  `
    )
    .join('');

  sensorsList.innerHTML = html || '<p class="text-muted">No sensors assigned to this plot.</p>';
}

// ============================================
// Form Submit Handler
// ============================================

function setupFormHandler() {
  const form = $id('plotForm');
  if (!form) return;

  if (isEditMode) {
    return;
  }

  form.addEventListener('submit', handleSubmit);
}

async function handleSubmit(e) {
  e.preventDefault();
  clearFormErrors();

  const isAdmin = isCurrentUserAdmin();
  const selectedOwnerId = $id('ownerId')?.value?.trim() || '';

  const plantingDateValue = $id('plantingDate')?.value?.trim() || '';
  const expectedHarvestValue = $id('expectedHarvest')?.value?.trim() || '';
  const notesValidation = sanitizeAndValidateAdditionalNotes($id('notes')?.value ?? '');

  if (notesValidation.error) {
    showFormError(notesValidation.error);
    toast(notesValidation.error, 'error');
    return;
  }

  const formData = {
    propertyId: $id('propertyId')?.value,
    name: $id('name')?.value,
    areaHectares: parseFloat($id('areaHectares')?.value) || 0,
    cropType: $id('cropType')?.value,
    plantingDate: toDateTimeOffset(plantingDateValue),
    expectedHarvestDate: toDateTimeOffset(expectedHarvestValue),
    irrigationType: normalizeIrrigationType($id('irrigationType')?.value),
    additionalNotes: notesValidation.value
  };

  if (isAdmin && !isEditMode && selectedOwnerId) {
    formData.ownerId = selectedOwnerId;
  }

  // Validation
  if (!formData.propertyId) {
    toast('validation.plot.property_required', 'error');
    return;
  }
  if (!formData.name) {
    toast('validation.plot.name_required', 'error');
    return;
  }
  if (!formData.cropType) {
    toast('validation.plot.crop_required', 'error');
    return;
  }

  if (isAdmin && !isEditMode && !selectedOwnerId) {
    const ownerSelect = $id('ownerId');
    if (ownerSelect) {
      ownerSelect.setCustomValidity('Please select an owner.');
      ownerSelect.reportValidity();
    }
    showFormError('Please select an owner.');
    return;
  }

  if (isEditMode) {
    showFormError('Plot update is not available yet in this screen.');
    return;
  }

  showLoading('Saving plot...');

  try {
    await createPlot({
      ownerId: formData.ownerId,
      propertyId: formData.propertyId,
      name: formData.name,
      areaHectares: formData.areaHectares,
      cropType: formData.cropType,
      plantingDate: formData.plantingDate,
      expectedHarvestDate: formData.expectedHarvestDate,
      irrigationType: formData.irrigationType,
      additionalNotes: formData.additionalNotes
    });

    toast('Plot created successfully', 'success');
    navigateTo('plots.html');
  } catch (error) {
    const message = extractApiErrorMessage(error);
    showFormError(message);
  } finally {
    hideLoading();
  }
}

function extractApiErrorMessage(error) {
  const fallback = 'An error occurred. Please try again.';

  if (error?.response?.data) {
    const data = error.response.data;

    if (Array.isArray(data.errors) && data.errors.length > 0) {
      const reasons = data.errors.map((err) => err.reason || err.message).filter(Boolean);
      if (reasons.length > 0) {
        return reasons.join('\n');
      }
    } else if (data.message) {
      return data.message;
    } else if (data.title || data.detail) {
      return data.detail || data.title;
    }
  }

  const normalized = normalizeError(error);
  return normalized?.message || fallback;
}

function showFormError(message) {
  const errorDiv = $id('formErrors');
  if (!errorDiv) {
    toast(message, 'error');
    return;
  }

  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

function clearFormErrors() {
  const errorDiv = $id('formErrors');
  if (!errorDiv) return;
  errorDiv.textContent = '';
  errorDiv.style.display = 'none';
}

function formatDateForInput(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toDateTimeOffset(dateInputValue) {
  if (!dateInputValue) return null;

  const date = new Date(`${dateInputValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function sanitizeAndValidateAdditionalNotes(rawValue) {
  if (typeof rawValue !== 'string') {
    return { value: null, error: null };
  }

  if (rawValue.length > ADDITIONAL_NOTES_MAX_LENGTH) {
    return {
      value: null,
      error: `Additional notes must be at most ${ADDITIONAL_NOTES_MAX_LENGTH} characters.`
    };
  }

  const suspiciousPatterns = [
    /<\s*script/gi,
    /<\s*\/\s*script\s*>/gi,
    /javascript\s*:/gi,
    /on\w+\s*=/gi
  ];
  if (suspiciousPatterns.some((pattern) => pattern.test(rawValue))) {
    return {
      value: null,
      error:
        'Additional notes contain unsafe content. Please remove scripts or HTML event attributes.'
    };
  }

  const withoutControlChars = Array.from(rawValue)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join('');
  const withoutHtmlTags = withoutControlChars.replace(/<[^>]*>/g, '');
  const normalized = withoutHtmlTags.trim();

  if (!normalized) {
    return { value: null, error: null };
  }

  return { value: normalized, error: null };
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Also show English toasts when native validation triggers
const plotsForm = document.getElementById('plotForm');
if (plotsForm) {
  plotsForm.addEventListener(
    'invalid',
    (e) => {
      const el = e.target;
      const id = el.id;
      if (el.validity.valueMissing) {
        if (id === 'propertyId') {
          el.setCustomValidity(t('validation.plot.property_required'));
          toast('validation.plot.property_required', 'warning');
        } else if (id === 'name') {
          el.setCustomValidity(t('validation.plot.name_required'));
          toast('validation.plot.name_required', 'warning');
        } else if (id === 'cropType') {
          el.setCustomValidity(t('validation.plot.crop_required'));
          toast('validation.plot.crop_required', 'warning');
        } else {
          el.setCustomValidity(t('validation.property.required_fields'));
          toast('validation.property.required_fields', 'warning');
        }
      } else if (id === 'notes' && el.validity.tooLong) {
        el.setCustomValidity(
          `Additional notes must be at most ${ADDITIONAL_NOTES_MAX_LENGTH} characters.`
        );
        toast(
          `Additional notes must be at most ${ADDITIONAL_NOTES_MAX_LENGTH} characters.`,
          'warning'
        );
      }
    },
    true
  );

  // Clear custom messages on input
  plotsForm.addEventListener('input', (e) => {
    e.target.setCustomValidity('');
  });

  const ownerSelect = $id('ownerId');
  if (ownerSelect) {
    ownerSelect.addEventListener('change', () => {
      ownerSelect.setCustomValidity('');
    });
  }
}
