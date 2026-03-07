/**
 * Plots Form Page - TC Agro Solutions
 * Entry point script for plot create/edit
 */

import { area as turfArea, centroid as turfCentroid } from '@turf/turf';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';

import {
  createPlot,
  fetchFarmSwagger,
  getPlot,
  getPlotSensorsPaginated,
  getProperties,
  getPropertiesByOwner,
  normalizeError,
  getOwnersPaginated,
  getOwnersQueryParameterMapFromSwagger
} from './api.js';
import { requireAuth } from './auth.js';
import { initProtectedPage } from './common.js';
import {
  CROP_TYPE_DEFAULTS_TABLE,
  COMMON_CROP_TYPES,
  CROP_TYPE_ICONS,
  getCropAlertThresholds,
  getCropPlantingWindow,
  getSuggestedIrrigationType,
  getSuggestedExpectedHarvestDate,
  getSuggestedFuturePlantingDate,
  normalizeCropType
} from './crop-types.js';
import { reverseGeocodeDetails, searchAddressWithMeta } from './geocoding.js';
import { toast, t } from './i18n.js';
import {
  IRRIGATION_TYPES,
  IRRIGATION_TYPE_ICONS,
  getIrrigationTypeDisplay,
  normalizeIrrigationType
} from './irrigation-types.js';
import { getSensorStatusBadgeClass, getSensorStatusDisplay } from './sensor-statuses.js';
import { $id, getQueryParam, navigateTo, showLoading, hideLoading, getUser } from './utils.js';

// ============================================
// Page State
// ============================================

const editId = getQueryParam('id');
const isEditMode = !!editId;
const ADDITIONAL_NOTES_MAX_LENGTH = 1000;
const ASSOCIATED_SENSORS_MAX_PREVIEW = 10;
const OWNER_PAGE_SIZE = 1000;
const OWNER_SORT_BY = 'name';
const OWNER_SORT_DIRECTION = 'asc';
const DEFAULT_MAP_CENTER = [-23.5505, -46.6333];
const DEFAULT_MAP_ZOOM = 13;
const HECTARES_CONVERSION_FACTOR = 10_000;

let propertiesCache = [];
let boundaryMap = null;
let boundaryDrawnItems = null;
let boundaryDrawControl = null;
let boundarySearchMarker = null;
let isBoundaryMapExpanded = false;

// ============================================
// Page Initialization
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Verify authentication
  if (!requireAuth()) return;

  // Initialize protected page (sidebar, user display)
  initProtectedPage();

  await checkFarmApi();
  await setupOwnerSelector();

  loadCropTypeOptions();
  setupCropTypePicker();
  loadIrrigationTypeOptions();
  setupBoundaryMap();
  setupBoundaryMapExpandToggle();
  setupBoundaryMapActions();
  setupBoundaryMapSearch();
  setupPropertyMapBinding();
  await loadPropertyOptions({ ownerId: getOwnerIdForPropertyFilter() });

  if (isEditMode) {
    await setupEditMode();
  }

  // Setup form handler
  setupFormHandler();
});

function isCurrentUserAdmin() {
  const currentUser = getUser();
  if (!currentUser) return false;

  const roleValues = Array.isArray(currentUser.role)
    ? currentUser.role
    : [currentUser.role].filter(Boolean);

  return roleValues.some((role) => String(role).trim().toLowerCase() === 'admin');
}

async function setupOwnerSelector() {
  const ownerFieldGroup = $id('ownerFieldGroup');
  const ownerSelect = $id('ownerId');

  if (!ownerFieldGroup || !ownerSelect) return;

  if (!isCurrentUserAdmin()) {
    ownerFieldGroup.style.display = 'none';
    ownerSelect.required = false;
    return;
  }

  ownerFieldGroup.style.display = 'block';
  ownerSelect.disabled = true;
  ownerSelect.innerHTML = '<option value="">Loading owners...</option>';

  try {
    let parameterMap = null;
    try {
      parameterMap = await getOwnersQueryParameterMapFromSwagger();
    } catch {
      parameterMap = null;
    }

    const owners = await getAllOwners(parameterMap);
    renderOwnerOptions(owners);

    ownerSelect.required = !isEditMode;

    ownerSelect.addEventListener('change', async () => {
      ownerSelect.setCustomValidity('');
      await loadPropertyOptions({
        ownerId: getOwnerIdForPropertyFilter(),
        preserveSelection: false
      });
    });

    if (isEditMode) {
      ownerSelect.disabled = true;
    }
  } catch (error) {
    const { message } = normalizeError(error);
    ownerSelect.innerHTML = '<option value="">Failed to load owners</option>';
    ownerSelect.disabled = true;
    showFormError(message || 'Failed to load owners for admin selection.');
  }
}

function getOwnerIdForPropertyFilter() {
  if (!isCurrentUserAdmin()) {
    return '';
  }

  if (isEditMode) {
    return '';
  }

  return $id('ownerId')?.value?.trim() || '';
}

async function getAllOwners(parameterMap) {
  const allOwners = [];
  let pageNumber = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await getOwnersPaginated(
      {
        pageNumber,
        pageSize: OWNER_PAGE_SIZE,
        sortBy: OWNER_SORT_BY,
        sortDirection: OWNER_SORT_DIRECTION,
        filter: ''
      },
      parameterMap
    );

    const items = response?.data || response?.items || response?.results || [];
    allOwners.push(...items);

    hasNextPage = Boolean(response?.hasNextPage);
    pageNumber += 1;
  }

  return Array.from(new Map(allOwners.map((owner) => [owner.id, owner])).values());
}

function renderOwnerOptions(owners) {
  const ownerSelect = $id('ownerId');
  if (!ownerSelect) return;

  const sortedOwners = [...owners].sort((left, right) => {
    const leftName = String(left?.name || '').toLowerCase();
    const rightName = String(right?.name || '').toLowerCase();
    return leftName.localeCompare(rightName);
  });

  ownerSelect.innerHTML = [
    '<option value="">Select an owner</option>',
    ...sortedOwners.map((owner) => {
      const name = escapeHtml(owner?.name || 'Unnamed owner');
      const email = escapeHtml(owner?.email || 'no-email');
      return `<option value="${owner.id}">${name} (${email})</option>`;
    })
  ].join('');

  ownerSelect.disabled = false;
}

