const PROPERTY_STATUS_META = {
  active: {
    label: 'Active',
    badgeClass: 'badge-success'
  },
  inactive: {
    label: 'Inactive',
    badgeClass: 'badge-secondary'
  }
};

const ACTIVE_ALIASES = new Set(['active', 'enabled', 'true', '1']);
const INACTIVE_ALIASES = new Set(['inactive', 'disabled', 'false', '0']);

function normalizeStatusKey(value) {
  if (typeof value === 'boolean') {
    return value ? 'active' : 'inactive';
  }

  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  if (ACTIVE_ALIASES.has(normalized)) {
    return 'active';
  }

  if (INACTIVE_ALIASES.has(normalized)) {
    return 'inactive';
  }

  return 'active';
}

export function normalizePropertyStatus(value) {
  return normalizeStatusKey(value);
}

export function getPropertyStatusLabel(value) {
  const status = normalizeStatusKey(value);
  return PROPERTY_STATUS_META[status]?.label || PROPERTY_STATUS_META.active.label;
}

export function getPropertyStatusBadgeClass(value) {
  const status = normalizeStatusKey(value);
  return PROPERTY_STATUS_META[status]?.badgeClass || PROPERTY_STATUS_META.active.badgeClass;
}
