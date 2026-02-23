export const SENSOR_TYPES = [
  'Temperature',
  'Humidity',
  'SoilMoisture',
  'Rainfall',
  'WindSpeed',
  'SolarRadiation',
  'Ph'
];

export const SENSOR_TYPE_ICONS = {
  Temperature: '🌡️',
  Humidity: '💧',
  SoilMoisture: '🌱',
  Rainfall: '🌧️',
  WindSpeed: '💨',
  SolarRadiation: '☀️',
  Ph: '🧪'
};

export const SENSOR_TYPE_LABELS = {
  Temperature: 'Temperature',
  Humidity: 'Humidity',
  SoilMoisture: 'Soil Moisture',
  Rainfall: 'Rainfall',
  WindSpeed: 'Wind Speed',
  SolarRadiation: 'Solar Radiation',
  Ph: 'pH'
};

const SENSOR_TYPE_ALIASES = {
  temperature: 'Temperature',
  humidity: 'Humidity',
  soilmoisture: 'SoilMoisture',
  'soil moisture': 'SoilMoisture',
  soil: 'SoilMoisture',
  rainfall: 'Rainfall',
  rain: 'Rainfall',
  windspeed: 'WindSpeed',
  'wind speed': 'WindSpeed',
  solarradiation: 'SolarRadiation',
  'solar radiation': 'SolarRadiation',
  ph: 'Ph',
  'p h': 'Ph',
  'p.h': 'Ph'
};

export function normalizeSensorType(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const normalized = raw.toLowerCase();
  const matchedFromList = SENSOR_TYPES.find((item) => item.toLowerCase() === normalized);
  if (matchedFromList) return matchedFromList;

  return SENSOR_TYPE_ALIASES[normalized] || raw;
}

export function getSensorTypeIcon(value) {
  const type = normalizeSensorType(value);
  return SENSOR_TYPE_ICONS[type] || '📟';
}

export function getSensorTypeLabel(value) {
  const type = normalizeSensorType(value);
  return SENSOR_TYPE_LABELS[type] || type || '';
}

export function getSensorTypeDisplay(value) {
  const label = getSensorTypeLabel(value);
  if (!label) return '-';
  return `${getSensorTypeIcon(value)} ${label}`;
}