async function checkFarmApi() {
  try {
    await fetchFarmSwagger();
  } catch (error) {
    const { message } = normalizeError(error);
    toast(message || 'Farm API is not reachable', 'warning');
  }
}

async function loadPropertyOptions({ ownerId = '', preserveSelection = true } = {}) {
  const select = $id('propertyId');
  if (!select) return;

  const isAdmin = isCurrentUserAdmin();
  if (isAdmin && !ownerId && !isEditMode) {
    select.innerHTML = '<option value="">Select an owner first...</option>';
    select.value = '';
    return;
  }

  const currentValue = preserveSelection ? select.value : '';

  if (!preserveSelection) {
    select.innerHTML = '<option value="">Select a property...</option>';
    select.value = '';
  }

  try {
    const response = ownerId
      ? await getPropertiesByOwner(ownerId)
      : await getProperties({
          pageNumber: 1,
          pageSize: 1000,
          sortBy: 'name',
          sortDirection: 'asc',
          filter: ''
        });
    const properties = response?.data || response || [];
    propertiesCache = Array.isArray(properties) ? properties : [];

    if (!Array.isArray(properties) || properties.length === 0) {
      select.innerHTML = '<option value="">No properties available</option>';
      select.value = '';
      centerBoundaryMapToDefault();
      return;
    }

    select.innerHTML = `<option value="">Select a property...</option>${properties
      .map((property) => `<option value="${property.id}">${property.name}</option>`)
      .join('')}`;

    if (currentValue) {
      select.value = currentValue;
    }

    centerBoundaryMapFromSelectedProperty();
  } catch (error) {
    console.error('Error loading properties for plot form:', error);
  }
}

function setupPropertyMapBinding() {
  const propertySelect = $id('propertyId');
  if (!propertySelect) return;

  propertySelect.addEventListener('change', () => {
    centerBoundaryMapFromSelectedProperty();
  });
}

function setupBoundaryMap() {
  const mapContainer = $id('plotBoundaryMap');
  if (!mapContainer || boundaryMap) return;

  boundaryMap = L.map(mapContainer).setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(boundaryMap);

  boundaryDrawnItems = new L.FeatureGroup();
  boundaryMap.addLayer(boundaryDrawnItems);

  boundaryMap.on('click', (event) => {
    const clickedLat = Number(event?.latlng?.lat);
    const clickedLon = Number(event?.latlng?.lng);

    if (!Number.isFinite(clickedLat) || !Number.isFinite(clickedLon)) {
      return;
    }

    if (boundarySearchMarker) {
      boundaryMap.removeLayer(boundarySearchMarker);
    }

    const latitudeInput = $id('latitude');
    const longitudeInput = $id('longitude');
    if (latitudeInput) {
      latitudeInput.value = clickedLat.toFixed(6);
    }
    if (longitudeInput) {
      longitudeInput.value = clickedLon.toFixed(6);
    }

    boundarySearchMarker = L.marker([clickedLat, clickedLon], {
      title: 'Selected map point'
    }).addTo(boundaryMap);

    void updatePlotBoundaryLocationInfo(clickedLat, clickedLon);
  });

  if (!isEditMode) {
    boundaryDrawControl = new L.Control.Draw({
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: false
        },
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
        polyline: false
      },
      edit: {
        featureGroup: boundaryDrawnItems,
        remove: true
      }
    });

    boundaryMap.addControl(boundaryDrawControl);

    boundaryMap.on(L.Draw.Event.CREATED, (event) => {
      boundaryDrawnItems.clearLayers();
      const layer = event.layer;
      boundaryDrawnItems.addLayer(layer);
      syncBoundaryDataFromLayer(layer);
    });

    boundaryMap.on(L.Draw.Event.EDITED, (event) => {
      const layers = event.layers.getLayers();
      if (layers.length > 0) {
        syncBoundaryDataFromLayer(layers[0]);
      }
    });

    boundaryMap.on(L.Draw.Event.DELETED, () => {
      clearBoundarySelection();
    });
  }
}

function setupBoundaryMapExpandToggle() {
  const expandButton = $id('plotBoundaryExpandBtn');
  if (!expandButton) {
    return;
  }

  const updateExpandButtonState = () => {
    expandButton.textContent = isBoundaryMapExpanded ? '✕' : '⛶';
    expandButton.title = isBoundaryMapExpanded ? 'Collapse map' : 'Expand map';
    expandButton.setAttribute(
      'aria-label',
      isBoundaryMapExpanded ? 'Collapse boundary map' : 'Expand boundary map'
    );
  };

  const setExpanded = (expanded) => {
    const wrapper = $id('plotBoundaryMapWrapper');
    if (!wrapper) {
      return;
    }

    isBoundaryMapExpanded = Boolean(expanded);
    wrapper.classList.toggle('is-expanded', isBoundaryMapExpanded);
    document.body.classList.toggle('map-overlay-open', isBoundaryMapExpanded);
    updateExpandButtonState();

    if (boundaryMap) {
      setTimeout(() => {
        boundaryMap.invalidateSize();
      }, 120);
    }
  };

  expandButton.addEventListener('click', () => {
    setExpanded(!isBoundaryMapExpanded);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isBoundaryMapExpanded) {
      setExpanded(false);
    }
  });

  updateExpandButtonState();
}

function setupBoundaryMapActions() {
  const clearButton = $id('clearBoundaryBtn');
  const useCurrentPointButton = $id('useCurrentPointBtn');

  updateUseCurrentPointButtonState(hasBoundaryGeoJson());

  if (useCurrentPointButton) {
    useCurrentPointButton.addEventListener('click', () => {
      if (!boundaryMap) {
        toast('Map is not ready yet.', 'warning');
        return;
      }

      const centerPoint = boundaryMap.getCenter();
      boundaryMap.setView(centerPoint, boundaryMap.getZoom());

      const referencePoint = centerPoint;
      if (!referencePoint) {
        toast('Select a point on map first.', 'warning');
        return;
      }

      const latitudeInput = $id('latitude');
      const longitudeInput = $id('longitude');

      if (latitudeInput) {
        latitudeInput.value = referencePoint.lat.toFixed(6);
      }

      if (longitudeInput) {
        longitudeInput.value = referencePoint.lng.toFixed(6);
      }

      if (boundaryMap) {
        if (boundarySearchMarker) {
          boundaryMap.removeLayer(boundarySearchMarker);
        }

        boundarySearchMarker = L.marker([referencePoint.lat, referencePoint.lng], {
          title: 'Selected map point'
        }).addTo(boundaryMap);
      }

      void updatePlotBoundaryLocationInfo(referencePoint.lat, referencePoint.lng);
      toast('Plot center updated from current map point.', 'success');
    });
  }

  if (!clearButton) return;

  clearButton.addEventListener('click', () => {
    clearBoundarySelection();
    centerBoundaryMapFromSelectedProperty();
  });
}

