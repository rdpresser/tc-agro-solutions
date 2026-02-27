/**
 * Sensors Form Page - Create + Read-only Edit
 */

import {
  createSensor,
  fetchFarmSwagger,
  getPlotsPaginated,
  getSensorById,
  normalizeError,
  getOwnersPaginated,
  getOwnersQueryParameterMapFromSwagger
} from './api.js';
import { requireAuth } from './auth.js';
import { initProtectedPage } from './common.js';
import { toast } from './i18n.js';
import { getSensorTypeDisplay, normalizeSensorType, SENSOR_TYPES } from './sensor-types.js';
import { $id, getQueryParam, navigateTo, showLoading, hideLoading, getUser } from './utils.js';

const editId = getQueryParam('id');
const isEditMode = !!editId;
const preselectedPlotId = getQueryParam('plotId');
const OWNER_PAGE_SIZE = 1000;
const OWNER_SORT_BY = 'name';
const OWNER_SORT_DIRECTION = 'asc';

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;

  initProtectedPage();
  await checkFarmApi();
  await setupOwnerSelector();
  loadSensorTypeOptions();

  if (isEditMode) {
    setEditModeUI();
    await loadSensor(editId);
    setReadOnlyEditMode();
    return;
  }

  setCreateModeUI();
  await loadPlotOptions();
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
    .concat(
      SENSOR_TYPES.map((type) => `<option value="${type}">${getSensorTypeDisplay(type)}</option>`)
    )
    .join('');

  const normalizedCurrent = normalizeSensorType(currentValue);
  if (normalizedCurrent) {
    select.value = normalizedCurrent;
  }
}

async function loadPlotOptions() {
  const select = $id('plotId');
  if (!select) return;

  const currentValue = select.value || preselectedPlotId || '';

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

  const ownerSelect = $id('ownerId');
  if (ownerSelect) {
    ownerSelect.addEventListener('change', () => {
      ownerSelect.setCustomValidity('');
    });
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  clearFormErrors();

  const isAdmin = isCurrentUserAdmin();
  const selectedOwnerId = $id('ownerId')?.value?.trim() || '';

  const payload = {
    plotId: $id('plotId')?.value,
    type: $id('type')?.value,
    label: $id('label')?.value?.trim() || null
  };

  if (isAdmin && !isEditMode && selectedOwnerId) {
    payload.ownerId = selectedOwnerId;
  }

  if (!payload.plotId || !payload.type) {
    showFormError('Plot and type are required fields.');
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
    updateEditHeaderWithOwner(sensor);
    updateOwnerNameDisplay(sensor);
    populateForm(sensor);
    toast('Edit mode is not available yet. Fields are read-only.', 'warning');
  } catch (error) {
    const { message } = normalizeError(error);
    showFormError(message || 'Failed to load sensor');
    toast(message || 'Failed to load sensor', 'error');
  }
}

function updateEditHeaderWithOwner(sensor) {
  if (!isEditMode || isCurrentUserAdmin()) {
    return;
  }

  const ownerName = resolveOwnerDisplayName(sensor);
  if (!ownerName) {
    return;
  }

  const formTitle = $id('formTitle');
  const breadcrumbCurrent = $id('breadcrumbCurrent');

  if (formTitle) {
    formTitle.textContent = `Edit Sensor · Owner: ${ownerName}`;
  }

  if (breadcrumbCurrent) {
    breadcrumbCurrent.textContent = `Edit · ${ownerName}`;
  }
}

function updateOwnerNameDisplay(sensor) {
  const ownerNameGroup = $id('ownerNameDisplayGroup');
  const ownerNameField = $id('ownerNameDisplay');

  if (!ownerNameGroup || !ownerNameField) {
    return;
  }

  const ownerName = resolveOwnerDisplayName(sensor);
  const shouldDisplay = isEditMode && !isCurrentUserAdmin() && ownerName.length > 0;

  ownerNameGroup.style.display = shouldDisplay ? 'block' : 'none';
  ownerNameField.value = shouldDisplay ? ownerName : '';
}

function resolveOwnerDisplayName(sensor) {
  const ownerNameCandidate =
    sensor?.ownerName ||
    sensor?.OwnerName ||
    sensor?.owner?.name ||
    sensor?.owner?.Name ||
    sensor?.ownerDisplayName ||
    sensor?.OwnerDisplayName ||
    '';

  const normalizedOwnerName = String(ownerNameCandidate || '').trim();
  if (normalizedOwnerName.length > 0) {
    return normalizedOwnerName;
  }

  if (!isCurrentUserAdmin()) {
    const currentUserName = String(getUser()?.name || '').trim();
    if (currentUserName.length > 0) {
      return currentUserName;
    }
  }

  return '';
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
    ownerId: sensor.ownerId || '',
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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
