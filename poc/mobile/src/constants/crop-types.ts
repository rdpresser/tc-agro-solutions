export const CROP_TYPES = [
  { value: 'Soybean', label: 'Soybean' },
  { value: 'Corn', label: 'Corn' },
  { value: 'Coffee', label: 'Coffee' },
  { value: 'Sugarcane', label: 'Sugarcane' },
  { value: 'Cotton', label: 'Cotton' },
  { value: 'Rice', label: 'Rice' },
  { value: 'Wheat', label: 'Wheat' },
  { value: 'Beans', label: 'Beans' },
  { value: 'Cassava', label: 'Cassava' },
  { value: 'Orange', label: 'Orange' },
] as const;

export const IRRIGATION_TYPES = [
  { value: 'Drip', label: 'Drip' },
  { value: 'Sprinkler', label: 'Sprinkler' },
  { value: 'Flood', label: 'Flood' },
  { value: 'CenterPivot', label: 'Center Pivot' },
  { value: 'None', label: 'None' },
] as const;

export const SENSOR_TYPES = [
  { value: 'Temperature', label: 'Temperature' },
  { value: 'Humidity', label: 'Humidity' },
  { value: 'SoilMoisture', label: 'Soil Moisture' },
  { value: 'Rainfall', label: 'Rainfall' },
  { value: 'MultiSensor', label: 'Multi Sensor' },
] as const;

export const SENSOR_STATUSES = [
  { value: 'Active', label: 'Active', color: '#28a745' },
  { value: 'Inactive', label: 'Inactive', color: '#6c757d' },
  { value: 'Maintenance', label: 'Maintenance', color: '#ffc107' },
  { value: 'Faulty', label: 'Faulty', color: '#dc3545' },
] as const;

export const PLOT_STATUSES = [
  { value: 'Active', label: 'Active' },
  { value: 'Harvested', label: 'Harvested' },
  { value: 'Fallow', label: 'Fallow' },
  { value: 'Preparing', label: 'Preparing' },
] as const;

export const USER_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'User' },
  { value: 'viewer', label: 'Viewer' },
] as const;
