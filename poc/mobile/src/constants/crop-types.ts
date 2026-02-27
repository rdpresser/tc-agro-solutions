export const CROP_TYPES = [
  { value: 'Apple', label: 'Apple', icon: '🍎' },
  { value: 'Banana', label: 'Banana', icon: '🍌' },
  { value: 'Beans', label: 'Beans', icon: '🫘' },
  { value: 'Carrot', label: 'Carrot', icon: '🥕' },
  { value: 'Coffee', label: 'Coffee', icon: '☕' },
  { value: 'Corn', label: 'Corn', icon: '🌽' },
  { value: 'Cotton', label: 'Cotton', icon: '🌸' },
  { value: 'Grape', label: 'Grape', icon: '🍇' },
  { value: 'Lettuce', label: 'Lettuce', icon: '🥬' },
  { value: 'Mango', label: 'Mango', icon: '🥭' },
  { value: 'Onion', label: 'Onion', icon: '🧅' },
  { value: 'Orange', label: 'Orange', icon: '🍊' },
  { value: 'Pasture', label: 'Pasture', icon: '🌱' },
  { value: 'Potato', label: 'Potato', icon: '🥔' },
  { value: 'Rice', label: 'Rice', icon: '🍚' },
  { value: 'Soy', label: 'Soy', icon: '🌿' },
  { value: 'Sugarcane', label: 'Sugarcane', icon: '🎋' },
  { value: 'Tomato', label: 'Tomato', icon: '🍅' },
  { value: 'Wheat', label: 'Wheat', icon: '🌾' },
  { value: 'Other', label: 'Other', icon: '📦' },
] as const;

export const IRRIGATION_TYPES = [
  { value: 'Drip Irrigation', label: 'Drip Irrigation' },
  { value: 'Sprinkler', label: 'Sprinkler' },
  { value: 'Center Pivot', label: 'Center Pivot' },
  { value: 'Flood/Furrow', label: 'Flood/Furrow' },
  { value: 'Rainfed (No Irrigation)', label: 'Rainfed (No Irrigation)' },
] as const;

export const SENSOR_TYPES = [
  { value: 'Temperature', label: 'Temperature', icon: '🌡️' },
  { value: 'Humidity', label: 'Humidity', icon: '💧' },
  { value: 'SoilMoisture', label: 'Soil Moisture', icon: '🌱' },
  { value: 'Rainfall', label: 'Rainfall', icon: '🌧️' },
  { value: 'WindSpeed', label: 'Wind Speed', icon: '💨' },
  { value: 'SolarRadiation', label: 'Solar Radiation', icon: '☀️' },
  { value: 'Ph', label: 'pH', icon: '🧪' },
  { value: 'MultiSensor', label: 'Multi Sensor', icon: '📟' },
] as const;

export const SENSOR_STATUSES = [
  { value: 'Active', label: 'Active', color: '#28a745', icon: '🟢' },
  { value: 'Inactive', label: 'Inactive', color: '#6c757d', icon: '⚪' },
  { value: 'Maintenance', label: 'Maintenance', color: '#ffc107', icon: '🟡' },
  { value: 'Faulty', label: 'Faulty', color: '#dc3545', icon: '🔴' },
] as const;

export const PLOT_STATUSES = [
  { value: 'Active', label: 'Active' },
  { value: 'Harvested', label: 'Harvested' },
  { value: 'Fallow', label: 'Fallow' },
  { value: 'Preparing', label: 'Preparing' },
] as const;

export const USER_ROLES = [
  { value: 'Admin', label: 'Admin' },
  { value: 'Producer', label: 'Producer' },
] as const;

export const ALERT_SEVERITIES = [
  { value: 'critical', label: 'Critical', color: '#dc3545' },
  { value: 'high', label: 'High', color: '#E74C3C' },
  { value: 'medium', label: 'Medium', color: '#ffc107' },
  { value: 'low', label: 'Low', color: '#17a2b8' },
] as const;

export function getCropIcon(cropType: string): string {
  const crop = CROP_TYPES.find((c) => c.value.toLowerCase() === cropType?.toLowerCase());
  return crop?.icon || '📦';
}

export function getSensorIcon(sensorType: string): string {
  const sensor = SENSOR_TYPES.find((s) => s.value.toLowerCase() === sensorType?.toLowerCase());
  return sensor?.icon || '📟';
}