function updateUseCurrentPointButtonState(hasBoundary) {
  const useCurrentPointButton = $id('useCurrentPointBtn');
  const useCurrentPointHint = $id('useCurrentPointHint');

  if (!useCurrentPointButton) {
    return;
  }

  const isDisabled = Boolean(hasBoundary);
  useCurrentPointButton.disabled = isDisabled;

  if (isDisabled) {
    useCurrentPointButton.title = 'Disabled because a boundary polygon is already defined.';
    if (useCurrentPointHint) {
      useCurrentPointHint.textContent =
        'Disabled: remove the polygon boundary to enable center-point selection.';
    }
    return;
  }

  useCurrentPointButton.title = 'Use current map center as plot center.';
  if (useCurrentPointHint) {
    useCurrentPointHint.textContent = 'Available when no boundary polygon is defined.';
  }
}

function hasBoundaryGeoJson() {
  const boundaryInput = $id('boundaryGeoJson');
  return String(boundaryInput?.value || '').trim().length > 0;
}

function setupBoundaryMapSearch() {
  const searchInput = $id('plotBoundarySearchInput');
  const searchButton = $id('plotBoundarySearchBtn');
  const resultsContainer = $id('plotBoundarySearchResults');
  const resultsList = $id('plotBoundaryResultsList');

  if (!searchInput || !searchButton || !resultsContainer || !resultsList) {
    return;
  }

  const defaultButtonContent = searchButton.innerHTML;

  const runSearch = async () => {
    const query = String(searchInput.value || '').trim();
    if (!query) {
      toast('Please enter a location to search.', 'warning');
      return;
    }

    if (searchButton.disabled) {
      return;
    }

    searchButton.disabled = true;
    searchButton.classList.add('btn-loading');
    searchButton.innerHTML = '<span class="spinner" aria-hidden="true"></span> Searching...';
    resultsContainer.style.display = 'block';
    resultsList.innerHTML = '<div class="loading-text">Searching...</div>';

    try {
      const { results, warning, error } = await searchAddressWithMeta(query);

      if (!Array.isArray(results) || results.length === 0) {
        const feedback = buildBoundarySearchFeedback(warning, error);
        const emptyMessage = error || 'No results found. Try a more complete address.';
        resultsList.innerHTML = `${feedback}<div class="empty-text">${escapeHtml(emptyMessage)}</div>`;
        return;
      }

      const feedback = buildBoundarySearchFeedback(warning, error);

      resultsList.innerHTML =
        feedback +
        results
          .map(
            (result, index) => `
              <div class="result-item" data-index="${index}">
                <div class="result-title">${escapeHtml(result.display_name || 'Unnamed result')}</div>
                <div class="result-coords">📍 ${Number(result.lat).toFixed(6)}, ${Number(result.lon).toFixed(6)}</div>
              </div>
            `
          )
          .join('');

      resultsList.querySelectorAll('.result-item').forEach((item) => {
        item.addEventListener('click', () => {
          const selectedIndex = Number(item.getAttribute('data-index'));
          const selected = results[selectedIndex];
          focusBoundaryMapOnCoordinates(selected?.lat, selected?.lon);
          resultsContainer.style.display = 'none';
        });
      });
    } catch {
      resultsList.innerHTML =
        '<div class="error-text">Search is temporarily unavailable. Please try again.</div>';
    } finally {
      searchButton.disabled = false;
      searchButton.classList.remove('btn-loading');
      searchButton.innerHTML = defaultButtonContent;
    }
  };

  searchButton.addEventListener('click', runSearch);

  searchInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      runSearch();
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') {
      return;
    }

    const clickedInsideSearch = target.closest(
      '#plotBoundarySearchResults, #plotBoundarySearchInput, #plotBoundarySearchBtn'
    );
    if (!clickedInsideSearch) {
      resultsContainer.style.display = 'none';
    }
  });
}

function buildBoundarySearchFeedback(warning, error) {
  const blocks = [];

  if (warning) {
    blocks.push(`<div class="warning-text">${escapeHtml(warning)}</div>`);
  }

  if (error) {
    blocks.push(`<div class="error-text">${escapeHtml(error)}</div>`);
  }

  return blocks.join('');
}

function focusBoundaryMapOnCoordinates(latitude, longitude) {
  if (!boundaryMap) {
    return;
  }

  const lat = Number(latitude);
  const lon = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    toast('Invalid coordinates returned by search.', 'warning');
    return;
  }

  boundaryMap.setView([lat, lon], 16);

  if (boundarySearchMarker) {
    boundaryMap.removeLayer(boundarySearchMarker);
  }

  boundarySearchMarker = L.marker([lat, lon], {
    title: 'Selected search result'
  }).addTo(boundaryMap);

  void updatePlotBoundaryLocationInfo(lat, lon);
}

function clearBoundarySelection() {
  boundaryDrawnItems?.clearLayers();

  const boundaryInput = $id('boundaryGeoJson');
  const latitudeInput = $id('latitude');
  const longitudeInput = $id('longitude');
  const areaDisplayInput = $id('calculatedAreaDisplay');

  if (boundaryInput) boundaryInput.value = '';
  if (latitudeInput) latitudeInput.value = '';
  if (longitudeInput) longitudeInput.value = '';
  if (areaDisplayInput) areaDisplayInput.value = 'Not calculated yet';
  setPlotBoundaryLocationInfo('📍 Select a location to preview on map');
  updateUseCurrentPointButtonState(false);
}

