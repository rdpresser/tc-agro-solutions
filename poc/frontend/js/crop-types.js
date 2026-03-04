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

export const CROP_TYPE_PLANTING_WINDOWS = {
  Apple: 'Temperate climates: Jul-Sep',
  Banana: 'Tropical climates: year-round',
  Beans: 'Main season: Sep-Dec',
  Carrot: 'Mild season: Mar-Jun or Aug-Oct',
  Coffee: 'Rainy season start: Oct-Dec',
  Corn: 'Main season: Sep-Dec',
  Cotton: 'Warm season: Oct-Dec',
  Grape: 'Temperate climates: Jul-Sep',
  Lettuce: 'Mild season: Mar-Jun or Aug-Oct',
  Mango: 'Rainy season start: Oct-Dec',
  Onion: 'Mild season: Mar-Jun',
  Orange: 'Rainy season start: Sep-Nov',
  Pasture: 'Warm/rainy season: Oct-Jan',
  Potato: 'Mild season: Mar-Jun',
  Rice: 'Wet season: Oct-Jan',
  Soy: 'Main season: Oct-Dec',
  Sugarcane: 'Warm season: Sep-Dec',
  Tomato: 'Mild season: Mar-Jun or Aug-Oct',
  Wheat: 'Cool season: Apr-Jun',
  Other: 'Define according to local agronomic recommendation'
};

export const CROP_TYPE_PLANTING_MONTHS = {
  Apple: [7, 8, 9],
  Banana: [],
  Beans: [9, 10, 11, 12],
  Carrot: [3, 4, 5, 6, 8, 9, 10],
  Coffee: [10, 11, 12],
  Corn: [9, 10, 11, 12],
  Cotton: [10, 11, 12],
  Grape: [7, 8, 9],
  Lettuce: [3, 4, 5, 6, 8, 9, 10],
  Mango: [10, 11, 12],
  Onion: [3, 4, 5, 6],
  Orange: [9, 10, 11],
  Pasture: [10, 11, 12, 1],
  Potato: [3, 4, 5, 6],
  Rice: [10, 11, 12, 1],
  Soy: [10, 11, 12],
  Sugarcane: [9, 10, 11, 12],
  Tomato: [3, 4, 5, 6, 8, 9, 10],
  Wheat: [4, 5, 6],
  Other: []
};

export const CROP_TYPE_HARVEST_CYCLE_MONTHS = {
  Apple: 10,
  Banana: 12,
  Beans: 3,
  Carrot: 4,
  Coffee: 8,
  Corn: 5,
  Cotton: 6,
  Grape: 6,
  Lettuce: 2,
  Mango: 8,
  Onion: 4,
  Orange: 8,
  Pasture: 4,
  Potato: 4,
  Rice: 5,
  Soy: 5,
  Sugarcane: 12,
  Tomato: 4,
  Wheat: 5,
  Other: 6
};

export const CROP_TYPE_ALERT_THRESHOLDS = {
  Apple: { minSoilMoisture: 32, maxTemperature: 32, minHumidity: 45 },
  Banana: { minSoilMoisture: 45, maxTemperature: 34, minHumidity: 60 },
  Beans: { minSoilMoisture: 35, maxTemperature: 33, minHumidity: 50 },
  Carrot: { minSoilMoisture: 38, maxTemperature: 30, minHumidity: 55 },
  Coffee: { minSoilMoisture: 40, maxTemperature: 30, minHumidity: 60 },
  Corn: { minSoilMoisture: 30, maxTemperature: 35, minHumidity: 45 },
  Cotton: { minSoilMoisture: 28, maxTemperature: 38, minHumidity: 40 },
  Grape: { minSoilMoisture: 30, maxTemperature: 34, minHumidity: 45 },
  Lettuce: { minSoilMoisture: 45, maxTemperature: 28, minHumidity: 65 },
  Mango: { minSoilMoisture: 35, maxTemperature: 36, minHumidity: 55 },
  Onion: { minSoilMoisture: 35, maxTemperature: 30, minHumidity: 50 },
  Orange: { minSoilMoisture: 38, maxTemperature: 34, minHumidity: 55 },
  Pasture: { minSoilMoisture: 25, maxTemperature: 37, minHumidity: 40 },
  Potato: { minSoilMoisture: 40, maxTemperature: 28, minHumidity: 60 },
  Rice: { minSoilMoisture: 50, maxTemperature: 34, minHumidity: 70 },
  Soy: { minSoilMoisture: 32, maxTemperature: 35, minHumidity: 45 },
  Sugarcane: { minSoilMoisture: 35, maxTemperature: 37, minHumidity: 50 },
  Tomato: { minSoilMoisture: 40, maxTemperature: 32, minHumidity: 60 },
  Wheat: { minSoilMoisture: 25, maxTemperature: 30, minHumidity: 40 },
  Other: { minSoilMoisture: 30, maxTemperature: 35, minHumidity: 40 }
};

