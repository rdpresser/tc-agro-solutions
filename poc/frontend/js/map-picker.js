/* global CustomEvent */

/**
 * Map Picker module using Leaflet
 * Provides interactive map with draggable marker for location selection
 * Leaflet is imported from npm package
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import {
  reverseGeocode,
  reverseGeocodeDetails,
  formatCoordinates,
  isValidBrazilCoordinates
} from './geocoding.js';

// Default center: São Paulo, Brazil
const DEFAULT_LAT = -23.5505;
const DEFAULT_LON = -46.6333;
const DEFAULT_ZOOM = 13;

let map = null;
let marker = null;
let selectedLat = DEFAULT_LAT;
let selectedLon = DEFAULT_LON;

/**
 * Initialize the map (called once when modal opens)
 * @param {number} initialLat - Starting latitude
 * @param {number} initialLon - Starting longitude
 */
function initializeMap(initialLat = DEFAULT_LAT, initialLon = DEFAULT_LON) {
  const mapContainer = document.getElementById('mapContainer');

  if (!mapContainer) {
    console.error('Map container not found');
    return;
  }

  // Destroy existing map if present
  if (map) {
    map.remove();
    map = null;
    marker = null;
  }

  // Validate coordinates
  if (!isValidBrazilCoordinates(initialLat, initialLon)) {
    initialLat = DEFAULT_LAT;
    initialLon = DEFAULT_LON;
  }

  selectedLat = initialLat;
  selectedLon = initialLon;

  // Initialize map
  map = L.map(mapContainer).setView([selectedLat, selectedLon], DEFAULT_ZOOM);

  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  // Add draggable marker
  marker = L.marker([selectedLat, selectedLon], {
    draggable: true,
    title: 'Arraste para ajustar a localização'
  }).addTo(map);

  // Update location when marker is dragged
  marker.on('dragend', async () => {
    const pos = marker.getLatLng();
    selectedLat = pos.lat;
    selectedLon = pos.lng;
    updateLocationInfo();
  });

  // Update location when map is clicked
  map.on('click', async (e) => {
    const { lat, lng } = e.latlng;
    selectedLat = lat;
    selectedLon = lng;
    marker.setLatLng([lat, lng]);
    updateLocationInfo();
  });

  updateLocationInfo();
}

/**
 * Update the location info display above the map
 */
async function updateLocationInfo() {
  const infoElement = document.getElementById('locationInfo');
  if (!infoElement) return;

  const coords = formatCoordinates(selectedLat, selectedLon, 6);
  infoElement.textContent = `📍 ${coords}`;

  // Optionally show address (reverse geocoding)
  try {
    const address = await reverseGeocode(selectedLat, selectedLon);
    infoElement.textContent = `📍 ${address}`;
  } catch {
    // Fallback to coordinates if reverse geocoding fails
    infoElement.textContent = `📍 ${coords}`;
  }
}

/**
 * Open the map modal with initial coordinates
 * @param {number} lat - Initial latitude (optional)
 * @param {number} lon - Initial longitude (optional)
 * @returns {Promise<void>}
 */
export async function openMapModal(lat = null, lon = null) {
  const modal = document.getElementById('locationModal');
  if (!modal) {
    console.error('Location modal not found');
    return;
  }

  // Use provided coordinates or defaults
  const initialLat = lat || DEFAULT_LAT;
  const initialLon = lon || DEFAULT_LON;

  // Show modal
  modal.style.display = 'flex';

  // Small delay to ensure DOM is ready
  setTimeout(() => {
    initializeMap(initialLat, initialLon);
  }, 100);
}

/**
 * Close the map modal
 */
export function closeMapModal() {
  const modal = document.getElementById('locationModal');
  if (modal) {
    modal.style.display = 'none';
  }

  // Clean up map
  if (map) {
    map.remove();
    map = null;
    marker = null;
  }
}

/**
 * Get the currently selected coordinates
 * @returns {Object} {lat, lon}
 */
export function getSelectedCoordinates() {
  return {
    lat: parseFloat(selectedLat.toFixed(6)),
    lon: parseFloat(selectedLon.toFixed(6))
  };
}

/**
 * Set up modal event listeners (called once on page load)
 */
export function setupMapModalListeners() {
  const modal = document.getElementById('locationModal');
  const confirmBtn = document.getElementById('confirmLocationBtn');
  const closeBtn = document.getElementById('closeLocationBtn');

  if (!modal || !confirmBtn || !closeBtn) {
    console.warn('Map modal elements not fully initialized');
    return;
  }

  // Close button
  closeBtn.addEventListener('click', closeMapModal);

  // Confirm button
  confirmBtn.addEventListener('click', async () => {
    const coords = getSelectedCoordinates();

    // Update hidden form fields
    const latInput = document.getElementById('latitude');
    const lonInput = document.getElementById('longitude');

    if (latInput && lonInput) {
      latInput.value = coords.lat;
      lonInput.value = coords.lon;
    }

    const details = await reverseGeocodeDetails(coords.lat, coords.lon);

    // Close modal
    closeMapModal();

    const event = new CustomEvent('locationSelected', {
      detail: {
        ...coords,
        display_name: details?.display_name || '',
        address: details?.address || null
      }
    });
    document.dispatchEvent(event);
  });

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeMapModal();
    }
  });

  // Prevent close on container click
  const container = document.getElementById('locationModalContent');
  if (container) {
    container.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
}

/**
 * Search for address and center map
 * @param {Array} results - Geocoding search results
 * @param {number} selectedIndex - Index of result to use
 */
export function selectSearchResult(results, selectedIndex) {
  if (!results || selectedIndex >= results.length) return;

  const result = results[selectedIndex];
  selectedLat = result.lat;
  selectedLon = result.lon;

  if (map && marker) {
    map.setView([selectedLat, selectedLon], DEFAULT_ZOOM);
    marker.setLatLng([selectedLat, selectedLon]);
  }

  updateLocationInfo();
}
