// Auth
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  jwtToken: string;
  email: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface TokenInfo {
  email: string;
  name: string;
  role: string;
  sub: string;
  exp: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: string;
  isActive: boolean;
  status?: 'Active' | 'Inactive' | 'Disabled';
}

// Properties
export interface Property {
  id: string;
  name: string;
  ownerName: string;
  ownerId?: string;
  city: string;
  state: string;
  country: string;
  areaHectares: number;
  plotCount: number;
  isActive: boolean;
  createdAt: string;
  latitude?: number;
  longitude?: number;
}

export interface CreatePropertyRequest {
  name: string;
  ownerId: string;
  city: string;
  state: string;
  country: string;
  areaHectares: number;
  latitude?: number;
  longitude?: number;
}

export interface UpdatePropertyRequest extends CreatePropertyRequest {
  id: string;
}

// Plots
export interface Plot {
  id: string;
  name: string;
  propertyName: string;
  propertyId: string;
  cropType: string;
  plantingDate: string;
  expectedHarvestDate: string;
  irrigationType: string;
  areaHectares: number;
  sensorsCount: number;
  status: string;
  healthStatus?: string;
  temperatureMin?: number;
  temperatureMax?: number;
  humidityMin?: number;
  humidityMax?: number;
  soilMoistureMin?: number;
  soilMoistureMax?: number;
}

export interface CreatePlotRequest {
  name: string;
  propertyId: string;
  cropType: string;
  plantingDate: string;
  expectedHarvestDate: string;
  irrigationType: string;
  areaHectares: number;
  temperatureMin?: number;
  temperatureMax?: number;
  humidityMin?: number;
  humidityMax?: number;
  soilMoistureMin?: number;
  soilMoistureMax?: number;
}

// Sensors
export interface Sensor {
  id: string;
  label: string;
  type: string;
  status: string;
  plotId: string;
  plotName: string;
  propertyName?: string;
  installedAt: string;
  batteryLevel?: number;
}

export interface CreateSensorRequest {
  label: string;
  type: string;
  plotId: string;
}

// Readings
export interface SensorReading {
  id?: string;
  sensorId: string;
  plotId?: string;
  plotName?: string;
  propertyName?: string;
  sensorLabel?: string;
  temperature: number;
  humidity: number;
  soilMoisture: number;
  rainfall: number;
  batteryLevel?: number;
  timestamp: string;
}

// Alerts
export interface Alert {
  id: string;
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'Pending' | 'Acknowledged' | 'Resolved';
  plotName?: string;
  sensorId?: string;
  createdAt: string;
  resolvedAt?: string;
  alertType?: string;
}

// Owners
export interface Owner {
  id: string;
  name: string;
  email?: string;
}

// Dashboard
export interface DashboardStats {
  propertiesCount: number;
  plotsCount: number;
  sensorsCount: number;
  alertsCount: number;
}

export interface DashboardMetrics {
  avgTemperature: number;
  avgHumidity: number;
  avgSoilMoisture: number;
  avgRainfall: number;
}

// Pagination
export interface PaginatedRequest {
  pageNumber?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  filter?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// SignalR
export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';
