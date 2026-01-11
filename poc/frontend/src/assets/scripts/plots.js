/**
 * TC Agro Solutions - Plots List Page Entry Point
 */

import { initProtectedPage } from './common.js';
import { getPlots, getProperties, deletePlot } from './api.js';
import { $id, showToast, showConfirm, showLoading, hideLoading } from './utils.js';
import { t } from './i18n.js';

// Initialize protected page
await initProtectedPage();

// ============================================
// LOAD PLOTS
// ============================================

let allPlots = [];

async function loadPlots(propertyId = null) {
  showLoading();

  try {
    allPlots = await getPlots(propertyId);

    // Render plots table
    const tbody = $id('plotsTable');
    if (tbody && Array.isArray(allPlots)) {
      // Add delete handler for each plot row
      tbody.addEventListener('click', (e) => {
        if (e.target.textContent.includes('Delete')) {
          const row = e.target.closest('tr');
          const plotId = row
            .querySelector('button[onclick*="confirmDelete"]')
            ?.onclick.toString()
            .match(/'([^']+)'/)[1];
          // Delete handler moved to confirmDelete global function below
        }
      });

      tbody.innerHTML = allPlots
        .map(
          (p) => `
        <tr>
          <td><strong>${p.name}</strong></td>
          <td>${p.propertyName}</td>
          <td><span class="crop-badge">${p.cropType}</span></td>
          <td>${p.areaHectares.toFixed(2)} ha</td>
          <td><span class="badge badge-${p.status}">${p.status}</span></td>
          <td>${p.sensorsCount || 0}</td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="editPlot('${p.id}')">Edit</button>
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
    showToast(t('plot.load_failed'), 'error');
    console.error('Plots load error:', err);
  }
}

// Load plots on page load
await loadPlots();

// ============================================
// PROPERTY FILTER
// ============================================

async function populatePropertyFilter() {
  try {
    const properties = await getProperties();
    const filterSelect = $id('propertyFilter');

    if (filterSelect && Array.isArray(properties)) {
      const optionsHtml = [
        '<option value="">All Properties</option>',
        ...properties.map((p) => `<option value="${p.id}">${p.name}</option>`)
      ].join('');

      filterSelect.innerHTML = optionsHtml;

      filterSelect.addEventListener('change', (e) => {
        loadPlots(e.target.value || null);
      });
    }
  } catch (err) {
    console.error('Failed to load properties for filter:', err);
  }
}

await populatePropertyFilter();

// ============================================
// EVENT HANDLERS
// ============================================

// Add Plot button
const addBtn = document.querySelector('a[href="form.html"]');
if (addBtn) {
  // Link already works, no need for additional handler
}

// Search/filter
const searchInput = $id('searchInput');
if (searchInput) {
  searchInput.addEventListener('keyup', () => {
    const filter = searchInput.value.toLowerCase();
    const rows = $id('plotsTable').querySelectorAll('tr');

    rows.forEach((row) => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(filter) ? '' : 'none';
    });
  });
}

// Edit Plot (global function)
window.editPlot = (plotId) => {
  window.location.href = `./form.html?id=${plotId}`;
};

// Delete Plot
window.confirmDelete = async (plotId, name) => {
  const confirmed = await showConfirm(`Delete plot "${name}"?`, 'This action cannot be undone.');

  if (confirmed) {
    showLoading();
    try {
      const result = await deletePlot(plotId);
      if (result) {
        showToast('Plot deleted successfully', 'success');
        await loadPlots();
      }
    } catch (err) {
      showToast('Failed to delete plot', 'error');
    } finally {
      hideLoading();
    }
  }
};
