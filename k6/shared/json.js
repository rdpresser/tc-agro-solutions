export function parseJsonSafely(response) {
  try {
    return JSON.parse(response?.body || "{}");
  } catch (_) {
    return {};
  }
}

export function pickField(source, fieldNames) {
  if (!source || typeof source !== "object") {
    return undefined;
  }

  for (const fieldName of fieldNames) {
    if (Object.prototype.hasOwnProperty.call(source, fieldName)) {
      return source[fieldName];
    }
  }

  const normalizedMap = Object.keys(source).reduce((acc, key) => {
    acc[key.toLowerCase()] = source[key];
    return acc;
  }, {});

  for (const fieldName of fieldNames) {
    const value = normalizedMap[fieldName.toLowerCase()];
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

export function requireField(source, fieldNames, errorMessage) {
  const value = pickField(source, fieldNames);
  if (value === undefined || value === null || value === "") {
    throw new Error(errorMessage);
  }

  return value;
}