function syncBoundaryDataFromLayer(layer) {
  if (!layer) return;

  const geoJson = layer.toGeoJSON();
  const geoJsonString = JSON.stringify(geoJson);
  const areaHectares = calculateAreaInHectares(geoJson);
  const centroid = calculateCentroid(geoJson);

  const boundaryInput = $id('boundaryGeoJson');
  const areaInput = $id('areaHectares');
  const latitudeInput = $id('latitude');
  const longitudeInput = $id('longitude');
  const areaDisplayInput = $id('calculatedAreaDisplay');

  if (boundaryInput) {
    boundaryInput.value = geoJsonString;
  }

  updateUseCurrentPointButtonState(true);

  if (centroid) {
    if (latitudeInput) latitudeInput.value = centroid.latitude.toFixed(6);
    if (longitudeInput) longitudeInput.value = centroid.longitude.toFixed(6);
    void updatePlotBoundaryLocationInfo(centroid.latitude, centroid.longitude);
  }

  if (typeof areaHectares === 'number' && Number.isFinite(areaHectares) && areaHectares > 0) {
    const roundedArea = Number(areaHectares.toFixed(2));
    if (areaInput) {
      areaInput.value = String(roundedArea);
    }
    if (areaDisplayInput) {
      areaDisplayInput.value = `${roundedArea.toFixed(2)} ha`;
    }
  } else if (areaDisplayInput) {
    areaDisplayInput.value = 'Area unavailable';
  }
}

function calculateAreaInHectares(geoJson) {
  try {
    const areaSquareMeters = turfArea(geoJson);
    return areaSquareMeters / HECTARES_CONVERSION_FACTOR;
  } catch (error) {
    console.warn('Could not calculate polygon area:', error);
    return null;
  }
}

function calculateCentroid(geoJson) {
  try {
    const centroid = turfCentroid(geoJson);
    const [longitude, latitude] = centroid.geometry.coordinates;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return { latitude, longitude };
  } catch (error) {
    console.warn('Could not calculate polygon centroid:', error);
    return null;
  }
}

function centerBoundaryMapToDefault() {
  if (!boundaryMap) return;
  boundaryMap.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
  setPlotBoundaryLocationInfo('📍 Select a location to preview on map');
}

function centerBoundaryMapFromSelectedProperty() {
  if (!boundaryMap) return;

  const propertyId = $id('propertyId')?.value;
  if (!propertyId) {
    centerBoundaryMapToDefault();
    return;
  }

  const selectedProperty = propertiesCache.find((property) => property.id === propertyId);
  const latitude = selectedProperty?.latitude ?? selectedProperty?.Latitude ?? null;
  const longitude = selectedProperty?.longitude ?? selectedProperty?.Longitude ?? null;

  if (typeof latitude === 'number' && typeof longitude === 'number') {
    boundaryMap.setView([latitude, longitude], 15);
    setPlotBoundaryLocationInfo(
      `📍 Centered on property: ${selectedProperty?.name || 'Selected property'}`
    );
    return;
  }

  centerBoundaryMapToDefault();
}

function setPlotBoundaryLocationInfo(text) {
  const infoElement = $id('plotBoundaryLocationInfo');
  if (!infoElement) {
    return;
  }

  infoElement.textContent = text;
}

