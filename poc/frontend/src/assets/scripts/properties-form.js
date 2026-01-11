/**
 * TC Agro Solutions - Properties Form Page Entry Point
 */

import { initProtectedPage } from './common.js';
import { getProperty, createProperty, updateProperty } from './api.js';
import {
  $id,
  getFormData,
  setFormData,
  showToast,
  showLoading,
  hideLoading,
  getQueryParam
} from './utils.js';
import { t, overrideNativeValidation } from './i18n.js';

// Initialize protected page
await initProtectedPage();

// ============================================
// LOAD PROPERTY (IF EDITING)
// ============================================

const propertyId = getQueryParam('id');
const isEdit = !!propertyId;
const pageTitle = $id('pageTitle');
const submitBtn = $id('submitBtn');

if (pageTitle) {
  pageTitle.textContent = isEdit ? 'Edit Property' : 'Add Property';
}

if (submitBtn) {
  submitBtn.textContent = isEdit ? 'Update Property' : 'Create Property';
}

if (isEdit) {
  showLoading();
  try {
    const property = await getProperty(propertyId);
    if (property) {
      setFormData('#propertyForm', property);
    } else {
      showToast(t('property.not_found'), 'error');
    }
  } catch (err) {
    showToast(t('property.load_failed'), 'error');
  } finally {
    hideLoading();
  }
}

// ============================================
// FORM SUBMISSION
// ============================================

const form = $id('propertyForm');
if (form) {
  // Force English validation messages for this form
  overrideNativeValidation(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = getFormData('#propertyForm');

    // Validate required fields
    if (!formData.name || !formData.location || !formData.areaHectares) {
      showToast(t('validation.property.required_fields'), 'error');
      return;
    }

    showLoading();

    try {
      let result;
      if (isEdit) {
        result = await updateProperty(propertyId, formData);
        showToast(t('property.updated_success'), 'success');
      } else {
        result = await createProperty(formData);
        showToast(t('property.created_success'), 'success');
      }

      // Redirect to list after success
      setTimeout(() => {
        window.location.href = './index.html';
      }, 1000);
    } catch (err) {
      showToast(isEdit ? t('property.save_failed') : 'Failed to create property', 'error');
    } finally {
      hideLoading();
    }
  });
}

// Cancel button
const cancelBtn = $id('cancelBtn');
if (cancelBtn) {
  cancelBtn.addEventListener('click', () => {
    window.location.href = './index.html';
  });
}
