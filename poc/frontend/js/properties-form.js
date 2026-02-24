/**
 * Properties Form Page - TC Agro Solutions
 * Entry point script for property create/edit
 */

import { getProperty, createProperty, updateProperty, normalizeError } from './api.js';
import { initProtectedPage } from './common.js';
import { searchAddressWithMeta, reverseGeocodeDetails } from './geocoding.js';
import { toast, t } from './i18n.js';
import {
  openMapModal,
  closeMapModal,
  setupMapModalListeners,
  selectSearchResult
} from './map-picker.js';
import { $id, getQueryParam, navigateTo, showLoading, hideLoading } from './utils.js';

// ============================================
// Page State
// ============================================

const editId = getQueryParam('id');
const isEditMode = !!editId;
let autoFillIndicatorTimeoutId = null;

// ============================================
// Page Initialization
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  if (!initProtectedPage()) return;

  setupMapModalListeners();
  setupMapButtonHandler();

  if (isEditMode) {
    await setupEditMode();
  }

  setupFormHandler();
});

// ============================================
// Map Modal Handler
// ============================================

function setupMapButtonHandler() {
  const openMapBtn = $id('openMapBtn');
  const searchBtn = $id('searchBtn');
  const searchBtnDefaultHtml = searchBtn?.innerHTML || '🔍 Search';
  const addressSearchInput = $id('addressSearchInput');
  const closeLocationBtn2 = $id('closeLocationBtn2');

  if (openMapBtn) {
    openMapBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const lat = $id('latitude')?.value ? parseFloat($id('latitude').value) : null;
      const lon = $id('longitude')?.value ? parseFloat($id('longitude').value) : null;
      openMapModal(lat, lon);
    });
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const query = addressSearchInput?.value?.trim();
      if (!query) {
        toast('Please enter an address to search', 'warning');
        return;
      }

      if (searchBtn.disabled) {
        return;
      }

      const resultsDiv = $id('searchResults');
      const resultsList = $id('resultsList');

      if (resultsDiv && resultsList) {
        searchBtn.disabled = true;
        searchBtn.classList.add('btn-loading');
        searchBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Searching...';
        resultsDiv.style.display = 'block';
        resultsList.innerHTML = '<div class="loading-text">Searching...</div>';

        try {
          const { results, warning, error } = await searchAddressWithMeta(query);

          if (results.length === 0) {
            const emptyMessage = error || 'No results found. Try a different address.';
            resultsList.innerHTML = `<div class="empty-text">${escapeHtml(emptyMessage)}</div>`;
            return;
          }

          const feedbackBlock = buildSearchFeedbackBlock(warning, error);

          resultsList.innerHTML =
            feedbackBlock +
            results
              .map(
                (result, index) => `
            <div class="result-item" data-index="${index}">
              <div class="result-title">${escapeHtml(result.display_name)}</div>
              <div class="result-coords">📍 ${result.lat.toFixed(6)}, ${result.lon.toFixed(6)}</div>
            </div>
          `
              )
              .join('');

          resultsList.querySelectorAll('.result-item').forEach((item, index) => {
            item.addEventListener('click', () => {
              const selected = results[index];
              selectSearchResult(results, index);
              fillAddressFields(selected);
              showAddressAutoFillIndicator('Address fields auto-filled from search result.');

              const latInput = $id('latitude');
              const lonInput = $id('longitude');
              if (latInput) latInput.value = selected.lat;
              if (lonInput) lonInput.value = selected.lon;

              resultsDiv.style.display = 'none';
            });
          });
        } catch (searchError) {
          console.error('Search error:', searchError);
          resultsList.innerHTML = '<div class="error-text">Search failed. Try again.</div>';
        } finally {
          searchBtn.disabled = false;
          searchBtn.classList.remove('btn-loading');
          searchBtn.innerHTML = searchBtnDefaultHtml;
        }
      }
    });
  }

  if (addressSearchInput) {
    addressSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchBtn?.click();
      }
    });
  }

  if (closeLocationBtn2) {
    closeLocationBtn2.addEventListener('click', closeMapModal);
  }

  document.addEventListener('locationSelected', async (event) => {
    const { lat, lon, address, display_name: displayName } = event.detail || {};

    if (address) {
      fillAddressFields({ address, display_name: displayName, lat, lon });
      showAddressAutoFillIndicator('Address fields auto-filled from map selection.');
      return;
    }

    if (typeof lat === 'number' && typeof lon === 'number') {
      const details = await reverseGeocodeDetails(lat, lon);
      if (details) {
        fillAddressFields(details);
        showAddressAutoFillIndicator('Address fields auto-filled from map selection.');
      }
    }
  });
}

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

    if (['address', 'city', 'state', 'country'].includes(e.target?.id)) {
      hideAddressAutoFillIndicator();
    }
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

function showAddressAutoFillIndicator(message) {
  const indicator = $id('addressAutoFillIndicator');
  if (!indicator) return;

  indicator.textContent = `✅ ${message}`;
  indicator.style.display = 'block';

  if (autoFillIndicatorTimeoutId) {
    clearTimeout(autoFillIndicatorTimeoutId);
  }

  autoFillIndicatorTimeoutId = setTimeout(() => {
    hideAddressAutoFillIndicator();
  }, 5000);
}

function hideAddressAutoFillIndicator() {
  const indicator = $id('addressAutoFillIndicator');
  if (!indicator) return;

  indicator.style.display = 'none';

  if (autoFillIndicatorTimeoutId) {
    clearTimeout(autoFillIndicatorTimeoutId);
    autoFillIndicatorTimeoutId = null;
  }
}

function buildSearchFeedbackBlock(warning, error) {
  const blocks = [];

  if (warning) {
    blocks.push(`<div class="warning-text">${escapeHtml(warning)}</div>`);
  }

  if (error) {
    blocks.push(`<div class="error-text">${escapeHtml(error)}</div>`);
  }

  return blocks.join('');
}

function fillAddressFields(locationData) {
  if (!locationData) return;

  const addressObj = locationData.address || {};

  const addressInput = $id('address');
  const cityInput = $id('city');
  const stateInput = $id('state');
  const countryInput = $id('country');
  const latInput = $id('latitude');
  const lonInput = $id('longitude');

  if (addressInput) {
    addressInput.value =
      addressObj.street ||
      locationData.display_name ||
      [addressObj.neighbourhood, addressObj.city].filter(Boolean).join(' - ') ||
      addressInput.value;
  }

  if (cityInput && addressObj.city) cityInput.value = addressObj.city;
  if (stateInput && addressObj.state) stateInput.value = addressObj.state;
  if (countryInput && addressObj.country) countryInput.value = addressObj.country;
  if (latInput && typeof locationData.lat === 'number') latInput.value = locationData.lat;
  if (lonInput && typeof locationData.lon === 'number') lonInput.value = locationData.lon;
}
// ============================================
// Utilities
// ============================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
