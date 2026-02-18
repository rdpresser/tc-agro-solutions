/**
 * Properties Form Page - TC Agro Solutions
 * Entry point script for property create/edit
 */

import { getProperty, createProperty, updateProperty, normalizeError } from './api.js';
import { initProtectedPage } from './common.js';
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
  if (!initProtectedPage()) return;

  if (isEditMode) {
    await setupEditMode();
  }

  setupFormHandler();
});

// ============================================
// Edit Mode Setup
// ============================================

async function setupEditMode() {
  const pageTitle = $id('pageTitle');
  const formTitle = $id('formTitle');
  const breadcrumbTitle = $id('breadcrumbTitle');
  const submitBtn = $id('submitBtn');

  if (pageTitle) pageTitle.textContent = 'Edit Property';
  if (formTitle) formTitle.textContent = 'Edit Property';
  if (breadcrumbTitle) breadcrumbTitle.textContent = 'Edit';
  if (submitBtn) submitBtn.innerHTML = '💾 Update Property';

  try {
    const property = await getProperty(editId);
    if (!property) {
      showFormError('Property not found.');
      return;
    }
    if (breadcrumbTitle) breadcrumbTitle.textContent = property.name || 'Edit';
    populateForm(property);
  } catch (error) {
    const { message } = normalizeError(error);
    showFormError(message || 'Failed to load property');
  }
}

// ============================================
// Populate Form
// ============================================

function populateForm(property) {
  const fields = {
    propertyId: property.id || '',
    name: property.name || '',
    address: property.address || '',
    city: property.city || '',
    state: property.state || '',
    country: property.country || '',
    areaHectares: property.areaHectares || '',
    latitude: property.latitude ?? '',
    longitude: property.longitude ?? ''
  };

  Object.entries(fields).forEach(([id, value]) => {
    const element = $id(id);
    if (element) element.value = value;
  });
}

// ============================================
// Form Handler
// ============================================

function setupFormHandler() {
  const form = $id('propertyForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors();

    const payload = {
      name: $id('name')?.value?.trim(),
      address: $id('address')?.value?.trim() || '',
      city: $id('city')?.value?.trim(),
      state: $id('state')?.value?.trim(),
      country: $id('country')?.value?.trim(),
      areaHectares: parseFloat($id('areaHectares')?.value) || 0,
      latitude: $id('latitude')?.value ? parseFloat($id('latitude').value) : null,
      longitude: $id('longitude')?.value ? parseFloat($id('longitude').value) : null
    };

    if (
      !payload.name ||
      !payload.city ||
      !payload.state ||
      !payload.country ||
      !payload.areaHectares
    ) {
      showFormError('Please fill in all required fields.');
      return;
    }

    showLoading('Saving property...');

    try {
      if (isEditMode) {
        const propertyId = $id('propertyId')?.value || editId;
        if (!propertyId) {
          throw new Error('Property ID is required for update.');
        }
        await updateProperty(propertyId, payload);
        toast('Property updated successfully', 'success');
      } else {
        await createProperty(payload);
        toast('Property created successfully', 'success');
      }

      navigateTo('properties.html');
    } catch (error) {
      const message = extractApiErrorMessage(error);
      showFormError(message);
    } finally {
      hideLoading();
    }
  });

  // Custom validation messages
  form.addEventListener(
    'invalid',
    (e) => {
      const el = e.target;
      const fieldId = el.id;
      if (el.validity.valueMissing) {
        if (fieldId === 'name') {
          el.setCustomValidity(t('validation.property.name_required'));
        } else if (fieldId === 'city') {
          el.setCustomValidity('City is required');
        } else if (fieldId === 'state') {
          el.setCustomValidity('State is required');
        } else if (fieldId === 'country') {
          el.setCustomValidity('Country is required');
        } else if (fieldId === 'areaHectares') {
          el.setCustomValidity(t('validation.property.area_required'));
        } else {
          el.setCustomValidity(t('validation.property.required_fields'));
        }
      }
    },
    true
  );

  form.addEventListener('input', (e) => {
    e.target.setCustomValidity('');
  });
}

// ============================================
// Error Handling
// ============================================

function extractApiErrorMessage(error) {
  const fallback = 'An error occurred. Please try again.';

  if (error?.response?.data) {
    const data = error.response.data;

    if (Array.isArray(data.errors) && data.errors.length > 0) {
      const reasons = data.errors.map((err) => err.reason || err.message).filter(Boolean);
      if (reasons.length > 0) return reasons.join('\n');
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
