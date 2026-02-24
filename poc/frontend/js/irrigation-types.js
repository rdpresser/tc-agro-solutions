export const IRRIGATION_TYPES = [
  'Drip Irrigation',
  'Sprinkler',
  'Center Pivot',
  'Flood/Furrow',
  'Rainfed (No Irrigation)',
  'Other'
];

export const IRRIGATION_TYPE_ICONS = {
  'Drip Irrigation': '💧',
  Sprinkler: '🚿',
  'Center Pivot': '🔄',
  'Flood/Furrow': '🌊',
  'Rainfed (No Irrigation)': '🌧️',
  Other: '⚙️'
};

export const IRRIGATION_TYPE_LABELS = {
  'Drip Irrigation': 'Drip Irrigation',
  Sprinkler: 'Sprinkler',
  'Center Pivot': 'Center Pivot',
  'Flood/Furrow': 'Flood/Furrow',
  'Rainfed (No Irrigation)': 'Rainfed (No Irrigation)',
  Other: 'Other'
};

const IRRIGATION_TYPE_ALIASES = {
  drip: 'Drip Irrigation',
  'drip irrigation': 'Drip Irrigation',
  sprinkler: 'Sprinkler',
  pivot: 'Center Pivot',
  'center pivot': 'Center Pivot',
  flood: 'Flood/Furrow',
  furrow: 'Flood/Furrow',
  'flood/furrow': 'Flood/Furrow',
  rainfed: 'Rainfed (No Irrigation)',
  'rainfed (no irrigation)': 'Rainfed (No Irrigation)',
  'no irrigation': 'Rainfed (No Irrigation)',
  other: 'Other'
};

export function normalizeIrrigationType(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const normalized = raw.toLowerCase();
  const matchedFromList = IRRIGATION_TYPES.find((item) => item.toLowerCase() === normalized);
  if (matchedFromList) return matchedFromList;

  return IRRIGATION_TYPE_ALIASES[normalized] || raw;
}

export function getIrrigationTypeIcon(value) {
  const type = normalizeIrrigationType(value);
  return IRRIGATION_TYPE_ICONS[type] || '💦';
}

export function getIrrigationTypeLabel(value) {
  const type = normalizeIrrigationType(value);
  return IRRIGATION_TYPE_LABELS[type] || type || '';
}

export function getIrrigationTypeDisplay(value) {
  const label = getIrrigationTypeLabel(value);
  if (!label) return '-';
  return `${getIrrigationTypeIcon(value)} ${label}`;
}
