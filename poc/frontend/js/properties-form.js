/**
 * Properties Form Page - TC Agro Solutions
 * Entry point script for property create/edit
 */

import { getProperty, createProperty, updateProperty } from './api.js';
import { requireAuth } from './auth.js';
import { initProtectedPage } from './common.js';
import { toast, t } from './i18n.js';
import { $id, getQueryParam } from './utils.js';

// ============================================
// Page Initialization
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Verify authentication
  if (!requireAuth()) return;

  // Initialize protected page (sidebar, user display)
  initProtectedPage();

  // Check if editing existing property
  const id = getQueryParam('id');
  if (id) {
    await loadProperty(id);
  }

  // Setup form handler
  setupFormHandler();
});

// ============================================
// Load Property for Edit
// ============================================

async function loadProperty(id) {
  try {
    const property = await getProperty(id);
    if (!property) {
      toast('property.not_found', 'danger');
      window.location.href = 'properties.html';
      return;
    }

    // Update page titles
    const pageTitle = $id('pageTitle');
    const formTitle = $id('formTitle');
    const breadcrumbTitle = $id('breadcrumbTitle');
    const submitBtn = $id('submitBtn');

    if (pageTitle) pageTitle.textContent = 'Edit Property';
    if (formTitle) formTitle.textContent = 'Edit Property';
    if (breadcrumbTitle) breadcrumbTitle.textContent = property.name;
    if (submitBtn) submitBtn.innerHTML = '💾 Update Property';

    // Populate form
    populateForm(property);
  } catch (error) {
    console.error('Failed to load property:', error);
    toast('property.load_failed', 'danger');
  }
}

// ============================================
// Populate Form
// ============================================

function populateForm(property) {
  const fields = {
    propertyId: property.id,
    name: property.name || '',
    location: property.location || '',
    areaHectares: property.areaHectares || '',
    latitude: property.latitude || '',
    longitude: property.longitude || '',
    status: property.status || 'active',
    notes: property.notes || ''
  };

  Object.entries(fields).forEach(([id, value]) => {
    const element = $id(id);
    if (element) element.value = value;
  });
}

// ============================================
// Form Submit Handler
// ============================================

function setupFormHandler() {
  const form = $id('propertyForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = $id('propertyId')?.value;
    const submitBtn = $id('submitBtn');

    const data = {
      name: $id('name')?.value,
      location: $id('location')?.value,
      areaHectares: parseFloat($id('areaHectares')?.value) || 0,
      latitude: $id('latitude')?.value ? parseFloat($id('latitude').value) : null,
      longitude: $id('longitude')?.value ? parseFloat($id('longitude').value) : null,
      status: $id('status')?.value || 'active',
      notes: $id('notes')?.value || ''
    };

    // Validation
    if (!data.name || !data.location || !data.areaHectares) {
      toast('validation.property.required_fields', 'warning');
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> ${t('app.saving')}`;
      }

      if (id) {
        // Update existing
        await updateProperty(id, data);
        toast('property.updated_success', 'success');
      } else {
        // Create new
        await createProperty(data);
        toast('property.created_success', 'success');
      }

      // Redirect to list
      setTimeout(() => {
        window.location.href = 'properties.html';
      }, 1000);
    } catch (error) {
      console.error('Failed to save property:', error);
      toast('property.save_failed', 'danger');

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '💾 Save Property';
      }
    }
  });

  // Show English messages and override browser built-in validation text
  form.addEventListener(
    'invalid',
    (e) => {
      const el = e.target;
      const fieldId = el.id;
      if (el.validity.valueMissing) {
        if (fieldId === 'name') {
          el.setCustomValidity(t('validation.property.name_required'));
          toast('validation.property.name_required', 'warning');
        } else if (fieldId === 'location') {
          el.setCustomValidity(t('validation.property.location_required'));
          toast('validation.property.location_required', 'warning');
        } else if (fieldId === 'areaHectares') {
          el.setCustomValidity(t('validation.property.area_required'));
          toast('validation.property.area_required', 'warning');
        } else {
          el.setCustomValidity(t('validation.property.required_fields'));
          toast('validation.property.required_fields', 'warning');
        }
      }
    },
    true
  );

  // Clear custom validity when user edits input
  form.addEventListener('input', (e) => {
    e.target.setCustomValidity('');
  });
}
