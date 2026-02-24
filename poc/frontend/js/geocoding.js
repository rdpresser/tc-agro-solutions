/* global fetch */
/**
 * Geocoding module for browser usage
 * Primary provider: geocode.maps.co (CORS-friendly)
 * Fallback provider: Photon (komoot)
 */

const MAPSCO_SEARCH_URL = 'https://geocode.maps.co/search';
const MAPSCO_REVERSE_URL = 'https://geocode.maps.co/reverse';
const PHOTON_SEARCH_URL = 'https://photon.komoot.io/api';
const PHOTON_REVERSE_URL = 'https://photon.komoot.io/reverse';
const REQUEST_TIMEOUT_MS = 9000;
const MAPSCO_API_KEY = (import.meta.env.VITE_MAPSCO_API_KEY || '').trim();

function withTimeout(promise, timeoutMs = REQUEST_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error('Request timeout')), timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

async function fetchJson(url) {
  const response = await withTimeout(
    fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    })
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

function mapAddressFields(address = {}) {
  const city = address.city || address.town || address.village || address.municipality || '';
  const road = address.road || address.pedestrian || address.footway || address.path || '';
  const houseNumber = address.house_number || '';
  const street = [road, houseNumber].filter(Boolean).join(', ').trim();

  return {
    street,
    city,
    state: address.state || address.region || address.state_district || '',
    country: address.country || '',
    postcode: address.postcode || '',
    neighbourhood: address.suburb || address.neighbourhood || '',
    houseNumber
  };
}

function mapMapsCoResult(item) {
  return {
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    display_name: item.display_name || '',
    address: mapAddressFields(item.address)
  };
}

function mapPhotonResult(feature) {
  const [lon, lat] = feature?.geometry?.coordinates || [];
  const props = feature?.properties || {};

  const street = [props.street, props.housenumber].filter(Boolean).join(', ').trim();

  return {
    lat: Number(lat),
    lon: Number(lon),
    display_name:
      [props.name, props.city, props.state, props.country].filter(Boolean).join(' - ') ||
      [props.street, props.city, props.country].filter(Boolean).join(', '),
    address: {
      street,
      city: props.city || '',
      state: props.state || '',
      country: props.country || '',
      postcode: props.postcode || '',
      neighbourhood: props.district || props.suburb || '',
      houseNumber: props.housenumber || ''
    }
  };
}

async function searchMapsCo(query) {
  if (!MAPSCO_API_KEY) {
    throw new Error('maps.co API key not configured');
  }

  const params = new URLSearchParams({
    q: query,
    api_key: MAPSCO_API_KEY
  });

  const json = await fetchJson(`${MAPSCO_SEARCH_URL}?${params}`);
  const results = Array.isArray(json) ? json : [];

  return results
    .map(mapMapsCoResult)
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon));
}

async function reverseMapsCo(lat, lon) {
  if (!MAPSCO_API_KEY) {
    throw new Error('maps.co API key not configured');
  }

  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    api_key: MAPSCO_API_KEY
  });

  const json = await fetchJson(`${MAPSCO_REVERSE_URL}?${params}`);
  if (!json) {
    return null;
  }

  return mapMapsCoResult(json);
}

async function searchPhoton(query) {
  const params = new URLSearchParams({
    q: query,
    limit: '10'
  });

  const json = await fetchJson(`${PHOTON_SEARCH_URL}?${params}`);
  const features = Array.isArray(json?.features) ? json.features : [];

  return features
    .map(mapPhotonResult)
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon));
}

async function reversePhoton(lat, lon) {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString()
  });

  const json = await fetchJson(`${PHOTON_REVERSE_URL}?${params}`);
  const feature = Array.isArray(json?.features) ? json.features[0] : null;

  if (!feature) {
    return null;
  }

  const mapped = mapPhotonResult(feature);
  return Number.isFinite(mapped.lat) && Number.isFinite(mapped.lon) ? mapped : null;
}

