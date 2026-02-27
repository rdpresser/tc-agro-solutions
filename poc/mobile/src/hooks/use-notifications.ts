import { useEffect, useRef, useState, useCallback } from 'react';
import { setupNotificationHandler, requestNotificationPermission } from '@/lib/notifications';
import { useRealtimeStore } from '@/stores/realtime.store';
import type { Alert } from '@/types';

export function useNotifications() {
  const recentAlerts = useRealtimeStore((s) => s.recentAlerts);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const [latestNewAlert, setLatestNewAlert] = useState<Alert | null>(null);

  // Initialize notification handler once
  useEffect(() => {
    setupNotificationHandler();
    requestNotificationPermission();
  }, []);

  // Detect genuinely new alerts (skip the initial load)
  useEffect(() => {
    if (!initializedRef.current) {
      // First run: seed known IDs from whatever is already loaded — don't toast
      initializedRef.current = true;
      seenIdsRef.current = new Set(recentAlerts.map((a) => a.id));
      return;
    }

    for (const alert of recentAlerts) {
      if (!seenIdsRef.current.has(alert.id)) {
        seenIdsRef.current.add(alert.id);
        setLatestNewAlert(alert);
        break; // show one at a time
      }
    }
  }, [recentAlerts]);

  const dismiss = useCallback(() => setLatestNewAlert(null), []);

  return { latestNewAlert, dismiss };
}
