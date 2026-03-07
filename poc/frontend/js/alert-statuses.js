const ALERT_SEVERITY_META = {
  critical: {
    icon: '🚨',
    label: 'Critical',
    badgeClass: 'badge-danger',
    cardClass: 'alert-danger'
  },
  warning: {
    icon: '⚠️',
    label: 'Warning',
    badgeClass: 'badge-warning',
    cardClass: 'alert-warning'
  },
  info: {
    icon: 'ℹ️',
    label: 'Info',
    badgeClass: 'badge-info',
    cardClass: 'alert-info'
  }
};

const ALERT_SEVERITY_ALIASES = {
  critical: 'critical',
  high: 'critical',
  warning: 'warning',
  medium: 'warning',
  info: 'info',
  low: 'info'
};

const ALERT_STATUS_META = {
  pending: {
    label: 'Pending',
    badgeClass: 'badge-danger'
  },
  acknowledged: {
    label: 'Acknowledged',
    badgeClass: 'badge-warning'
  },
  resolved: {
    label: 'Resolved',
    badgeClass: 'badge-success'
  }
};

const ALERT_STATUS_ALIASES = {
  pending: 'pending',
  open: 'pending',
  acknowledged: 'acknowledged',
  ack: 'acknowledged',
  resolved: 'resolved',
  closed: 'resolved'
};

const ALERT_TAB_BADGE_CLASSES = {
  pending: 'badge-danger',
  resolved: 'badge-success',
  all: 'badge-info'
};

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function normalizeAlertSeverity(value) {
  const normalized = normalizeKey(value);
  return ALERT_SEVERITY_ALIASES[normalized] || 'info';
}

export function normalizeAlertSeverityFilter(value) {
  const normalized = normalizeKey(value);
  return ALERT_SEVERITY_ALIASES[normalized] || '';
}

export function getAlertSeverityIcon(value) {
  const severity = normalizeAlertSeverity(value);
  return ALERT_SEVERITY_META[severity]?.icon || ALERT_SEVERITY_META.info.icon;
}

export function getAlertSeverityLabel(value) {
  const severity = normalizeAlertSeverity(value);
  return ALERT_SEVERITY_META[severity]?.label || ALERT_SEVERITY_META.info.label;
}

export function getAlertSeverityBadgeClass(value) {
  const severity = normalizeAlertSeverity(value);
  return ALERT_SEVERITY_META[severity]?.badgeClass || ALERT_SEVERITY_META.info.badgeClass;
}

export function getAlertSeverityCardClass(value) {
  const severity = normalizeAlertSeverity(value);
  return ALERT_SEVERITY_META[severity]?.cardClass || ALERT_SEVERITY_META.info.cardClass;
}

export function normalizeAlertStatus(value) {
  const normalized = normalizeKey(value);
  return ALERT_STATUS_ALIASES[normalized] || 'pending';
}

export function normalizeAlertStatusFilter(value) {
  const normalized = normalizeKey(value);
  if (normalized === 'pending' || normalized === 'acknowledged' || normalized === 'resolved') {
    return normalized;
  }

  return '';
}

export function getAlertStatusLabel(value) {
  const status = normalizeAlertStatus(value);
  return ALERT_STATUS_META[status]?.label || ALERT_STATUS_META.pending.label;
}

export function getAlertStatusBadgeClass(value) {
  const status = normalizeAlertStatus(value);
  return ALERT_STATUS_META[status]?.badgeClass || ALERT_STATUS_META.pending.badgeClass;
}

export function getAlertTabBadgeClass(tab) {
  const normalizedTab = normalizeKey(tab);
  return ALERT_TAB_BADGE_CLASSES[normalizedTab] || ALERT_TAB_BADGE_CLASSES.all;
}