async function updatePlotBoundaryLocationInfo(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return;
  }

  setPlotBoundaryLocationInfo(`📍 ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);

  try {
    const details = await reverseGeocodeDetails(latitude, longitude);
    if (details?.display_name) {
      setPlotBoundaryLocationInfo(`📍 ${details.display_name}`);
    }
  } catch {
    // Keep coordinates fallback when reverse geocoding is unavailable.
  }
}

function renderExistingBoundary(boundaryGeoJsonValue) {
  if (!boundaryMap || !boundaryDrawnItems || !boundaryGeoJsonValue) return;

  try {
    const parsedGeoJson =
      typeof boundaryGeoJsonValue === 'string'
        ? JSON.parse(boundaryGeoJsonValue)
        : boundaryGeoJsonValue;

    const geoJsonLayer = L.geoJSON(parsedGeoJson);
    boundaryDrawnItems.clearLayers();

    geoJsonLayer.eachLayer((layer) => {
      boundaryDrawnItems.addLayer(layer);
    });

    const layers = boundaryDrawnItems.getLayers();
    if (layers.length > 0) {
      syncBoundaryDataFromLayer(layers[0]);
      const bounds = layers[0].getBounds?.();
      if (bounds && bounds.isValid?.()) {
        boundaryMap.fitBounds(bounds, { padding: [20, 20] });
      }
      updateUseCurrentPointButtonState(true);
    }
  } catch (error) {
    console.warn('Could not render existing plot boundary from GeoJSON:', error);
    updateUseCurrentPointButtonState(false);
  }
}

// ============================================
// Edit Mode Setup
// ============================================

async function setupEditMode() {
  const pageTitle = $id('pageTitle');
  const formTitle = $id('formTitle');
  const breadcrumbCurrent = $id('breadcrumbCurrent');
  const sensorsSection = $id('sensorsSection');

  if (pageTitle) pageTitle.textContent = 'Edit Plot';
  if (formTitle) formTitle.textContent = 'Edit Plot';
  if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Edit';
  if (sensorsSection) sensorsSection.style.display = 'block';

  try {
    const plot = await getPlot(editId);
    updateEditHeaderWithOwner(plot);
    updateOwnerNameDisplay(plot);
    populateForm(plot);
    setReadOnlyEditMode();
    setupAssociatedSensorsActions(plot?.id || editId);
    await loadSensorsForPlot(plot?.id || editId);
    toast('Edit mode is not available yet. Fields are read-only.', 'warning');
  } catch (error) {
    const { message } = normalizeError(error);
    showFormError(message || 'Failed to load plot');
    toast(message || 'Failed to load plot', 'error');
  }
}

function updateEditHeaderWithOwner(plot) {
  if (!isEditMode || isCurrentUserAdmin()) {
    return;
  }

  const ownerName = String(plot?.ownerName || plot?.OwnerName || '').trim();
  if (!ownerName) {
    return;
  }

  const formTitle = $id('formTitle');
  const breadcrumbCurrent = $id('breadcrumbCurrent');

  if (formTitle) {
    formTitle.textContent = `Edit Plot · Owner: ${ownerName}`;
  }

  if (breadcrumbCurrent) {
    breadcrumbCurrent.textContent = `Edit · ${ownerName}`;
  }
}

function updateOwnerNameDisplay(plot) {
  const ownerNameGroup = $id('ownerNameDisplayGroup');
  const ownerNameField = $id('ownerNameDisplay');

  if (!ownerNameGroup || !ownerNameField) {
    return;
  }

  const ownerName = String(plot?.ownerName || plot?.OwnerName || '').trim();
  const shouldDisplay = isEditMode && !isCurrentUserAdmin() && ownerName.length > 0;

  ownerNameGroup.style.display = shouldDisplay ? 'block' : 'none';
  ownerNameField.value = shouldDisplay ? ownerName : '';
}

function setReadOnlyEditMode() {
  const form = $id('plotForm');
  if (!form) return;

  const interactiveElements = form.querySelectorAll('input, select, textarea, button');
  interactiveElements.forEach((element) => {
    element.disabled = true;
  });

  const formLinks = form.querySelectorAll('a');
  formLinks.forEach((link) => {
    const isCancelLink =
      link.closest('.form-actions') && link.getAttribute('href') === 'plots.html';
    if (isCancelLink) {
      return;
    }

    link.setAttribute('aria-disabled', 'true');
    link.setAttribute('tabindex', '-1');
    link.style.pointerEvents = 'none';
    link.style.opacity = '0.6';
  });

  const sensorsSection = $id('sensorsSection');
  const sensorsButtons = sensorsSection?.querySelectorAll('button') || [];
  sensorsButtons.forEach((button) => {
    if (button.id === 'addAssociatedSensorBtn') {
      return;
    }
    button.disabled = true;
  });

  const formError = $id('formErrors');
  if (formError) {
    formError.textContent = 'Edit mode is not available yet. This screen is read-only.';
    formError.style.display = 'block';
  }
}

function setupAssociatedSensorsActions(plotId) {
  const addSensorButton = $id('addAssociatedSensorBtn');
  if (!addSensorButton || !plotId) {
    return;
  }

  addSensorButton.disabled = false;
  addSensorButton.addEventListener('click', () => {
    navigateTo(`sensors-form.html?plotId=${encodeURIComponent(plotId)}`);
  });
}

// ============================================
// Populate Form
// ============================================

function populateForm(plot) {
  const normalizedCropType = normalizeCropType(plot.cropType);

  const fields = {
    plotId: plot.id,
    ownerId: plot.ownerId || '',
    propertyId: plot.propertyId,
    name: plot.name,
    areaHectares: plot.areaHectares,
    latitude: plot.latitude ?? plot.Latitude ?? '',
    longitude: plot.longitude ?? plot.Longitude ?? '',
    boundaryGeoJson: plot.boundaryGeoJson ?? plot.BoundaryGeoJson ?? '',
    cropType: normalizedCropType,
    plantingDate: formatDateForInput(plot.plantingDate),
    expectedHarvest: formatDateForInput(plot.expectedHarvestDate || plot.expectedHarvest),
    irrigationType: normalizeIrrigationType(plot.irrigationType || ''),
    minSoilMoisture: plot.minSoilMoisture || 30,
    maxTemperature: plot.maxTemperature || 35,
    minHumidity: plot.minHumidity || 40,
    status: plot.status || 'active',
    notes: plot.additionalNotes || ''
  };

  Object.entries(fields).forEach(([id, value]) => {
    const element = $id(id);
    if (element) element.value = value;
  });

  const parsedArea = parseFloat(fields.areaHectares);
  const areaDisplayInput = $id('calculatedAreaDisplay');
  if (areaDisplayInput && Number.isFinite(parsedArea) && parsedArea > 0) {
    areaDisplayInput.value = `${parsedArea.toFixed(2)} ha`;
  }

  renderExistingBoundary(fields.boundaryGeoJson);
}

function loadCropTypeOptions() {
  const select = $id('cropType');
  if (!select) return;

  const currentValue = select.value;

  select.innerHTML = [`<option value="">Select crop type...</option>`]
    .concat(
      COMMON_CROP_TYPES.map((cropType) => {
        const icon = CROP_TYPE_ICONS[cropType] || '🌿';
        return `<option value="${cropType}">${icon} ${cropType}</option>`;
      })
    )
    .join('');

  const normalizedCurrent = normalizeCropType(currentValue);
  if (normalizedCurrent) {
    select.value = normalizedCurrent;
  }

  updateCropPlantingHint(select.value);

  select.addEventListener('change', () => {
    updateCropPlantingHint(select.value);
    applySuggestedFieldDefaultsForCrop(select.value);
  });

  if (!isEditMode && select.value) {
    applySuggestedFieldDefaultsForCrop(select.value);
  }
}

function setupCropTypePicker() {
  const DEFAULT_MODAL_MAX_WIDTH = '720px';
  const TABLE_MODAL_MAX_WIDTH = 'min(1280px, 96vw)';

  const openButton = $id('openCropPickerBtn');
  const openDefaultsButton = $id('openCropDefaultsTableBtn');
  const modal = $id('cropPickerModal');
  const modalContent = $id('cropPickerModalContent');
  const closeButton = $id('cropPickerCloseBtn');
  const cancelButton = $id('cropPickerCancelBtn');
  const searchModeButton = $id('cropPickerSearchModeBtn');
  const tableModeButton = $id('cropPickerTableModeBtn');
  const searchPanel = $id('cropPickerSearchPanel');
  const tablePanel = $id('cropDefaultsTablePanel');
  const defaultsFilterInput = $id('cropDefaultsFilterInput');
  const tableBody = $id('cropDefaultsTableBody');
  const searchInput = $id('cropPickerSearch');
  const resultsContainer = $id('cropPickerResults');
  const cropTypeSelect = $id('cropType');
  let lastFocusedElement = null;

  if (
    !openButton ||
    !openDefaultsButton ||
    !modal ||
    !modalContent ||
    !closeButton ||
    !cancelButton ||
    !searchModeButton ||
    !tableModeButton ||
    !searchPanel ||
    !tablePanel ||
    !defaultsFilterInput ||
    !tableBody ||
    !searchInput ||
    !resultsContainer ||
    !cropTypeSelect
  ) {
    return;
  }

  const closeModal = () => {
    const activeElement = document.activeElement;
    const focusTarget =
      isElementNode(lastFocusedElement) && document.contains(lastFocusedElement)
        ? lastFocusedElement
        : openButton;

    if (isElementNode(activeElement) && modal.contains(activeElement)) {
      activeElement.blur();
      focusTarget?.focus();
    }

    modal.classList.remove('open');
    modal.setAttribute('inert', '');
    modal.setAttribute('aria-hidden', 'true');
    modalContent.style.maxWidth = DEFAULT_MODAL_MAX_WIDTH;
    searchInput.value = '';
    defaultsFilterInput.value = '';
  };

  const openModal = () => {
    lastFocusedElement = isElementNode(document.activeElement) ? document.activeElement : null;
    modal.removeAttribute('inert');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    setPickerMode('search');
    renderCropPickerResults('');
    setTimeout(() => searchInput.focus(), 0);
  };

  const openDefaultsTableModal = () => {
    lastFocusedElement = isElementNode(document.activeElement) ? document.activeElement : null;
    modal.removeAttribute('inert');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    defaultsFilterInput.value = '';
    renderCropDefaultsTable('');
    setPickerMode('table');
    setTimeout(() => tableModeButton.focus(), 0);
  };

  const setPickerMode = (mode) => {
    const searchMode = mode !== 'table';

    searchPanel.style.display = searchMode ? 'block' : 'none';
    tablePanel.style.display = searchMode ? 'none' : 'block';
    modalContent.style.maxWidth = searchMode ? DEFAULT_MODAL_MAX_WIDTH : TABLE_MODAL_MAX_WIDTH;

    searchModeButton.classList.toggle('btn-secondary', searchMode);
    searchModeButton.classList.toggle('btn-outline', !searchMode);

    tableModeButton.classList.toggle('btn-secondary', !searchMode);
    tableModeButton.classList.toggle('btn-outline', searchMode);

    if (!searchMode) {
      renderCropDefaultsTable(defaultsFilterInput.value);
    }
  };

  const selectCropType = (cropTypeValue) => {
    const selectedCropType = normalizeCropType(cropTypeValue);
    if (!selectedCropType) {
      return;
    }

    cropTypeSelect.value = selectedCropType;
    cropTypeSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    closeModal();
  };

  const renderCropDefaultsTable = (query) => {
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];

    const normalizedQuery = String(query || '')
      .trim()
      .toLowerCase();

    const filteredDefaults = CROP_TYPE_DEFAULTS_TABLE.filter((item) => {
      if (!normalizedQuery) {
        return true;
      }

      const searchable = [
        item.cropType,
        item.plantingWindow,
        item.suggestedIrrigationType,
        String(item.harvestCycleMonths),
        String(item.minSoilMoisture),
        String(item.maxTemperature),
        String(item.minHumidity)
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });

    if (filteredDefaults.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="7" class="empty-text">No defaults found for this filter.</td></tr>';
      return;
    }

    tableBody.innerHTML = filteredDefaults
      .map((item) => {
        const icon = CROP_TYPE_ICONS[item.cropType] || '🌿';
        const suggestedIrrigationDisplay = getIrrigationTypeDisplay(item.suggestedIrrigationType);
        const soilMoistureDisplay = `🌱 ${String(item.minSoilMoisture)}%`;
        const temperatureDisplay = `🌡️ ${String(item.maxTemperature)}°C`;
        const humidityDisplay = `💧 ${String(item.minHumidity)}%`;
        const monthsLabel =
          Array.isArray(item.plantingMonths) && item.plantingMonths.length > 0
            ? item.plantingMonths
                .map((month) => monthNames[Number(month) - 1] || String(month))
                .join(', ')
            : 'Year-round / custom';

        return `
        <tr
          class="crop-default-selectable-row"
          data-crop-type="${escapeHtml(item.cropType)}"
          tabindex="0"
          role="button"
          aria-label="Select crop type ${escapeHtml(item.cropType)}"
        >
          <td>${icon} ${escapeHtml(item.cropType)}</td>
          <td>
            <div>${escapeHtml(item.plantingWindow)}</div>
            <div class="text-muted" style="font-size: 0.8rem">${escapeHtml(monthsLabel)}</div>
          </td>
          <td>${escapeHtml(String(item.harvestCycleMonths))}</td>
          <td>${escapeHtml(suggestedIrrigationDisplay)}</td>
          <td>${escapeHtml(soilMoistureDisplay)}</td>
          <td>${escapeHtml(temperatureDisplay)}</td>
          <td>${escapeHtml(humidityDisplay)}</td>
        </tr>
      `;
      })
      .join('');

    tableBody.querySelectorAll('tr[data-crop-type]').forEach((row) => {
      const selectFromRow = () => {
        const selectedCropType = row.getAttribute('data-crop-type') || '';
        selectCropType(selectedCropType);
      };

      row.addEventListener('click', () => {
        selectFromRow();
      });

      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectFromRow();
        }
      });
    });
  };

  const renderCropPickerResults = (query) => {
    const normalizedQuery = String(query || '')
      .trim()
      .toLowerCase();

    const filtered = COMMON_CROP_TYPES.filter((cropType) =>
      cropType.toLowerCase().includes(normalizedQuery)
    );

    if (filtered.length === 0) {
      resultsContainer.innerHTML =
        '<div class="empty-text">No crop found for this search. Try another term.</div>';
      return;
    }

    resultsContainer.innerHTML = filtered
      .map((cropType) => {
        const icon = CROP_TYPE_ICONS[cropType] || '🌿';
        const plantingWindow = getCropPlantingWindow(cropType);

        return `
          <button
            type="button"
            class="result-item"
            data-crop-type="${escapeHtml(cropType)}"
            style="width: 100%; text-align: left; background: transparent; border-left: none; border-right: none; border-top: none"
          >
            <div class="result-title">${icon} ${escapeHtml(cropType)}</div>
            <div class="result-coords">🗓️ Planting window: ${escapeHtml(plantingWindow)}</div>
          </button>
        `;
      })
      .join('');

    resultsContainer.querySelectorAll('[data-crop-type]').forEach((button) => {
      button.addEventListener('click', () => {
        const selectedCropType = button.getAttribute('data-crop-type') || '';
        selectCropType(selectedCropType);
      });
    });
  };

  openButton.addEventListener('click', () => {
    openModal();
  });

  openDefaultsButton.addEventListener('click', () => {
    openDefaultsTableModal();
  });

  searchModeButton.addEventListener('click', () => {
    setPickerMode('search');
    searchInput.focus();
  });

  tableModeButton.addEventListener('click', () => {
    setPickerMode('table');
  });

  defaultsFilterInput.addEventListener('input', () => {
    renderCropDefaultsTable(defaultsFilterInput.value);
  });

  closeButton.addEventListener('click', () => {
    closeModal();
  });

  cancelButton.addEventListener('click', () => {
    closeModal();
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('open')) {
      closeModal();
    }
  });

  searchInput.addEventListener('input', () => {
    renderCropPickerResults(searchInput.value);
  });
}

function updateCropPlantingHint(cropType) {
  const hint = $id('cropTypePlantingHint');
  if (!hint) {
    return;
  }

  const normalizedCropType = normalizeCropType(cropType);
  if (!normalizedCropType) {
    hint.textContent = 'Select a crop to see suggested planting window.';
    return;
  }

  const plantingWindow = getCropPlantingWindow(normalizedCropType);
  const suggestedDate = getSuggestedFuturePlantingDate(normalizedCropType);
  if (!suggestedDate) {
    hint.textContent = `Suggested planting window: ${plantingWindow}`;
    return;
  }

  hint.textContent = `Suggested planting window: ${plantingWindow} · Next suggested date: ${formatDateFromInputValue(suggestedDate)}`;
}

function isElementNode(value) {
  return Boolean(value && typeof value === 'object' && value.nodeType === 1);
}

function applySuggestedPlantingDateForCrop(cropType) {
  if (isEditMode) {
    return '';
  }

  const plantingDateInput = $id('plantingDate');
  if (!plantingDateInput) {
    return '';
  }

  const suggestedDate = getSuggestedFuturePlantingDate(cropType);
  if (!suggestedDate) {
    return '';
  }

  plantingDateInput.value = suggestedDate;

  return suggestedDate;
}

function applySuggestedExpectedHarvestForCrop(cropType, plantingDateInputValue = '') {
  if (isEditMode) {
    return;
  }

  const expectedHarvestInput = $id('expectedHarvest');
  if (!expectedHarvestInput) {
    return;
  }

  const resolvedPlantingDate = plantingDateInputValue || $id('plantingDate')?.value || '';
  const suggestedExpectedHarvestDate = getSuggestedExpectedHarvestDate(
    cropType,
    resolvedPlantingDate
  );

  if (!suggestedExpectedHarvestDate) {
    return;
  }

  expectedHarvestInput.value = suggestedExpectedHarvestDate;
}

function applySuggestedAlertThresholdsForCrop(cropType) {
  if (isEditMode) {
    return;
  }

  const thresholds = getCropAlertThresholds(cropType);

  const minSoilMoistureInput = $id('minSoilMoisture');
  const maxTemperatureInput = $id('maxTemperature');
  const minHumidityInput = $id('minHumidity');

  if (minSoilMoistureInput) {
    minSoilMoistureInput.value = String(thresholds.minSoilMoisture);
  }

  if (maxTemperatureInput) {
    maxTemperatureInput.value = String(thresholds.maxTemperature);
  }

  if (minHumidityInput) {
    minHumidityInput.value = String(thresholds.minHumidity);
  }
}

function applySuggestedIrrigationTypeForCrop(cropType) {
  if (isEditMode) {
    return;
  }

  const irrigationTypeSelect = $id('irrigationType');
  if (!irrigationTypeSelect) {
    return;
  }

  const suggestedIrrigationType = normalizeIrrigationType(getSuggestedIrrigationType(cropType));
  if (!suggestedIrrigationType) {
    return;
  }

  irrigationTypeSelect.value = suggestedIrrigationType;
}

function applySuggestedFieldDefaultsForCrop(cropType) {
  const suggestedPlantingDate = applySuggestedPlantingDateForCrop(cropType);
  applySuggestedExpectedHarvestForCrop(cropType, suggestedPlantingDate);
  applySuggestedAlertThresholdsForCrop(cropType);
  applySuggestedIrrigationTypeForCrop(cropType);
}

function formatDateFromInputValue(dateInputValue) {
  const date = new Date(`${dateInputValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateInputValue;
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  });
}

