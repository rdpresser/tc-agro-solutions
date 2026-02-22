export const COMMON_CROP_TYPES = [
  'Apple',
  'Banana',
  'Beans',
  'Carrot',
  'Coffee',
  'Corn',
  'Cotton',
  'Grape',
  'Lettuce',
  'Mango',
  'Onion',
  'Orange',
  'Pasture',
  'Potato',
  'Rice',
  'Soy',
  'Sugarcane',
  'Tomato',
  'Wheat',
  'Other'
];

export const CROP_TYPE_ICONS = {
  Apple: '🍎',
  Banana: '🍌',
  Beans: '🫘',
  Carrot: '🥕',
  Coffee: '☕',
  Corn: '🌽',
  Cotton: '🌸',
  Grape: '🍇',
  Lettuce: '🥬',
  Mango: '🥭',
  Onion: '🧅',
  Orange: '🍊',
  Pasture: '🌱',
  Potato: '🥔',
  Rice: '🍚',
  Soy: '🌿',
  Sugarcane: '🎋',
  Tomato: '🍅',
  Wheat: '🌾',
  Other: '📦'
};

export function normalizeCropType(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const normalized = raw.toLowerCase();
  const matched = COMMON_CROP_TYPES.find((item) => item.toLowerCase() === normalized);
  return matched || raw;
}
