export const SENSOR_STATUSES = ['Active', 'Inactive', 'Maintenance', 'Faulty'];

export const SENSOR_STATUS_META = {
  Active: {
    icon: '🟢',
    label: 'Active',
    badgeClass: 'badge-status-active',
    cardClass: 'sensor-card-status-active',
    statIconClass: 'sensor-status-stat-icon-active'
  },
  Inactive: {
    icon: '🔵',
    label: 'Inactive',
    badgeClass: 'badge-status-inactive',
    cardClass: 'sensor-card-status-inactive',
    statIconClass: 'sensor-status-stat-icon-inactive'
  },
  Maintenance: {
    icon: '🟠',
    label: 'Maintenance',
    badgeClass: 'badge-status-maintenance',
    cardClass: 'sensor-card-status-maintenance',
    statIconClass: 'sensor-status-stat-icon-maintenance'
  },
  Faulty: {
    icon: '🔴',
    label: 'Faulty',
    badgeClass: 'badge-status-faulty',
    cardClass: 'sensor-card-status-faulty',
    statIconClass: 'sensor-status-stat-icon-faulty'
  }
};

export const SENSOR_STATUS_ICONS = Object.fromEntries(
  SENSOR_STATUSES.map((status) => [status, SENSOR_STATUS_META[status]?.icon || '⚫'])
);

export const SENSOR_STATUS_LABELS = Object.fromEntries(
  SENSOR_STATUSES.map((status) => [status, SENSOR_STATUS_META[status]?.label || status])
);

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

export function getSensorStatusMeta(value) {
  const status = normalizeSensorStatus(value);
  return (
    SENSOR_STATUS_META[status] || {
      icon: '⚫',
      label: status || 'Unknown',
      badgeClass: 'badge-secondary',
      cardClass: 'sensor-card-status-unknown',
      statIconClass: 'sensor-status-stat-icon-unknown'
    }
  );
}

export function getSensorStatusIcon(value) {
  return getSensorStatusMeta(value).icon;
}

export function getSensorStatusLabel(value) {
  const status = normalizeSensorStatus(value);
  return SENSOR_STATUS_LABELS[status] || getSensorStatusMeta(value).label || '';
}

export function getSensorStatusDisplay(value) {
  const label = getSensorStatusLabel(value);
  if (!label) return '-';
  return `${getSensorStatusIcon(value)} ${label}`;
}

export function getSensorStatusBadgeClass(value) {
  return getSensorStatusMeta(value).badgeClass;
}

export function getSensorStatusCardClass(value) {
  return getSensorStatusMeta(value).cardClass;
}

export function getSensorStatusStatIconClass(value) {
  return getSensorStatusMeta(value).statIconClass;
}

export function getSensorStatusCounterText(value, count = 0) {
  const meta = getSensorStatusMeta(value);
  return `${Number(count || 0)} ${meta.icon} ${meta.label}`;
}
