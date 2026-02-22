export const SENSOR_TYPES = [
  'Temperature',
  'Humidity',
  'SoilMoisture',
  'Rainfall',
  'WindSpeed',
  'SolarRadiation',
  'Ph'
];

export function normalizeSensorType(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const normalized = raw.toLowerCase();
  const matched = SENSOR_TYPES.find((item) => item.toLowerCase() === normalized);
  return matched || raw;
}