export const CROP_TYPE_SUGGESTED_IRRIGATION = {
  Apple: 'Drip Irrigation',
  Banana: 'Drip Irrigation',
  Beans: 'Sprinkler',
  Carrot: 'Drip Irrigation',
  Coffee: 'Drip Irrigation',
  Corn: 'Center Pivot',
  Cotton: 'Center Pivot',
  Grape: 'Drip Irrigation',
  Lettuce: 'Drip Irrigation',
  Mango: 'Drip Irrigation',
  Onion: 'Drip Irrigation',
  Orange: 'Drip Irrigation',
  Pasture: 'Sprinkler',
  Potato: 'Sprinkler',
  Rice: 'Flood/Furrow',
  Soy: 'Center Pivot',
  Sugarcane: 'Flood/Furrow',
  Tomato: 'Drip Irrigation',
  Wheat: 'Rainfed (No Irrigation)',
  Other: 'Other'
};

export function normalizeCropType(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const normalized = raw.toLowerCase();
  const matched = COMMON_CROP_TYPES.find((item) => item.toLowerCase() === normalized);
  return matched || raw;
}

export function getCropPlantingWindow(value) {
  const normalized = normalizeCropType(value);
  if (!normalized) return '';
  return CROP_TYPE_PLANTING_WINDOWS[normalized] || CROP_TYPE_PLANTING_WINDOWS.Other;
}

export function getSuggestedFuturePlantingDate(value, referenceDate = new Date()) {
  const normalized = normalizeCropType(value);
  if (!normalized) return '';

  const months = CROP_TYPE_PLANTING_MONTHS[normalized] || [];
  if (!Array.isArray(months) || months.length === 0) {
    return '';
  }

  const now = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const nextCandidates = months
    .map((month) => {
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        return null;
      }

      const targetYear = month > currentMonth ? currentYear : currentYear + 1;
      return new Date(targetYear, month - 1, 1);
    })
    .filter(Boolean)
    .sort((left, right) => left.getTime() - right.getTime());

  if (nextCandidates.length === 0) {
    return '';
  }

  return toDateInputValue(nextCandidates[0]);
}

export function getSuggestedExpectedHarvestDate(value, plantingDateInputValue, referenceDate = new Date()) {
  const normalized = normalizeCropType(value);
  if (!normalized) return '';

  const harvestCycleMonths =
    CROP_TYPE_HARVEST_CYCLE_MONTHS[normalized] ?? CROP_TYPE_HARVEST_CYCLE_MONTHS.Other;

  const baseDate = resolveBaseDate(plantingDateInputValue, referenceDate);
  if (!baseDate) {
    return '';
  }

  const expectedHarvestDate = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth() + harvestCycleMonths,
    baseDate.getDate()
  );

  return toDateInputValue(expectedHarvestDate);
}

export function getCropAlertThresholds(value) {
  const defaults = CROP_TYPE_ALERT_THRESHOLDS.Other;
  const normalized = normalizeCropType(value);

  if (!normalized) {
    return { ...defaults };
  }

  return {
    ...defaults,
    ...(CROP_TYPE_ALERT_THRESHOLDS[normalized] || {})
  };
}

export function getSuggestedIrrigationType(value) {
  const normalized = normalizeCropType(value);
  if (!normalized) return '';

  return CROP_TYPE_SUGGESTED_IRRIGATION[normalized] || CROP_TYPE_SUGGESTED_IRRIGATION.Other;
}

export const CROP_TYPE_DEFAULTS_TABLE = COMMON_CROP_TYPES.map((cropType) => {
  const thresholds = getCropAlertThresholds(cropType);

  return {
    cropType,
    plantingWindow: getCropPlantingWindow(cropType),
    plantingMonths: [...(CROP_TYPE_PLANTING_MONTHS[cropType] || [])],
    harvestCycleMonths:
      CROP_TYPE_HARVEST_CYCLE_MONTHS[cropType] ?? CROP_TYPE_HARVEST_CYCLE_MONTHS.Other,
    suggestedIrrigationType: getSuggestedIrrigationType(cropType),
    minSoilMoisture: thresholds.minSoilMoisture,
    maxTemperature: thresholds.maxTemperature,
    minHumidity: thresholds.minHumidity
  };
});

function resolveBaseDate(plantingDateInputValue, referenceDate) {
  const plantingDate = String(plantingDateInputValue || '').trim();

  if (plantingDate) {
    const parsedDate = new Date(`${plantingDate}T00:00:00`);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  const now = new Date(referenceDate);
  if (Number.isNaN(now.getTime())) {
    return null;
  }

  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
