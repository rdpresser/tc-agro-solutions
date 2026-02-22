/**
 * Sensors Form Page - Create + Read-only Edit
 */

import {
  createSensor,
  fetchFarmSwagger,
  getPlotsPaginated,
  getSensorById,
  normalizeError
} from './api.js';
import { requireAuth } from './auth.js';
import { initProtectedPage } from './common.js';
import { toast } from './i18n.js';
import { normalizeSensorType, SENSOR_TYPES } from './sensor-types.js';
import { $id, getQueryParam, navigateTo, showLoading, hideLoading } from './utils.js';

const editId = getQueryParam('id');
const isEditMode = !!editId;

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;

  initProtectedPage();
  await checkFarmApi();
  loadSensorTypeOptions();

  if (isEditMode) {
    setEditModeUI();
    setReadOnlyEditMode();
    await loadSensor(editId);
    return;
  }

  setCreateModeUI();
  await loadPlotOptions();
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

function setCreateModeUI() {
  const pageTitle = $id('pageTitle');
  const formTitle = $id('formTitle');
  const breadcrumbCurrent = $id('breadcrumbCurrent');

  if (pageTitle) pageTitle.textContent = 'Add Sensor';
  if (formTitle) formTitle.textContent = 'Add New Sensor';
  if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Add New';
}

function setEditModeUI() {
  const pageTitle = $id('pageTitle');
  const formTitle = $id('formTitle');
  const breadcrumbCurrent = $id('breadcrumbCurrent');

  if (pageTitle) pageTitle.textContent = 'Edit Sensor';
  if (formTitle) formTitle.textContent = 'Edit Sensor';
  if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Edit';
}

function setReadOnlyEditMode() {
  const form = $id('sensorForm');
  if (!form) return;

  const interactiveElements = form.querySelectorAll('input, select, textarea, button');
  interactiveElements.forEach((element) => {
    element.disabled = true;
  });

  const formLinks = form.querySelectorAll('a');
  formLinks.forEach((link) => {
    const isCancelLink =
      link.closest('.form-actions') && link.getAttribute('href') === 'sensors.html';
    if (isCancelLink) {
      return;
    }

    link.setAttribute('aria-disabled', 'true');
    link.setAttribute('tabindex', '-1');
    link.style.pointerEvents = 'none';
    link.style.opacity = '0.6';
  });

  const formError = $id('formErrors');
  if (formError) {
    formError.textContent = 'Edit mode is not available yet. This screen is read-only.';
    formError.style.display = 'block';
  }
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

function loadSensorTypeOptions() {
  const select = $id('type');
  if (!select) return;

  const currentValue = select.value;

  select.innerHTML = [`<option value="">Select sensor type...</option>`]
    .concat(SENSOR_TYPES.map((type) => `<option value="${type}">${type}</option>`))
    .join('');

  const normalizedCurrent = normalizeSensorType(currentValue);
  if (normalizedCurrent) {
    select.value = normalizedCurrent;
  }
}

async function loadPlotOptions() {
  const select = $id('plotId');
  if (!select) return;

  const currentValue = select.value;

  try {
    const plots = await fetchAllPages((params) => getPlotsPaginated(params), {
      sortBy: 'name',
      sortDirection: 'asc',
      filter: ''
    });

    select.innerHTML = `<option value="">Select a plot...</option>${plots
      .map((plot) => `<option value="${plot.id}">${plot.name} • ${plot.propertyName}</option>`)
      .join('')}`;

    if (currentValue) {
      select.value = currentValue;
    }
  } catch (error) {
    const { message } = normalizeError(error);
    console.error('Error loading plot options:', error);
    toast(message || 'Failed to load plots', 'error');
  }
}

function setupFormHandler() {
  const form = $id('sensorForm');
  if (!form) return;

  form.addEventListener('submit', handleSubmit);
}

async function handleSubmit(e) {
  e.preventDefault();
  clearFormErrors();

  const payload = {
    plotId: $id('plotId')?.value,
    type: $id('type')?.value,
    label: $id('label')?.value?.trim() || null
  };

  if (!payload.plotId || !payload.type) {
    showFormError('Plot and type are required fields.');
    return;
  }

  showLoading('Saving sensor...');

  try {
    await createSensor(payload);
    toast('Sensor created successfully', 'success');
    navigateTo('sensors.html');
  } catch (error) {
    const message = extractApiErrorMessage(error);
    showFormError(message);
  } finally {
    hideLoading();
  }
}

async function loadSensor(id) {
  try {
    const sensor = await getSensorById(id);
    populateForm(sensor);
    toast('Edit mode is not available yet. Fields are read-only.', 'warning');
  } catch (error) {
    const { message } = normalizeError(error);
    showFormError(message || 'Failed to load sensor');
    toast(message || 'Failed to load sensor', 'error');
  }
}

function populateForm(sensor) {
  if (!sensor) {
    showFormError('Sensor not found.');
    return;
  }

  const plotIdSelect = $id('plotId');
  if (plotIdSelect) {
    plotIdSelect.innerHTML = `<option value="${sensor.plotId}">${sensor.plotName} • ${sensor.propertyName}</option>`;
    plotIdSelect.value = sensor.plotId;
  }

  const typeSelect = $id('type');
  if (typeSelect) {
    typeSelect.value = normalizeSensorType(sensor.type);
  }

  const fields = {
    sensorId: sensor.id || '',
    label: sensor.label || ''
  };

  Object.entries(fields).forEach(([id, value]) => {
    const element = $id(id);
    if (element) element.value = value;
  });
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
  if (!errorDiv) return;
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

function clearFormErrors() {
  const errorDiv = $id('formErrors');
  if (!errorDiv) return;
  errorDiv.textContent = '';
  errorDiv.style.display = 'none';
}

if (import.meta.env.DEV) {
  window.sensorsFormDebug = { loadSensor, loadPlotOptions };
}
