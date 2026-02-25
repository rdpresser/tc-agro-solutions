/**
 * Shared fallback polling utility for realtime pages.
 */

export function createFallbackPoller({
  refresh,
  intervalMs = 15000,
  onError = null,
  context = 'Realtime',
  connection = {}
}) {
  let timer = null;

  const runRefresh = async () => {
    try {
      await refresh();
    } catch (error) {
      if (onError) {
        onError(error);
      }
    }
  };

  const logDetails = {
    hub: connection.hub ?? '/dashboard/sensorshub',
    fallbackRoutes: connection.fallbackRoutes ?? []
  };

  return {
    start(reason = 'signalr-unavailable') {
      if (timer) {
        return;
      }

      console.warn(
        `[${context}] SignalR unavailable (${reason}). Switching to HTTP fallback polling (${intervalMs}ms).`,
        logDetails
      );

      runRefresh();
      timer = setInterval(runRefresh, intervalMs);
    },

    stop(reason = 'signalr-restored', options = {}) {
      if (!timer) {
        return;
      }

      clearInterval(timer);
      timer = null;

      if (options.silent) {
        return;
      }

      console.warn(
        `[${context}] SignalR reestablished (${reason}). Leaving HTTP fallback and resuming preferred SignalR stream.`,
        logDetails
      );
    },

    isRunning() {
      return timer !== null;
    }
  };
}
