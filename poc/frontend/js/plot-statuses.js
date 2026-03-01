export const PLOT_STATUSES = ['healthy', 'warning', 'alert', 'critical'];

export const PLOT_STATUS_ICONS = {
  healthy: '✅',
  warning: '⚠️',
  alert: '🚨',
  critical: '🔴'
};

export const PLOT_STATUS_LABELS = {
  healthy: 'Healthy',
  warning: 'Warning',
  alert: 'Alert',
  critical: 'Critical'
};

export const PLOT_STATUS_BADGE_CLASSES = {
  healthy: 'badge-success',
  warning: 'badge-warning',
  alert: 'badge-danger',
  critical: 'badge-danger'
};

export const PLOT_SUMMARY_GROUPS = {
  healthy: {
    statuses: ['healthy'],
    label: 'Healthy',
    iconStatus: 'healthy'
  },
  warning: {
    statuses: ['warning'],
    label: 'Needs Attention',
    iconStatus: 'warning'
  },
  alert: {
    statuses: ['alert', 'critical'],
    label: 'Alert Active',
    iconStatus: 'alert'
  }
};

const PLOT_STATUS_ALIASES = {
  active: 'healthy',
  ok: 'healthy',
  normal: 'healthy',
  good: 'healthy',
  warning: 'warning',
  attention: 'warning',
  alert: 'alert',
  danger: 'alert',
  critical: 'critical',
  severe: 'critical'
};

export function normalizePlotStatus(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (!raw) return 'healthy';

  if (PLOT_STATUSES.includes(raw)) return raw;
  return PLOT_STATUS_ALIASES[raw] || 'healthy';
}

export function getPlotStatusIcon(value) {
  const status = normalizePlotStatus(value);
  return PLOT_STATUS_ICONS[status] || '';
}

export function getPlotStatusLabel(value) {
  const status = normalizePlotStatus(value);
  return PLOT_STATUS_LABELS[status] || status;
}

export function getPlotStatusBadgeClass(value) {
  const status = normalizePlotStatus(value);
  return PLOT_STATUS_BADGE_CLASSES[status] || 'badge-secondary';
}

export function getPlotStatusDisplay(value) {
  const status = normalizePlotStatus(value);
  return `${getPlotStatusIcon(status)} ${getPlotStatusLabel(status)}`.trim();
}

export function getPlotStatusFilterOptionsHtml(allLabel = 'All Status') {
  return [`<option value="">${allLabel}</option>`]
    .concat(
      PLOT_STATUSES.map((status) => {
        const icon = getPlotStatusIcon(status);
        const label = getPlotStatusLabel(status);
        return `<option value="${status}">${icon} ${label}</option>`;
      })
    )
    .join('');
}

export function getPlotSummaryCount(plots, groupKey) {
  const list = Array.isArray(plots) ? plots : [];
  const group = PLOT_SUMMARY_GROUPS[groupKey];
  if (!group) return 0;

  return list.filter((plot) => group.statuses.includes(normalizePlotStatus(plot?.status))).length;
}

export function getPlotSummaryBadgeText(groupKey, count) {
  const group = PLOT_SUMMARY_GROUPS[groupKey];
  if (!group) return `${count} ●`;

  const icon = getPlotStatusIcon(group.iconStatus);
  return `${count} ${icon} ${group.label}`;
}
