/**
 * Sensors Form Page - Read-only view
 */

import { fetchFarmSwagger, getSensorById, normalizeError } from './api.js';
import { requireAuth } from './auth.js';
import { initProtectedPage } from './common.js';
import { toast } from './i18n.js';
import { $id, getQueryParam, navigateTo } from './utils.js';

const viewId = getQueryParam('id');

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;

  initProtectedPage();

  setReadOnlyViewMode();
  await checkFarmApi();

  if (!viewId) {
    showFormError('Sensor ID is required to view details.');
    toast('Sensor ID is required to view details.', 'error');
    return;
  }

  await loadSensor(viewId);
});

async function checkFarmApi() {
  try {
    await fetchFarmSwagger();
  } catch (error) {
    const { message } = normalizeError(error);
    toast(message || 'Farm API is not reachable', 'warning');
  }
}

function setReadOnlyViewMode() {
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

  const fields = {
    sensorId: sensor.id || '',
    label: sensor.label || '-',
    type: sensor.type || '-',
    status: sensor.status || '-',
    installedAt: sensor.installedAt ? new Date(sensor.installedAt).toLocaleString('en-US') : '-',
    propertyName: sensor.propertyName || '-',
    plotName: sensor.plotName || '-',
    propertyId: sensor.propertyId || '-',
    plotId: sensor.plotId || '-'
  };

  Object.entries(fields).forEach(([id, value]) => {
    const element = $id(id);
    if (element) element.value = value;
  });

  const breadcrumbCurrent = $id('breadcrumbCurrent');
  if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Edit';

  const formTitle = $id('formTitle');
  if (formTitle) formTitle.textContent = 'Edit Sensor';

  const pageTitle = $id('pageTitle');
  if (pageTitle) pageTitle.textContent = 'Edit Sensor';
}

function showFormError(message) {
  const errorDiv = $id('formErrors');
  if (!errorDiv) return;
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

if (import.meta.env.DEV) {
  window.sensorsFormDebug = { loadSensor, navigateTo };
}
