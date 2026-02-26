function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toPascalCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function normalizeKeys<T>(obj: unknown, converter: (key: string) => string): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => normalizeKeys(item, converter)) as T;
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>).reduce((acc, [key, value]) => {
      acc[converter(key)] = normalizeKeys(value, converter);
      return acc;
    }, {} as Record<string, unknown>) as T;
  }
  return obj as T;
}

export function camelizeResponse<T>(data: unknown): T {
  return normalizeKeys<T>(data, toCamelCase);
}

export function pascalizeRequest<T>(data: unknown): T {
  return normalizeKeys<T>(data, toPascalCase);
}
