/**
 * TC Agro Solutions - Properties Page Entry Point
 */

import { initProtectedPage } from './common.js';
import { getProperties, createProperty, updateProperty, deleteProperty } from './api.js';
import { $, $$, showToast, showConfirm, formatDate } from './utils.js';

// ============================================
// PAGE INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth and setup page (must be inside DOMContentLoaded for sidebar elements)
  if (!initProtectedPage()) {
    return;
  }
  
  await loadProperties();
  setupEventListeners();
});

// ============================================
// DATA LOADING
// ============================================

async function loadProperties() {
  const tbody = $('#properties-tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
  
  try {
    const properties = await getProperties();
    renderPropertiesTable(properties);
  } catch (error) {
    console.error('Error loading properties:', error);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading properties</td></tr>';
    showToast('Error loading properties', 'error');
  }
}

function renderPropertiesTable(properties) {
  const tbody = $('#properties-tbody');
  if (!tbody) return;
  
  if (!properties.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No properties found</td></tr>';
    return;
  }
  
  tbody.innerHTML = properties.map(prop => `
    <tr data-id="${prop.id}">
      <td><strong>${prop.name}</strong></td>
      <td>${prop.location}</td>
      <td>${prop.areaHectares.toLocaleString('en-US')} ha</td>
      <td>${prop.plotsCount} plot(s)</td>
      <td>
        <span class="badge ${prop.status === 'active' ? 'badge-success' : 'badge-secondary'}">
          ${prop.status === 'active' ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td class="actions">
        <a href="properties-form.html?id=${prop.id}" class="btn btn-sm btn-outline">✏️ Edit</a>
        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${prop.id}">🗑️</button>
      </td>
    </tr>
  `).join('');
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Search filter
  const searchInput = $('#search-properties');
  searchInput?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const rows = $$('#properties-tbody tr');
    
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(query) ? '' : 'none';
    });
  });
  
  // Delete button handler (event delegation)
  const tbody = $('#properties-tbody');
  tbody?.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('[data-action="delete"]');
    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      await handleDelete(id);
    }
  });
}

async function handleDelete(id) {
  const confirmed = await showConfirm('Are you sure you want to delete this property?');
  
  if (confirmed) {
    try {
      await deleteProperty(id);
      showToast('Property deleted successfully', 'success');
      await loadProperties();
    } catch (error) {
      console.error('Error deleting property:', error);
      showToast('Error deleting property', 'error');
    }
  }
}

// Export for debugging
if (import.meta.env.DEV) {
  window.propertiesDebug = { loadProperties, handleDelete };
}
