/**
 * Plots Form Page - TC Agro Solutions
 * Entry point script for plot create/edit
 */

import { requireAuth } from './auth.js';
import { initProtectedPage } from './common.js';
import { toast, t } from './i18n.js';
import { $id, getQueryParam } from './utils.js';

// ============================================
// Page State
// ============================================

const editId = getQueryParam('id');
const isEditMode = !!editId;

// Mock data for edit mode (until backend is ready)
const mockPlots = {
  1: {
    id: '1',
    propertyId: 'prop-001',
    name: 'North Field',
    areaHectares: 85.5,
    cropType: 'soybean',
    plantingDate: '2025-10-15',
    expectedHarvest: '2026-03-15',
    irrigationType: 'pivot',
    minSoilMoisture: 30,
    maxTemperature: 35,
    minHumidity: 40,
    status: 'active',
    notes: 'High-yield soybean variety. Requires moisture monitoring.'
  },
  2: {
    id: '2',
    propertyId: 'prop-001',
    name: 'South Valley',
    areaHectares: 120.0,
    cropType: 'corn',
    plantingDate: '2025-11-01',
    expectedHarvest: '2026-04-20',
    irrigationType: 'sprinkler',
    minSoilMoisture: 35,
    maxTemperature: 32,
    minHumidity: 45,
    status: 'active',
    notes: ''
  },
  3: {
    id: '3',
    propertyId: 'prop-002',
    name: 'East Slope',
    areaHectares: 45.2,
    cropType: 'coffee',
    plantingDate: '2023-06-01',
    expectedHarvest: '2026-06-01',
    irrigationType: 'drip',
    minSoilMoisture: 40,
    maxTemperature: 30,
    minHumidity: 50,
    status: 'active',
    notes: 'Specialty coffee. Shaded area.'
  },
  4: {
    id: '4',
    propertyId: 'prop-002',
    name: 'West Woods',
    areaHectares: 95.8,
    cropType: 'sugarcane',
    plantingDate: '2025-09-01',
    expectedHarvest: '2026-08-01',
    irrigationType: 'flood',
    minSoilMoisture: 25,
    maxTemperature: 38,
    minHumidity: 35,
    status: 'active',
    notes: ''
  },
  5: {
    id: '5',
    propertyId: 'prop-003',
    name: 'Central Plain',
    areaHectares: 200.0,
    cropType: 'cotton',
    plantingDate: '2025-12-01',
    expectedHarvest: '2026-05-15',
    irrigationType: 'pivot',
    minSoilMoisture: 25,
    maxTemperature: 40,
    minHumidity: 30,
    status: 'active',
    notes: 'Large-scale cotton production. Sensor issues reported.'
  }
};

// ============================================
// Page Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Verify authentication
  if (!requireAuth()) return;

  // Initialize protected page (sidebar, user display)
  initProtectedPage();

  if (isEditMode) {
    setupEditMode();
  }

  // Setup form handler
  setupFormHandler();
});

// ============================================
// Edit Mode Setup
// ============================================

function setupEditMode() {
  const pageTitle = $id('pageTitle');
  const formTitle = $id('formTitle');
  const breadcrumbCurrent = $id('breadcrumbCurrent');
  const sensorsSection = $id('sensorsSection');

  if (pageTitle) pageTitle.textContent = 'Edit Plot';
  if (formTitle) formTitle.textContent = 'Edit Plot';
  if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Edit';
  if (sensorsSection) sensorsSection.style.display = 'block';

  // Load plot data (mock)
  const plot = mockPlots[editId];
  if (plot) {
    populateForm(plot);
    loadSensors();
  } else {
    toast('plot.not_found', 'error');
    window.location.href = 'plots.html';
  }

  /* ============================================
   * REAL API CALL (uncomment when backend ready)
   * ============================================
  try {
    const plot = await getPlot(editId);
    populateForm(plot);
    loadSensors();
  } catch (error) {
    showToast('Failed to load plot', 'error');
    window.location.href = 'plots.html';
  }
   */
}

// ============================================
// Populate Form
// ============================================

function populateForm(plot) {
  const fields = {
    plotId: plot.id,
    propertyId: plot.propertyId,
    name: plot.name,
    areaHectares: plot.areaHectares,
    cropType: plot.cropType,
    plantingDate: plot.plantingDate || '',
    expectedHarvest: plot.expectedHarvest || '',
    irrigationType: plot.irrigationType || '',
    minSoilMoisture: plot.minSoilMoisture || 30,
    maxTemperature: plot.maxTemperature || 35,
    minHumidity: plot.minHumidity || 40,
    status: plot.status || 'active',
    notes: plot.notes || ''
  };

  Object.entries(fields).forEach(([id, value]) => {
    const element = $id(id);
    if (element) element.value = value;
  });
}