function loadIrrigationTypeOptions() {
  const select = $id('irrigationType');
  if (!select) return;

  const currentValue = normalizeIrrigationType(select.value);

  select.innerHTML = [`<option value="">Select...</option>`]
    .concat(
      IRRIGATION_TYPES.map((type) => {
        const icon = IRRIGATION_TYPE_ICONS[type] || '💦';
        return `<option value="${type}">${icon} ${type}</option>`;
      })
    )
    .join('');

  if (currentValue) {
    select.value = currentValue;
  }
}

// ============================================
// Load Sensors for Plot
// ============================================

async function loadSensorsForPlot(plotId) {
  const sensorsSection = $id('sensorsSection');
  const sensorsList = $id('sensorsList');
  if (!sensorsSection || !sensorsList || !plotId) {
    if (sensorsSection) {
      sensorsSection.style.display = 'none';
    }
    return;
  }

  sensorsList.innerHTML = '<p class="text-muted">Loading associated sensors...</p>';

  try {
    const response = await getPlotSensorsPaginated(plotId, {
      pageNumber: 1,
      pageSize: 100,
      sortBy: 'installedAt',
      sortDirection: 'desc',
      filter: ''
    });

    const sensors = response?.data || response?.items || response?.results || [];

    if (!Array.isArray(sensors) || sensors.length === 0) {
      sensorsList.innerHTML = '<p class="text-muted">No sensors assigned to this plot.</p>';
      return;
    }

    const previewSensors = sensors.slice(0, ASSOCIATED_SENSORS_MAX_PREVIEW);
    const html = previewSensors
      .map((sensor) => {
        const sensorId = escapeHtml(sensor?.id || '-');
        const label = escapeHtml(sensor?.label || 'Unnamed sensor');
        const type = escapeHtml(sensor?.type || '-');
        const status = String(sensor?.status || 'Inactive');
        const installedAt = formatDateTime(sensor?.installedAt);
        const badgeClass = getSensorStatusBadgeClass(status);
        const statusDisplay = getSensorStatusDisplay(status);

        return `
    <div class="d-flex justify-between align-center" style="padding: 12px; border-bottom: 1px solid #e0e0e0; gap: 12px;">
      <div>
        <strong>📡 ${label}</strong>
        <div class="text-muted" style="font-size: 0.85em;">ID: ${sensorId}</div>
        <div class="text-muted" style="font-size: 0.85em;">Type: ${type} • Installed: ${installedAt}</div>
      </div>
      <span class="badge ${badgeClass}">${escapeHtml(statusDisplay)}</span>
    </div>
  `;
      })
      .join('');

    const shouldShowViewMore = sensors.length > ASSOCIATED_SENSORS_MAX_PREVIEW;
    const viewMoreHtml = shouldShowViewMore
      ? `
      <div style="margin-top: 12px; display: flex; justify-content: flex-end;">
        <a href="sensors.html" class="btn btn-outline btn-sm">View More</a>
      </div>
    `
      : '';

    sensorsList.innerHTML = html + viewMoreHtml;
  } catch (error) {
    console.warn('Could not load associated sensors from Farm API. Hiding sensors section.', error);
    sensorsSection.style.display = 'none';
    toast(
      'Associated sensors section hidden: Farm API route not available for this context.',
      'warning'
    );
  }
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

// ============================================
// Form Submit Handler
// ============================================

function setupFormHandler() {
  const form = $id('plotForm');
  if (!form) return;

  if (isEditMode) {
    return;
  }

  form.addEventListener('submit', handleSubmit);
}

async function handleSubmit(e) {
  e.preventDefault();
  clearFormErrors();

  const isAdmin = isCurrentUserAdmin();
  const selectedOwnerId = $id('ownerId')?.value?.trim() || '';

  const plantingDateValue = $id('plantingDate')?.value?.trim() || '';
  const expectedHarvestValue = $id('expectedHarvest')?.value?.trim() || '';
  const notesValidation = sanitizeAndValidateAdditionalNotes($id('notes')?.value ?? '');

  if (notesValidation.error) {
    showFormError(notesValidation.error);
    toast(notesValidation.error, 'error');
    return;
  }

  const formData = {
    propertyId: $id('propertyId')?.value,
    name: $id('name')?.value,
    areaHectares: parseFloat($id('areaHectares')?.value) || 0,
    latitude: $id('latitude')?.value ? parseFloat($id('latitude')?.value) : null,
    longitude: $id('longitude')?.value ? parseFloat($id('longitude')?.value) : null,
    boundaryGeoJson: $id('boundaryGeoJson')?.value?.trim() || null,
    cropType: $id('cropType')?.value,
    plantingDate: toDateTimeOffset(plantingDateValue),
    expectedHarvestDate: toDateTimeOffset(expectedHarvestValue),
    irrigationType: normalizeIrrigationType($id('irrigationType')?.value),
    additionalNotes: notesValidation.value
  };

  if (isAdmin && !isEditMode && selectedOwnerId) {
    formData.ownerId = selectedOwnerId;
  }

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

  if ((formData.latitude === null) !== (formData.longitude === null)) {
    showFormError('Latitude and Longitude must be informed together.');
    return;
  }

  if (isAdmin && !isEditMode && !selectedOwnerId) {
    const ownerSelect = $id('ownerId');
    if (ownerSelect) {
      ownerSelect.setCustomValidity('Please select an owner.');
      ownerSelect.reportValidity();
    }
    showFormError('Please select an owner.');
    return;
  }

  if (isEditMode) {
    showFormError('Plot update is not available yet in this screen.');
    return;
  }

  showLoading('Saving plot...');

  try {
    await createPlot({
      ownerId: formData.ownerId,
      propertyId: formData.propertyId,
      name: formData.name,
      areaHectares: formData.areaHectares,
      latitude: formData.latitude,
      longitude: formData.longitude,
      boundaryGeoJson: formData.boundaryGeoJson,
      cropType: formData.cropType,
      plantingDate: formData.plantingDate,
      expectedHarvestDate: formData.expectedHarvestDate,
      irrigationType: formData.irrigationType,
      additionalNotes: formData.additionalNotes
    });

    toast('Plot created successfully', 'success');
    navigateTo('plots.html');
  } catch (error) {
    const message = extractApiErrorMessage(error);
    showFormError(message);
  } finally {
    hideLoading();
  }
}

function extractApiErrorMessage(error) {
  const fallback = 'An error occurred. Please try again.';

  if (error?.response?.data) {
    const data = error.response.data;

    if (Array.isArray(data.errors) && data.errors.length > 0) {
      const reasons = data.errors.map((err) => err.reason || err.message).filter(Boolean);
      if (reasons.length > 0) {
        return reasons.join('\n');
      }
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
  if (!errorDiv) {
    toast(message, 'error');
    return;
  }

  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

function clearFormErrors() {
  const errorDiv = $id('formErrors');
  if (!errorDiv) return;
  errorDiv.textContent = '';
  errorDiv.style.display = 'none';
}

function formatDateForInput(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toDateTimeOffset(dateInputValue) {
  if (!dateInputValue) return null;

  const date = new Date(`${dateInputValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function sanitizeAndValidateAdditionalNotes(rawValue) {
  if (typeof rawValue !== 'string') {
    return { value: null, error: null };
  }

  if (rawValue.length > ADDITIONAL_NOTES_MAX_LENGTH) {
    return {
      value: null,
      error: `Additional notes must be at most ${ADDITIONAL_NOTES_MAX_LENGTH} characters.`
    };
  }

  const suspiciousPatterns = [
    /<\s*script/gi,
    /<\s*\/\s*script\s*>/gi,
    /javascript\s*:/gi,
    /on\w+\s*=/gi
  ];
  if (suspiciousPatterns.some((pattern) => pattern.test(rawValue))) {
    return {
      value: null,
      error:
        'Additional notes contain unsafe content. Please remove scripts or HTML event attributes.'
    };
  }

  const withoutControlChars = Array.from(rawValue)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join('');
  const withoutHtmlTags = withoutControlChars.replace(/<[^>]*>/g, '');
  const normalized = withoutHtmlTags.trim();

  if (!normalized) {
    return { value: null, error: null };
  }

  return { value: normalized, error: null };
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
      } else if (id === 'notes' && el.validity.tooLong) {
        el.setCustomValidity(
          `Additional notes must be at most ${ADDITIONAL_NOTES_MAX_LENGTH} characters.`
        );
        toast(
          `Additional notes must be at most ${ADDITIONAL_NOTES_MAX_LENGTH} characters.`,
          'warning'
        );
      }
    },
    true
  );

  // Clear custom messages on input
  plotsForm.addEventListener('input', (e) => {
    e.target.setCustomValidity('');
  });

  const ownerSelect = $id('ownerId');
  if (ownerSelect) {
    ownerSelect.addEventListener('change', () => {
      ownerSelect.setCustomValidity('');
    });
  }
}
