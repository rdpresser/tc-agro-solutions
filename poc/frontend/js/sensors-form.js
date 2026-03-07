/**
 * Sensors Form Page - Create + Read-only Edit
 */

import {
  createSensor,
  fetchFarmSwagger,
  getProperty,
  getPlot,
  getPlotsPaginated,
  getSensorById,
  normalizeError,
  getOwnersPaginated,
  getOwnersQueryParameterMapFromSwagger
} from './api.js';
import { requireAuth } from './auth.js';
import { initProtectedPage } from './common.js';
import { toast } from './i18n.js';
import { getSensorTypeDisplay, normalizeSensorType, SENSOR_TYPES } from './sensor-types.js';
import { $id, getQueryParam, navigateTo, showLoading, hideLoading, getUser } from './utils.js';

const editId = getQueryParam('id');
const isEditMode = !!editId;
const preselectedPlotId = getQueryParam('plotId');
const OWNER_PAGE_SIZE = 1000;
const OWNER_SORT_BY = 'name';
const OWNER_SORT_DIRECTION = 'asc';
const COORDINATE_DECIMAL_PLACES = 6;
const ZERO_COORDINATE = '0.000000';
const COORDINATE_SOURCE_PROPERTY = 'property';
const COORDINATE_SOURCE_PLOT = 'plot';
const COORDINATE_SOURCE_MIXED = 'mixed';
const COORDINATE_SOURCE_NONE = 'none';
const plotLocationById = new Map();
const propertyLocationById = new Map();
let plotLocationRequestVersion = 0;

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;

  initProtectedPage();
  await checkFarmApi();
  await setupOwnerSelector();
  loadSensorTypeOptions();

  if (isEditMode) {
    setEditModeUI();
    await loadSensor(editId);
    setReadOnlyEditMode();
    return;
  }

  setCreateModeUI();
  await loadPlotOptions();
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

function setCreateModeUI() {
  const pageTitle = $id('pageTitle');
  const formTitle = $id('formTitle');
  const breadcrumbCurrent = $id('breadcrumbCurrent');

  if (pageTitle) pageTitle.textContent = 'Add Sensor';
  if (formTitle) formTitle.textContent = 'Add New Sensor';
  if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Add New';
}

function setEditModeUI() {
  const pageTitle = $id('pageTitle');
  const formTitle = $id('formTitle');
  const breadcrumbCurrent = $id('breadcrumbCurrent');

  if (pageTitle) pageTitle.textContent = 'Edit Sensor';
  if (formTitle) formTitle.textContent = 'Edit Sensor';
  if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Edit';
}

function setReadOnlyEditMode() {
  const form = $id('sensorForm');
  if (!form) return;

  const interactiveElements = form.querySelectorAll('input, select, textarea, button');
  interactiveElements.forEach((element) => {
    element.disabled = true;
  });

  const formLinks = form.querySelectorAll('a');
  formLinks.forEach((link) => {
    const isCancelLink =
      link.closest('.form-actions') && link.getAttribute('href') === 'sensors.html';
    if (isCancelLink) {
      return;
    }

    link.setAttribute('aria-disabled', 'true');
    link.setAttribute('tabindex', '-1');
    link.style.pointerEvents = 'none';
    link.style.opacity = '0.6';
  });

  const formError = $id('formErrors');
  if (formError) {
    formError.textContent = 'Edit mode is not available yet. This screen is read-only.';
    formError.style.display = 'block';
  }
}

async function fetchAllPages(fetchFn, baseParams = {}) {
  const allItems = [];
  let pageNumber = 1;
  const pageSize = 100;
  let keepFetching = true;
  let maxPagesSafety = 25;

  while (keepFetching && maxPagesSafety > 0) {
    const response = await fetchFn({ ...baseParams, pageNumber, pageSize });
    const items = response?.data || response?.items || response?.results || [];
    allItems.push(...(Array.isArray(items) ? items : []));

    if (response?.hasNextPage === true) {
      pageNumber += 1;
      maxPagesSafety -= 1;
    } else {
      keepFetching = false;
    }
  }

  return allItems;
}

function loadSensorTypeOptions() {
  const select = $id('type');
  if (!select) return;

  const currentValue = select.value;

  select.innerHTML = [`<option value="">Select sensor type...</option>`]
    .concat(
      SENSOR_TYPES.map((type) => `<option value="${type}">${getSensorTypeDisplay(type)}</option>`)
    )
    .join('');

  const normalizedCurrent = normalizeSensorType(currentValue);
  if (normalizedCurrent) {
    select.value = normalizedCurrent;
  }
}

