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
