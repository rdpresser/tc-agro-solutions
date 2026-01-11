/**
 * TC Agro Solutions - Properties List Page Entry Point
 */

import { initProtectedPage } from './common.js';
import { getProperties, deleteProperty } from './api.js';
import { $id, showToast, showConfirm, showLoading, hideLoading, $ } from './utils.js';
import { t } from './i18n.js';

// Initialize protected page
await initProtectedPage();

// ============================================
// LOAD PROPERTIES
// ============================================

async function loadProperties() {
  showLoading();

  try {
    const properties = await getProperties();

    // Render properties table
    const tbody = $id('properties-tbody');
    if (tbody && Array.isArray(properties)) {
      tbody.innerHTML = properties
        .map(
          (p) => `
        <tr>
          <td><strong>${p.name}</strong></td>
          <td>${p.location}</td>
          <td>${p.areaHectares.toFixed(2)} ha</td>
          <td><span class="badge badge-${p.status}">${p.status}</span></td>
          <td>${p.plotsCount || 0}</td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="editProperty('${p.id}')">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="confirmDelete('${p.id}', '${p.name}')">Delete</button>
          </td>
        </tr>
      `
        )
        .join('');
    }

    hideLoading();
  } catch (err) {
    hideLoading();
    showToast(t('property.load_failed'), 'error');
    console.error('Properties load error:', err);
  }
}

// Load properties on page load
await loadProperties();

// ============================================
// EVENT HANDLERS
// ============================================

// Add Property button
const addBtn = document.querySelector('a[href="form.html"]');
if (addBtn) {
  // Link already works, no need for additional handler
}

// Search/filter
const searchInput = $id('search-properties');
if (searchInput) {
  searchInput.addEventListener('keyup', () => {
    const filter = searchInput.value.toLowerCase();
    const rows = $id('properties-tbody').querySelectorAll('tr');

    rows.forEach((row) => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(filter) ? '' : 'none';
    });
  });
}

// Edit Property (global function)
window.editProperty = (propertyId) => {
  window.location.href = `./form.html?id=${propertyId}`;
};

// Delete Property
window.confirmDelete = async (propertyId, name) => {
  const confirmed = await showConfirm(
    `Delete property "${name}"?`,
    'This action cannot be undone.'
  );

  if (confirmed) {
    showLoading();
    try {
      const result = await deleteProperty(propertyId);
      if (result) {
        showToast(t('property.delete_success'), 'success');
        await loadProperties();
      }
    } catch (err) {
      showToast(t('property.delete_failed'), 'error');
    } finally {
      hideLoading();
    }
  }
};
