/**
 * TC Agro Solutions - Plots Form Page Entry Point
 */

import { initProtectedPage } from './common.js';
import { getPlot, getProperties, getSensors, createPlot, updatePlot } from './api.js';
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
// LOAD PROPERTIES FOR DROPDOWN
// ============================================

async function populateProperties() {
  try {
    const properties = await getProperties();
    const propertySelect = $id('propertyId');

    if (propertySelect && Array.isArray(properties)) {
      const optionsHtml = [
        '<option value="">-- Select Property --</option>',
        ...properties.map((p) => `<option value="${p.id}">${p.name}</option>`)
      ].join('');

      propertySelect.innerHTML = optionsHtml;
    }
  } catch (err) {
    console.error('Failed to load properties:', err);
  }
}

await populateProperties();

// ============================================
// LOAD PLOT (IF EDITING)
// ============================================

const plotId = getQueryParam('id');
const isEdit = !!plotId;
const pageTitle = $id('pageTitle');
const submitBtn = $id('submitBtn');
const sensorsSection = $id('sensorsSection');

if (pageTitle) {
  pageTitle.textContent = isEdit ? 'Edit Plot' : 'Add Plot';
}

if (submitBtn) {
  submitBtn.textContent = isEdit ? 'Update Plot' : 'Create Plot';
}

// Hide sensors section in create mode, show in edit mode
if (sensorsSection && !isEdit) {
  sensorsSection.style.display = 'none';
}

if (isEdit) {
  showLoading();
  try {
    const plot = await getPlot(plotId);
    if (plot) {
      setFormData('#plotForm', plot);

      // Load sensors for this plot
      const sensors = await getSensors(plotId);
      if (sensors && sensors.length > 0) {
        const sensorsList = $id('sensorsList');
        if (sensorsList) {
          sensorsList.innerHTML = sensors
            .map(
              (s) => `
            <div class="sensor-item">
              <div class="sensor-info">
                <strong>${s.id}</strong> (${s.status})
              </div>
              <div class="sensor-readings">
                Temperature: ${s.temperature?.toFixed(1) || '-'}°C |
                Humidity: ${s.humidity?.toFixed(0) || '-'}% |
                Soil: ${s.soilMoisture?.toFixed(0) || '-'}%
              </div>
            </div>
          `
            )
            .join('');
        }
      }

      if (sensorsSection) sensorsSection.style.display = 'block';
    } else {
      showToast(t('plot.not_found'), 'error');
    }
  } catch (err) {
    showToast(t('plot.load_failed'), 'error');
  } finally {
    hideLoading();
  }
}

// ============================================
// MOCK DATA FOR DEVELOPMENT
// ============================================

const mockPlots = [
  {
    id: 'plot-001',
    propertyId: 'prop-001',
    name: 'North Field',
    cropType: 'soybean',
    areaHectares: 85.5,
    plantingDate: '2025-01-15',
    expectedHarvest: '2025-06-15',
    irrigationType: 'drip',
    minSoilMoisture: 30,
    maxTemperature: 35,
    minHumidity: 40,
    status: 'healthy',
    notes: 'First year of soybean cultivation in this field'
  },
  {
    id: 'plot-002',
    propertyId: 'prop-001',
    name: 'South Valley',
    cropType: 'corn',
    areaHectares: 120.0,
    plantingDate: '2025-02-01',
    expectedHarvest: '2025-08-01',
    irrigationType: 'sprinkler',
    minSoilMoisture: 35,
    maxTemperature: 32,
    minHumidity: 45,
    status: 'healthy',
    notes: 'Premium corn hybrid variety'
  },
  {
    id: 'plot-003',
    propertyId: 'prop-002',
    name: 'East Ridge',
    cropType: 'coffee',
    areaHectares: 45.2,
    plantingDate: '2023-05-10',
    expectedHarvest: '2025-10-01',
    irrigationType: 'drip',
    minSoilMoisture: 25,
    maxTemperature: 28,
    minHumidity: 50,
    status: 'warning',
    notes: 'Arabica coffee plants, 3+ years old'
  },
  {
    id: 'plot-004',
    propertyId: 'prop-002',
    name: 'West Grove',
    cropType: 'sugarcane',
    areaHectares: 95.8,
    plantingDate: '2024-03-20',
    expectedHarvest: '2025-12-01',
    irrigationType: 'flood',
    minSoilMoisture: 40,
    maxTemperature: 30,
    minHumidity: 55,
    status: 'healthy',
    notes: 'Newly planted sugarcane with premium irrigation'
  },
  {
    id: 'plot-005',
    propertyId: 'prop-003',
    name: 'Central Plain',
    cropType: 'cotton',
    areaHectares: 200.0,
    plantingDate: '2025-01-01',
    expectedHarvest: '2025-09-01',
    irrigationType: 'drip',
    minSoilMoisture: 30,
    maxTemperature: 35,
    minHumidity: 40,
    status: 'alert',
    notes: 'Large cotton field, needs careful monitoring'
  }
];

// Pre-populate with mock data if creating new plot
if (!isEdit) {
  const mockPlot = mockPlots[Math.floor(Math.random() * mockPlots.length)];
  // Don't auto-populate with mock data in create mode
}

// ============================================
// FORM SUBMISSION
// ============================================

const form = $id('plotForm');
if (form) {
  // Force English validation messages for this form
  overrideNativeValidation(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = getFormData('#plotForm');

    // Validate required fields
    if (!formData.propertyId || !formData.name || !formData.cropType || !formData.areaHectares) {
      showToast(t('validation.plot.required_fields'), 'error');
      return;
    }

    showLoading();

    try {
      let result;
      if (isEdit) {
        result = await updatePlot(plotId, formData);
        showToast(t('plot.updated_success'), 'success');
      } else {
        result = await createPlot(formData);
        showToast(t('plot.created_success'), 'success');
      }

      // Redirect to list after success
      setTimeout(() => {
        window.location.href = './index.html';
      }, 1000);
    } catch (err) {
      showToast(t('plot.save_failed'), 'error');
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
