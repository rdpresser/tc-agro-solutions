export const SENSOR_STATUSES = ['Active', 'Inactive', 'Maintenance', 'Faulty'];

export const SENSOR_STATUS_ICONS = {
  Active: '🟢',
  Inactive: '⚪',
  Maintenance: '🟡',
  Faulty: '🔴'
};

export const SENSOR_STATUS_LABELS = {
  Active: 'Active',
  Inactive: 'Inactive',
  Maintenance: 'Maintenance',
  Faulty: 'Faulty'
};

const SENSOR_STATUS_ALIASES = {
  active: 'Active',
  inactive: 'Inactive',
  maintenance: 'Maintenance',
  faulty: 'Faulty',
  online: 'Active',
  warning: 'Maintenance',
  offline: 'Inactive'
};

export function normalizeSensorStatus(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const normalized = raw.toLowerCase();
  const matchedFromList = SENSOR_STATUSES.find((item) => item.toLowerCase() === normalized);
  if (matchedFromList) return matchedFromList;

  return SENSOR_STATUS_ALIASES[normalized] || raw;
}

export function getSensorStatusIcon(value) {
  const status = normalizeSensorStatus(value);
  return SENSOR_STATUS_ICONS[status] || '⚫';
}

export function getSensorStatusLabel(value) {
  const status = normalizeSensorStatus(value);
  return SENSOR_STATUS_LABELS[status] || status || '';
}

export function getSensorStatusDisplay(value) {
  const label = getSensorStatusLabel(value);
  if (!label) return '-';
  return `${getSensorStatusIcon(value)} ${label}`;
}

export function getSensorStatusBadgeClass(value) {
  const status = normalizeSensorStatus(value);
  if (status === 'Active') return 'badge-success';
  if (status === 'Maintenance') return 'badge-warning';
  if (status === 'Inactive') return 'badge-secondary';
  if (status === 'Faulty') return 'badge-danger';
  return 'badge-secondary';
}