function resolveCoordinateFromCandidates(candidates) {
  for (const candidate of candidates) {
    const coordinate = normalizeCoordinate(candidate);
    if (coordinate !== null) {
      return coordinate;
    }
  }

  return null;
}

function hasAnyCoordinates(location) {
  return location && (location.latitude !== null || location.longitude !== null);
}

function hasBothCoordinates(location) {
  return location && location.latitude !== null && location.longitude !== null;
}

function normalizeCoordinateSource(source) {
  const normalized = String(source || '')
    .trim()
    .toLowerCase();

  if (
    normalized === COORDINATE_SOURCE_PROPERTY ||
    normalized === COORDINATE_SOURCE_PLOT ||
    normalized === COORDINATE_SOURCE_MIXED ||
    normalized === COORDINATE_SOURCE_NONE
  ) {
    return normalized;
  }

  return COORDINATE_SOURCE_NONE;
}

function getCoordinateSourceMessage(source) {
  switch (normalizeCoordinateSource(source)) {
    case COORDINATE_SOURCE_PROPERTY:
      return 'Coordinates source: property (priority)';
    case COORDINATE_SOURCE_PLOT:
      return 'Coordinates source: plot';
    case COORDINATE_SOURCE_MIXED:
      return 'Coordinates source: mixed (property priority with plot fallback)';
    default:
      return 'Coordinates loaded from selected plot';
  }
}

function extractPropertyId(record) {
  const rawPropertyId =
    record?.propertyId ||
    record?.PropertyId ||
    record?.property?.id ||
    record?.property?.Id ||
    record?.Property?.id ||
    record?.Property?.Id ||
    null;

  const normalizedPropertyId = String(rawPropertyId || '').trim();
  return normalizedPropertyId.length > 0 ? normalizedPropertyId : null;
}

function getPropertyLatitude(plot) {
  return resolveCoordinateFromCandidates([
    plot?.propertyLatitude,
    plot?.PropertyLatitude,
    plot?.property?.latitude,
    plot?.property?.Latitude,
    plot?.Property?.latitude,
    plot?.Property?.Latitude,
    plot?.propertyLocation?.latitude,
    plot?.propertyLocation?.Latitude,
    plot?.PropertyLocation?.latitude,
    plot?.PropertyLocation?.Latitude,
    plot?.property?.location?.latitude,
    plot?.property?.location?.Latitude,
    plot?.Property?.location?.latitude,
    plot?.Property?.location?.Latitude
  ]);
}

function getPropertyLongitude(plot) {
  return resolveCoordinateFromCandidates([
    plot?.propertyLongitude,
    plot?.PropertyLongitude,
    plot?.property?.longitude,
    plot?.property?.Longitude,
    plot?.Property?.longitude,
    plot?.Property?.Longitude,
    plot?.propertyLocation?.longitude,
    plot?.propertyLocation?.Longitude,
    plot?.PropertyLocation?.longitude,
    plot?.PropertyLocation?.Longitude,
    plot?.property?.location?.longitude,
    plot?.property?.location?.Longitude,
    plot?.Property?.location?.longitude,
    plot?.Property?.location?.Longitude
  ]);
}

function getPlotLatitude(plot) {
  return resolveCoordinateFromCandidates([
    plot?.plotLatitude,
    plot?.PlotLatitude,
    plot?.latitude,
    plot?.Latitude,
    plot?.plot?.latitude,
    plot?.plot?.Latitude,
    plot?.Plot?.latitude,
    plot?.Plot?.Latitude
  ]);
}

function getPlotLongitude(plot) {
  return resolveCoordinateFromCandidates([
    plot?.plotLongitude,
    plot?.PlotLongitude,
    plot?.longitude,
    plot?.Longitude,
    plot?.plot?.longitude,
    plot?.plot?.Longitude,
    plot?.Plot?.longitude,
    plot?.Plot?.Longitude
  ]);
}