/**
 * Search for addresses matching the query string
 * @param {string} query - Address query
 * @returns {Promise<Array>} Array of {lat, lon, display_name, address}
 */
export async function searchAddress(query) {
  const { results } = await searchAddressWithMeta(query);
  return results;
}

/**
 * Search for addresses and return metadata for UI feedback
 * @param {string} query - Address query
 * @returns {Promise<{results:Array, provider:string, warning:string|null, error:string|null}>}
 */
export async function searchAddressWithMeta(query) {
  if (!query || query.trim().length === 0) {
    return {
      results: [],
      provider: 'none',
      warning: null,
      error: 'Please type an address before searching.'
    };
  }

  const normalizedQuery = query.trim();

  try {
    const photonResults = await searchPhoton(normalizedQuery);

    if (photonResults.length > 0) {
      return {
        results: photonResults,
        provider: 'photon',
        warning: null,
        error: null
      };
    }

    if (MAPSCO_API_KEY) {
      const mapsCoResults = await searchMapsCo(normalizedQuery);

      return {
        results: mapsCoResults,
        provider: 'mapsco',
        warning:
          mapsCoResults.length > 0
            ? 'No primary provider results. Using secondary provider (maps.co).'
            : null,
        error:
          mapsCoResults.length === 0
            ? 'No results found. Try a more complete address (street, city, state).'
            : null
      };
    }

    return {
      results: [],
      provider: 'photon',
      warning: null,
      error: 'No results found. Try a more complete address (street, city, state).'
    };
  } catch {
    if (MAPSCO_API_KEY) {
      try {
        const mapsCoResults = await searchMapsCo(normalizedQuery);

        return {
          results: mapsCoResults,
          provider: 'mapsco',
          warning:
            mapsCoResults.length > 0
              ? 'Primary provider is unavailable. Using secondary provider (maps.co).'
              : null,
          error:
            mapsCoResults.length === 0
              ? 'Search failed due to provider/network restrictions. Please try again.'
              : null
        };
      } catch {
        return {
          results: [],
          provider: 'none',
          warning: null,
          error:
            'Search is temporarily unavailable due to provider/network restrictions. Please try again later.'
        };
      }
    }

    return {
      results: [],
      provider: 'none',
      warning: null,
      error:
        'Search is temporarily unavailable due to provider/network restrictions. Please try again later.'
    };
  }
}

/**
 * Reverse geocode coordinates to address text
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<string>} Display name / fallback coordinates
 */
export async function reverseGeocode(lat, lon) {
  try {
    const details = await reversePhoton(lat, lon);
    return details?.display_name || `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  } catch {
    try {
      if (!MAPSCO_API_KEY) {
        return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
      }

      const details = await reverseMapsCo(lat, lon);
      return details?.display_name || `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    } catch {
      return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    }
  }
}

/**
 * Reverse geocode coordinates with structured address fields
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<{lat:number, lon:number, display_name:string, address:object} | null>}
 */
export async function reverseGeocodeDetails(lat, lon) {
  try {
    const details = await reversePhoton(lat, lon);
    return details || null;
  } catch {
    try {
      if (!MAPSCO_API_KEY) {
        return null;
      }

      const details = await reverseMapsCo(lat, lon);
      return details || null;
    } catch {
      return null;
    }
  }
}

/**
 * Format coordinates as readable string
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} precision - Decimal places (default: 6)
 * @returns {string} Formatted coordinates
 */
export function formatCoordinates(lat, lon, precision = 6) {
  return `${lat.toFixed(precision)}, ${lon.toFixed(precision)}`;
}

/**
 * Validate if coordinates are within Brazil bounds (rough check)
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {boolean} True if within approximate Brazil bounds
 */
export function isValidBrazilCoordinates(lat, lon) {
  const minLat = -33.75;
  const maxLat = 5.25;
  const minLon = -73.98;
  const maxLon = -28.84;

  return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
}