// ============================================
// Load Sensors for Plot
// ============================================

function loadSensors() {
  const mockSensors = [
    { id: 'S001', type: 'Temperature & Humidity', status: 'online', lastReading: '5 min ago' },
    { id: 'S002', type: 'Soil Moisture', status: 'online', lastReading: '5 min ago' },
    { id: 'S003', type: 'Rain Gauge', status: 'warning', lastReading: '1 hour ago' }
  ];

  const sensorsList = $id('sensorsList');
  if (!sensorsList) return;

  const html = mockSensors
    .map(
      (s) => `
    <div class="d-flex justify-between align-center" style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
      <div>
        <strong>📡 ${s.id}</strong> - ${s.type}
        <div class="text-muted" style="font-size: 0.85em;">Last reading: ${s.lastReading}</div>
      </div>
      <span class="badge badge-${s.status === 'online' ? 'success' : 'warning'}">${s.status}</span>
    </div>
  `
    )
    .join('');

  sensorsList.innerHTML = html || '<p class="text-muted">No sensors assigned to this plot.</p>';
}

// ============================================
// Form Submit Handler
// ============================================

function setupFormHandler() {
  const form = $id('plotForm');
  if (!form) return;

  form.addEventListener('submit', handleSubmit);
}

function handleSubmit(e) {
  e.preventDefault();

  const formData = {
    propertyId: $id('propertyId')?.value,
    name: $id('name')?.value,
    areaHectares: parseFloat($id('areaHectares')?.value) || 0,
    cropType: $id('cropType')?.value,
    plantingDate: $id('plantingDate')?.value || null,
    expectedHarvest: $id('expectedHarvest')?.value || null,
    irrigationType: $id('irrigationType')?.value || null,
    minSoilMoisture: parseInt($id('minSoilMoisture')?.value) || 30,
    maxTemperature: parseInt($id('maxTemperature')?.value) || 35,
    minHumidity: parseInt($id('minHumidity')?.value) || 40,
    status: $id('status')?.value || 'active',
    notes: $id('notes')?.value || ''
  };

  // Validation
  if (!formData.propertyId) {
    toast('validation.plot.property_required', 'error');
    return;
  }
  if (!formData.name) {
    toast('validation.plot.name_required', 'error');
    return;
  }
  if (!formData.cropType) {
    toast('validation.plot.crop_required', 'error');
    return;
  }

  // Mock save
  toast(isEditMode ? 'plot.updated_success' : 'plot.created_success', 'success');

  setTimeout(() => {
    window.location.href = 'plots.html';
  }, 1500);

  /* ============================================
   * REAL API CALL (uncomment when backend ready)
   * ============================================
  try {
    if (isEditMode) {
      await updatePlot(editId, formData);
      showToast('Plot updated successfully!', 'success');
    } else {
      await createPlot(formData);
      showToast('Plot created successfully!', 'success');
    }
    setTimeout(() => window.location.href = 'plots.html', 1500);
  } catch (error) {
    showToast(error.message || 'Failed to save plot', 'error');
  }
   */
}

// Also show English toasts when native validation triggers
const plotsForm = document.getElementById('plotForm');
if (plotsForm) {
  plotsForm.addEventListener(
    'invalid',
    (e) => {
      const el = e.target;
      const id = el.id;
      if (el.validity.valueMissing) {
        if (id === 'propertyId') {
          el.setCustomValidity(t('validation.plot.property_required'));
          toast('validation.plot.property_required', 'warning');
        } else if (id === 'name') {
          el.setCustomValidity(t('validation.plot.name_required'));
          toast('validation.plot.name_required', 'warning');
        } else if (id === 'cropType') {
          el.setCustomValidity(t('validation.plot.crop_required'));
          toast('validation.plot.crop_required', 'warning');
        } else {
          el.setCustomValidity(t('validation.property.required_fields'));
          toast('validation.property.required_fields', 'warning');
        }
      }
    },
    true
  );

  // Clear custom messages on input
  plotsForm.addEventListener('input', (e) => {
    e.target.setCustomValidity('');
  });
}
