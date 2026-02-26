import { useEffect, useRef } from 'react';
import { useConnectionStore } from '@/stores/connection.store';
import { useRealtimeStore } from '@/stores/realtime.store';
import { useAuthStore } from '@/stores/auth.store';
import { dashboardApi } from '@/api/dashboard.api';
import { alertsApi } from '@/api/alerts.api';
import { API_CONFIG } from '@/constants/api-config';

export function useFallbackPolling() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const sensorHubState = useConnectionStore((s) => s.sensorHubState);
  const alertHubState = useConnectionStore((s) => s.alertHubState);
  const setFallbackActive = useConnectionStore((s) => s.setFallbackActive);
  const setReadings = useRealtimeStore((s) => s.setReadings);
  const setAlerts = useRealtimeStore((s) => s.setAlerts);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const needsFallback = sensorHubState !== 'connected' || alertHubState !== 'connected';

  useEffect(() => {
    if (!isAuthenticated || !needsFallback) {
      setFallbackActive(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    setFallbackActive(true);

    const poll = async () => {
      try {
        const [readings, alerts] = await Promise.all([
          dashboardApi.getLatestReadings(10),
          alertsApi.getPending(),
        ]);
        setReadings(readings);
        setAlerts(alerts);
      } catch {
        // silent fail
      }
    };

    poll();
    intervalRef.current = setInterval(poll, API_CONFIG.POLLING_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated, needsFallback]);
}
