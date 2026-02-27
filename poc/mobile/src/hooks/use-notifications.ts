import { useEffect, useRef } from 'react';
import { setupNotificationHandler, requestNotificationPermission } from '@/lib/notifications';
import { useRealtimeStore } from '@/stores/realtime.store';
import type { Alert } from '@/types';

export function useNotifications() {
  const recentAlerts = useRealtimeStore((s) => s.recentAlerts);
  const prevAlertsRef = useRef<Set<string>>(new Set());
  const newAlertsRef = useRef<Alert[]>([]);

  // Initialize notification handler once
  useEffect(() => {
    setupNotificationHandler();
    requestNotificationPermission();
  }, []);

  // Detect new alerts for toast display
  useEffect(() => {
    const prevIds = prevAlertsRef.current;
    const freshAlerts: Alert[] = [];

    for (const alert of recentAlerts) {
      if (!prevIds.has(alert.id)) {
        freshAlerts.push(alert);
      }
    }

    if (freshAlerts.length > 0) {
      newAlertsRef.current = freshAlerts;
    }

    prevAlertsRef.current = new Set(recentAlerts.map((a) => a.id));
  }, [recentAlerts]);

  return {
    latestNewAlert: newAlertsRef.current[0] ?? null,
    newAlerts: newAlertsRef.current,
  };
}
