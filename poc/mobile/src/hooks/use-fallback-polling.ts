import { useEffect, useRef } from 'react';
import { useConnectionStore } from '@/stores/connection.store';
import { useRealtimeStore } from '@/stores/realtime.store';
import { useAuthStore } from '@/stores/auth.store';
import { dashboardApi } from '@/api/dashboard.api';
import { alertsApi } from '@/api/alerts.api';
import { API_CONFIG } from '@/constants/api-config';
import { triggerAlertNotification } from '@/lib/notifications';
import { useOwnerScope } from '@/hooks/use-owner-scope';
import { useDashboardOwnerFilterStore } from '@/stores/dashboard-owner-filter.store';

export function useFallbackPolling() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const ownerScopeId = useOwnerScope();
  const selectedOwnerId = useDashboardOwnerFilterStore((s) => s.selectedOwnerId);
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const ownerId = isAdmin ? (selectedOwnerId || undefined) : ownerScopeId;
  const requiresOwnerSelection = isAdmin && !ownerId;
  const sensorHubState = useConnectionStore((s) => s.sensorHubState);
  const alertHubState = useConnectionStore((s) => s.alertHubState);
  const setFallbackActive = useConnectionStore((s) => s.setFallbackActive);
  const setReadings = useRealtimeStore((s) => s.setReadings);
  const addAlert = useRealtimeStore((s) => s.addAlert);
  const setAlerts = useRealtimeStore((s) => s.setAlerts);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const knownAlertIdsRef = useRef<Set<string> | null>(null); // null = first poll

  const needsFallback = sensorHubState !== 'connected' || alertHubState !== 'connected';

  useEffect(() => {
    if (!isAuthenticated || !needsFallback || requiresOwnerSelection) {
      setFallbackActive(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (requiresOwnerSelection) {
        knownAlertIdsRef.current = null;
      }
      return;
    }

    setFallbackActive(true);

    const poll = async () => {
      try {
        const ownerParam = ownerId ? { ownerId } : {};
        const [readings, alerts] = await Promise.all([
          dashboardApi.getLatestReadings(10, ownerId),
          alertsApi.getPending(ownerParam),
        ]);
        setReadings(readings);

        if (knownAlertIdsRef.current === null) {
          // First poll: seed known IDs, load into store, no notifications
          knownAlertIdsRef.current = new Set(alerts.map((a) => a.id));
          setAlerts(alerts);
        } else {
          // Subsequent polls: detect new, notify, and merge
          const newAlerts = alerts.filter((a) => !knownAlertIdsRef.current!.has(a.id));
          for (const alert of newAlerts) {
            triggerAlertNotification(alert);
            addAlert(alert);
          }
          knownAlertIdsRef.current = new Set(alerts.map((a) => a.id));
        }
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
  }, [isAuthenticated, needsFallback, ownerId, requiresOwnerSelection]);
}
