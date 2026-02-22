/**
 * Plots Form Page - TC Agro Solutions
 * Entry point script for plot create/edit
 */

import { createPlot, fetchFarmSwagger, getPlot, getProperties, normalizeError } from './api.js';
import { requireAuth } from './auth.js';
import { initProtectedPage } from './common.js';
import { COMMON_CROP_TYPES, CROP_TYPE_ICONS, normalizeCropType } from './crop-types.js';
import { toast, t } from './i18n.js';
import { $id, getQueryParam, navigateTo, showLoading, hideLoading } from './utils.js';

// ============================================
// Page State
// ============================================

const editId = getQueryParam('id');
const isEditMode = !!editId;

// ============================================
// Page Initialization
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Verify authentication
  if (!requireAuth()) return;

  // Initialize protected page (sidebar, user display)
  initProtectedPage();

  await checkFarmApi();

  loadCropTypeOptions();
  await loadPropertyOptions();

  if (isEditMode) {
    await setupEditMode();
  }

  // Setup form handler
  setupFormHandler();
});

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
    propertyId: plot.propertyId,
    name: plot.name,
    areaHectares: plot.areaHectares,
    cropType: normalizedCropType,
    plantingDate: plot.plantingDate || '',
    expectedHarvest: plot.expectedHarvest || '',
    irrigationType: plot.irrigationType || '',
    minSoilMoisture: plot.minSoilMoisture || 30,
    maxTemperature: plot.maxTemperature || 35,
    minHumidity: plot.minHumidity || 40,
    status: plot.status || 'active',
    notes: plot.notes || ''
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

  const formData = {
    propertyId: $id('propertyId')?.value,
    name: $id('name')?.value,
    areaHectares: parseFloat($id('areaHectares')?.value) || 0,
    cropType: $id('cropType')?.value
  };

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

  if (isEditMode) {
    showFormError('Plot update is not available yet in this screen.');
    return;
  }

  showLoading('Saving plot...');

  try {
    await createPlot({
      propertyId: formData.propertyId,
      name: formData.name,
      areaHectares: formData.areaHectares,
      cropType: formData.cropType
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
      }
    },
    true
  );

  // Clear custom messages on input
  plotsForm.addEventListener('input', (e) => {
    e.target.setCustomValidity('');
  });
}