function normalizePropertyLocation(property) {
  const latitude = resolveCoordinateFromCandidates([
    property?.latitude,
    property?.Latitude,
    property?.propertyLatitude,
    property?.PropertyLatitude,
    property?.location?.latitude,
    property?.location?.Latitude,
    property?.Location?.latitude,
    property?.Location?.Latitude
  ]);

  const longitude = resolveCoordinateFromCandidates([
    property?.longitude,
    property?.Longitude,
    property?.propertyLongitude,
    property?.PropertyLongitude,
    property?.location?.longitude,
    property?.location?.Longitude,
    property?.Location?.longitude,
    property?.Location?.Longitude
  ]);

  const source =
    latitude !== null || longitude !== null ? COORDINATE_SOURCE_PROPERTY : COORDINATE_SOURCE_NONE;

  return {
    latitude,
    longitude,
    source,
    propertyId: extractPropertyId(property)
  };
}

function mergeLocationWithPropertyPriority(plotLocation, propertyLocation, propertyId = null) {
  const plotLatitude = normalizeCoordinate(plotLocation?.latitude);
  const plotLongitude = normalizeCoordinate(plotLocation?.longitude);
  const propertyLatitude = normalizeCoordinate(propertyLocation?.latitude);
  const propertyLongitude = normalizeCoordinate(propertyLocation?.longitude);

  const latitude = propertyLatitude ?? plotLatitude;
  const longitude = propertyLongitude ?? plotLongitude;

  let source = COORDINATE_SOURCE_NONE;

  if (propertyLatitude !== null && propertyLongitude !== null) {
    source = COORDINATE_SOURCE_PROPERTY;
  } else if (plotLatitude !== null && plotLongitude !== null) {
    const normalizedPlotSource = normalizeCoordinateSource(plotLocation?.source);
    source =
      normalizedPlotSource === COORDINATE_SOURCE_NONE
        ? COORDINATE_SOURCE_PLOT
        : normalizedPlotSource;
  } else if (latitude !== null || longitude !== null) {
    const hasPropertyCoordinate = propertyLatitude !== null || propertyLongitude !== null;
    const hasPlotCoordinate = plotLatitude !== null || plotLongitude !== null;

    if (hasPropertyCoordinate && hasPlotCoordinate) {
      source = COORDINATE_SOURCE_MIXED;
    } else if (hasPropertyCoordinate) {
      source = COORDINATE_SOURCE_PROPERTY;
    } else {
      source = COORDINATE_SOURCE_PLOT;
    }
  }

  return {
    latitude,
    longitude,
    source,
    propertyId: propertyId || propertyLocation?.propertyId || plotLocation?.propertyId || null
  };
}

async function loadPlotOptions() {
  const select = $id('plotId');
  if (!select) return;

  const currentValue = select.value || preselectedPlotId || '';

  try {
    const plots = await fetchAllPages((params) => getPlotsPaginated(params), {
      sortBy: 'name',
      sortDirection: 'asc',
      filter: ''
    });

    plotLocationById.clear();

    select.innerHTML = `<option value="">Select a plot...</option>${plots
      .map((plot) => {
        const plotId = String(plot?.id || plot?.Id || '');
        if (!plotId) {
          return '';
        }

        const location = normalizePlotLocation(plot);
        const { latitude, longitude, source, propertyId } = location;
        plotLocationById.set(plotId, location);

        const latitudeDataAttribute = latitude !== null ? ` data-latitude="${latitude}"` : '';
        const longitudeDataAttribute = longitude !== null ? ` data-longitude="${longitude}"` : '';
        const sourceDataAttribute = ` data-coordinate-source="${source}"`;
        const propertyIdDataAttribute = propertyId ? ` data-property-id="${propertyId}"` : '';

        const plotName = escapeHtml(plot?.name || plot?.Name || 'Unnamed plot');
        const propertyName = escapeHtml(
          plot?.propertyName || plot?.PropertyName || 'Unknown property'
        );

        return `<option value="${plotId}"${latitudeDataAttribute}${longitudeDataAttribute}${sourceDataAttribute}${propertyIdDataAttribute}>${plotName} • ${propertyName}</option>`;
      })
      .filter(Boolean)
      .join('')}`;

    if (currentValue) {
      select.value = currentValue;
    }

    await syncPlotLocationFields();
  } catch (error) {
    const { message } = normalizeError(error);
    console.error('Error loading plot options:', error);
    toast(message || 'Failed to load plots', 'error');
    setPlotLocationMessage('Unable to load location coordinates', true);
  }
}

