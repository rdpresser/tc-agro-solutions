export function extractApiErrorMessage(
  error: unknown,
  fallback: string,
): string {
  const apiData = (error as any)?.response?.data;
  const firstError = Array.isArray(apiData?.errors)
    ? apiData.errors[0]
    : Array.isArray(apiData?.Errors)
      ? apiData.Errors[0]
      : undefined;

  const message = firstError?.reason
    || firstError?.Reason
    || firstError?.message
    || firstError?.Message
    || apiData?.detail
    || apiData?.Detail
    || apiData?.message
    || apiData?.Message
    || apiData?.title
    || apiData?.Title
    || (typeof apiData === 'string' ? apiData : null)
    || (error as any)?.message;

  return typeof message === 'string' && message.trim().length > 0
    ? message
    : fallback;
}

export const OWNER_SCOPE_REQUIRED_CODE = 'OWNER_SCOPE_REQUIRED';

export function parseRealtimeErrorCode(error: unknown): string | null {
  const message =
    (error as any)?.message ||
    (typeof error === 'string' ? error : null);

  if (!message || typeof message !== 'string') {
    return null;
  }

  const separatorIndex = message.indexOf(':');
  const candidate = separatorIndex >= 0 ? message.slice(0, separatorIndex) : message;
  const code = candidate.trim().toUpperCase();
  return code.length > 0 ? code : null;
}

export function isOwnerScopeRequiredRealtimeError(error: unknown): boolean {
  return parseRealtimeErrorCode(error) === OWNER_SCOPE_REQUIRED_CODE;
}