function setupFormHandler() {
  const form = $id('sensorForm');
  if (!form) return;

  form.addEventListener('submit', handleSubmit);

  const ownerSelect = $id('ownerId');
  if (ownerSelect) {
    ownerSelect.addEventListener('change', () => {
      ownerSelect.setCustomValidity('');
    });
  }

  const plotSelect = $id('plotId');
  if (plotSelect) {
    plotSelect.addEventListener('change', () => {
      plotSelect.setCustomValidity('');
      void syncPlotLocationFields();
    });
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  clearFormErrors();

  const isAdmin = isCurrentUserAdmin();
  const selectedOwnerId = $id('ownerId')?.value?.trim() || '';

  const payload = {
    plotId: $id('plotId')?.value,
    type: $id('type')?.value,
    label: $id('label')?.value?.trim() || null
  };

  if (isAdmin && !isEditMode && selectedOwnerId) {
    payload.ownerId = selectedOwnerId;
  }

  if (!payload.plotId || !payload.type) {
    showFormError('Plot and type are required fields.');
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

  showLoading('Saving sensor...');

  try {
    await createSensor(payload);
    toast('Sensor created successfully', 'success');
    navigateTo('sensors.html');
  } catch (error) {
    const message = extractApiErrorMessage(error);
    showFormError(message);
  } finally {
    hideLoading();
  }
}

async function loadSensor(id) {
  try {
    const sensor = await getSensorById(id);
    updateEditHeaderWithOwner(sensor);
    updateOwnerNameDisplay(sensor);
    populateForm(sensor);
    toast('Edit mode is not available yet. Fields are read-only.', 'warning');
  } catch (error) {
    const { message } = normalizeError(error);
    showFormError(message || 'Failed to load sensor');
    toast(message || 'Failed to load sensor', 'error');
  }
}

function updateEditHeaderWithOwner(sensor) {
  if (!isEditMode || isCurrentUserAdmin()) {
    return;
  }

  const ownerName = resolveOwnerDisplayName(sensor);
  if (!ownerName) {
    return;
  }

  const formTitle = $id('formTitle');
  const breadcrumbCurrent = $id('breadcrumbCurrent');

  if (formTitle) {
    formTitle.textContent = `Edit Sensor · Owner: ${ownerName}`;
  }

  if (breadcrumbCurrent) {
    breadcrumbCurrent.textContent = `Edit · ${ownerName}`;
  }
}

function updateOwnerNameDisplay(sensor) {
  const ownerNameGroup = $id('ownerNameDisplayGroup');
  const ownerNameField = $id('ownerNameDisplay');

  if (!ownerNameGroup || !ownerNameField) {
    return;
  }

  const ownerName = resolveOwnerDisplayName(sensor);
  const shouldDisplay = isEditMode && !isCurrentUserAdmin() && ownerName.length > 0;

  ownerNameGroup.style.display = shouldDisplay ? 'block' : 'none';
  ownerNameField.value = shouldDisplay ? ownerName : '';
}

function resolveOwnerDisplayName(sensor) {
  const ownerNameCandidate =
    sensor?.ownerName ||
    sensor?.OwnerName ||
    sensor?.owner?.name ||
    sensor?.owner?.Name ||
    sensor?.ownerDisplayName ||
    sensor?.OwnerDisplayName ||
    '';

  const normalizedOwnerName = String(ownerNameCandidate || '').trim();
  if (normalizedOwnerName.length > 0) {
    return normalizedOwnerName;
  }

  if (!isCurrentUserAdmin()) {
    const currentUserName = String(getUser()?.name || '').trim();
    if (currentUserName.length > 0) {
      return currentUserName;
    }
  }

  return '';
}

function populateForm(sensor) {
  if (!sensor) {
    showFormError('Sensor not found.');
    return;
  }

  const plotIdSelect = $id('plotId');
  if (plotIdSelect) {
    const sensorPlotId = String(sensor.plotId || sensor.PlotId || '');
    const sensorPlotName = escapeHtml(sensor.plotName || sensor.PlotName || 'Unknown plot');
    const sensorPropertyName = escapeHtml(
      sensor.propertyName || sensor.PropertyName || 'Unknown property'
    );
    const location = normalizePlotLocation(sensor);
    const { latitude, longitude, source, propertyId } = location;

    if (sensorPlotId) {
      plotLocationById.set(sensorPlotId, location);
    }

    const latitudeDataAttribute = latitude !== null ? ` data-latitude="${latitude}"` : '';
    const longitudeDataAttribute = longitude !== null ? ` data-longitude="${longitude}"` : '';
    const sourceDataAttribute = ` data-coordinate-source="${source}"`;
    const propertyIdDataAttribute = propertyId ? ` data-property-id="${propertyId}"` : '';

    plotIdSelect.innerHTML = `<option value="${sensorPlotId}"${latitudeDataAttribute}${longitudeDataAttribute}${sourceDataAttribute}${propertyIdDataAttribute}>${sensorPlotName} • ${sensorPropertyName}</option>`;
    plotIdSelect.value = sensorPlotId;
  }

  const typeSelect = $id('type');
  if (typeSelect) {
    typeSelect.value = normalizeSensorType(sensor.type);
  }

  const fields = {
    sensorId: sensor.id || '',
    ownerId: sensor.ownerId || '',
    label: sensor.label || ''
  };

  Object.entries(fields).forEach(([id, value]) => {
    const element = $id(id);
    if (element) element.value = value;
  });

  void syncPlotLocationFields();
}

function normalizePlotLocation(plot) {
  const propertyLatitude = getPropertyLatitude(plot);
  const propertyLongitude = getPropertyLongitude(plot);
  const plotLatitude = getPlotLatitude(plot);
  const plotLongitude = getPlotLongitude(plot);

  const latitude = propertyLatitude ?? plotLatitude;
  const longitude = propertyLongitude ?? plotLongitude;

  let source = COORDINATE_SOURCE_NONE;

  if (propertyLatitude !== null && propertyLongitude !== null) {
    source = COORDINATE_SOURCE_PROPERTY;
  } else if (plotLatitude !== null && plotLongitude !== null) {
    source = COORDINATE_SOURCE_PLOT;
  } else if (latitude !== null || longitude !== null) {
    const hasPropertyCoordinate = propertyLatitude !== null || propertyLongitude !== null;
    const hasPlotCoordinate = plotLatitude !== null || plotLongitude !== null;

    if (hasPropertyCoordinate && hasPlotCoordinate) {
      source = COORDINATE_SOURCE_MIXED;
    } else if (hasPropertyCoordinate) {
      source = COORDINATE_SOURCE_PROPERTY;
    } else {
      source = COORDINATE_SOURCE_PLOT;
    }
  }

  return {
    latitude,
    longitude,
    source,
    propertyId: extractPropertyId(plot)
  };
}

async function resolvePropertyLocation(propertyId) {
  const normalizedPropertyId = String(propertyId || '').trim();
  if (!normalizedPropertyId) {
    return {
      latitude: null,
      longitude: null,
      source: COORDINATE_SOURCE_NONE,
      propertyId: null
    };
  }

  const cachedLocation = propertyLocationById.get(normalizedPropertyId);
  if (cachedLocation) {
    return cachedLocation;
  }

  try {
    const property = await getProperty(normalizedPropertyId);
    const location = {
      ...normalizePropertyLocation(property),
      propertyId: normalizedPropertyId
    };
    propertyLocationById.set(normalizedPropertyId, location);
    return location;
  } catch (error) {
    console.error('Error loading property location:', error);
    const emptyLocation = {
      latitude: null,
      longitude: null,
      source: COORDINATE_SOURCE_NONE,
      propertyId: normalizedPropertyId
    };
    propertyLocationById.set(normalizedPropertyId, emptyLocation);
    return emptyLocation;
  }
}

function normalizeCoordinate(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatCoordinate(value) {
  return Number(value).toFixed(COORDINATE_DECIMAL_PLACES);
}

function setPlotLocationValues(latitude, longitude) {
  const latitudeField = $id('plotLatitude');
  const longitudeField = $id('plotLongitude');

  if (latitudeField) {
    latitudeField.value = latitude;
  }

  if (longitudeField) {
    longitudeField.value = longitude;
  }
}

function resetPlotLocationValues() {
  setPlotLocationValues('', '');
  setPlotLocationMessage('Select a plot to view location coordinates');
}

function setPlotLocationMessage(message, isWarning = false) {
  const messageElement = $id('plotLocationMessage');
  if (!messageElement) return;

  messageElement.textContent = message;
  messageElement.classList.toggle('text-warning', isWarning);
}

function readLocationFromOption(plotId) {
  const plotSelect = $id('plotId');
  if (!plotSelect) {
    return null;
  }

  const selectedOption = Array.from(plotSelect.options).find((option) => option.value === plotId);
  if (!selectedOption) {
    return null;
  }

  const location = {
    latitude: normalizeCoordinate(selectedOption.dataset.latitude),
    longitude: normalizeCoordinate(selectedOption.dataset.longitude),
    source: normalizeCoordinateSource(selectedOption.dataset.coordinateSource),
    propertyId: extractPropertyId({ propertyId: selectedOption.dataset.propertyId })
  };

  if (!hasAnyCoordinates(location)) {
    return null;
  }

  return location;
}

async function resolvePlotLocation(plotId) {
  const normalizedPlotId = String(plotId || '').trim();
  if (!normalizedPlotId) {
    return {
      latitude: null,
      longitude: null,
      source: COORDINATE_SOURCE_NONE,
      propertyId: null
    };
  }

  const cachedLocation = plotLocationById.get(normalizedPlotId);
  if (
    cachedLocation &&
    hasBothCoordinates(cachedLocation) &&
    normalizeCoordinateSource(cachedLocation.source) === COORDINATE_SOURCE_PROPERTY
  ) {
    return cachedLocation;
  }

  let propertyId = extractPropertyId(cachedLocation);
  let bestEffortLocation = hasAnyCoordinates(cachedLocation) ? cachedLocation : null;

  const optionLocation = readLocationFromOption(normalizedPlotId);
  if (optionLocation) {
    propertyId = propertyId || extractPropertyId(optionLocation);
    bestEffortLocation = optionLocation;
  }

  try {
    const plot = await getPlot(normalizedPlotId);
    const location = normalizePlotLocation(plot);
    propertyId = propertyId || extractPropertyId(location);

    if (hasAnyCoordinates(location)) {
      bestEffortLocation = location;
    }
  } catch (error) {
    console.error('Error loading plot location:', error);
  }

  if (propertyId) {
    const propertyLocation = await resolvePropertyLocation(propertyId);
    const prioritizedLocation = mergeLocationWithPropertyPriority(
      bestEffortLocation || {
        latitude: null,
        longitude: null,
        source: COORDINATE_SOURCE_NONE,
        propertyId
      },
      propertyLocation,
      propertyId
    );

    if (hasAnyCoordinates(prioritizedLocation)) {
      plotLocationById.set(normalizedPlotId, prioritizedLocation);
      return prioritizedLocation;
    }
  }

  if (bestEffortLocation) {
    const normalizedBestEffort = {
      ...bestEffortLocation,
      propertyId: propertyId || extractPropertyId(bestEffortLocation)
    };
    plotLocationById.set(normalizedPlotId, normalizedBestEffort);
    return normalizedBestEffort;
  }

  const emptyLocation = {
    latitude: null,
    longitude: null,
    source: COORDINATE_SOURCE_NONE,
    propertyId
  };
  plotLocationById.set(normalizedPlotId, emptyLocation);
  return emptyLocation;
}

async function syncPlotLocationFields() {
  const plotSelect = $id('plotId');
  if (!plotSelect) {
    return;
  }

  const selectedPlotId = String(plotSelect.value || '').trim();
  if (!selectedPlotId) {
    resetPlotLocationValues();
    return;
  }

  const requestVersion = ++plotLocationRequestVersion;
  const { latitude, longitude, source } = await resolvePlotLocation(selectedPlotId);
  if (requestVersion !== plotLocationRequestVersion) {
    return;
  }

  const hasNoCoordinates = latitude === null && longitude === null;
  if (hasNoCoordinates) {
    setPlotLocationValues(ZERO_COORDINATE, ZERO_COORDINATE);
    setPlotLocationMessage(
      '⚠️ Coordinates source: fallback 0.000000 (plot/property not configured).',
      true
    );
    return;
  }

  const normalizedLatitude = latitude ?? 0;
  const normalizedLongitude = longitude ?? 0;

  setPlotLocationValues(
    formatCoordinate(normalizedLatitude),
    formatCoordinate(normalizedLongitude)
  );
  setPlotLocationMessage(getCoordinateSourceMessage(source));
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

if (import.meta.env.DEV) {
  window.sensorsFormDebug = { loadSensor, loadPlotOptions };
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
