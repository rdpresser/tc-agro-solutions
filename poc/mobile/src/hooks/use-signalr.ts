import { useEffect, useRef, useCallback } from 'react';
import { HubConnectionBuilder, HubConnection, LogLevel } from '@microsoft/signalr';
import { useAuthStore } from '@/stores/auth.store';
import { useConnectionStore } from '@/stores/connection.store';
import { useRealtimeStore } from '@/stores/realtime.store';
import { useDashboardOwnerFilterStore } from '@/stores/dashboard-owner-filter.store';
import { API_CONFIG } from '@/constants/api-config';
import { triggerAlertNotification } from '@/lib/notifications';
import { isOwnerScopeRequiredRealtimeError } from '@/lib/api-error';
import type { SensorReading, Alert, ConnectionState } from '@/types';

export function useSignalR() {
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const selectedOwnerId = useDashboardOwnerFilterStore((s) => s.selectedOwnerId);
  const setSensorHubState = useConnectionStore((s) => s.setSensorHubState);
  const setAlertHubState = useConnectionStore((s) => s.setAlertHubState);
  const updateReading = useRealtimeStore((s) => s.updateReading);
  const addAlert = useRealtimeStore((s) => s.addAlert);
  const updateAlert = useRealtimeStore((s) => s.updateAlert);

  const sensorHubRef = useRef<HubConnection | null>(null);
  const alertHubRef = useRef<HubConnection | null>(null);
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const ownerScopeId = isAdmin ? (selectedOwnerId || undefined) : (user?.id || undefined);
  const requiresOwnerSelection = isAdmin && !ownerScopeId;

  const buildHub = useCallback((path: string, onStateChange: (s: ConnectionState) => void) => {
    const url = `${API_CONFIG.SENSOR_BASE_URL}${path}`;
    const connection = new HubConnectionBuilder()
      .withUrl(url, {
        accessTokenFactory: () => token || '',
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();

    connection.onreconnecting(() => onStateChange('reconnecting'));
    connection.onreconnected(() => onStateChange('connected'));
    connection.onclose(() => onStateChange('disconnected'));

    return connection;
  }, [token]);

  const isExpectedStopError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error || '');
    const lower = message.toLowerCase();
    return lower.includes('stopped during negotiation') || lower.includes('stop() was called');
  };

  useEffect(() => {
    if (requiresOwnerSelection) {
      setSensorHubState('disconnected');
      setAlertHubState('disconnected');
      return;
    }

    if (!isAuthenticated || !token || !API_CONFIG.SIGNALR_ENABLED) return;
    let disposed = false;

    // Sensor hub
    const sensorHub = buildHub('/dashboard/sensorshub', setSensorHubState);
    sensorHub.on('sensorReading', (data: SensorReading) => {
      updateReading(data);
    });
    sensorHub.on('sensorStatusChanged', () => {});
    sensorHub.onreconnected(async () => {
      setSensorHubState('connected');
      if (!ownerScopeId) return;
      try {
        await sensorHub.invoke('JoinOwnerGroup', ownerScopeId);
      } catch (error) {
        if (isOwnerScopeRequiredRealtimeError(error)) {
          setSensorHubState('disconnected');
          return;
        }
        // Keep connection alive; fallback polling may still serve data.
      }
    });
    sensorHubRef.current = sensorHub;

    // Alert hub
    const alertUrl = `${API_CONFIG.ANALYTICS_BASE_URL}/dashboard/alertshub`;
    const alertHub = new HubConnectionBuilder()
      .withUrl(alertUrl, {
        accessTokenFactory: () => token || '',
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();

    alertHub.onreconnecting(() => setAlertHubState('reconnecting'));
    alertHub.onreconnected(async () => {
      setAlertHubState('connected');
      if (!ownerScopeId) return;
      try {
        await alertHub.invoke('JoinOwnerGroup', ownerScopeId);
      } catch (error) {
        if (isOwnerScopeRequiredRealtimeError(error)) {
          setAlertHubState('disconnected');
          return;
        }
        // Keep connection alive; fallback polling may still serve data.
      }
    });
    alertHub.onclose(() => setAlertHubState('disconnected'));

    alertHub.on('alertCreated', (data: Alert) => {
      addAlert(data);
      triggerAlertNotification(data);
    });
    alertHub.on('alertAcknowledged', (data: Alert) => updateAlert(data));
    alertHub.on('alertResolved', (data: Alert) => updateAlert(data));
    alertHubRef.current = alertHub;

    // Start both and join owner scope to receive real-time group broadcasts.
    const startConnections = async () => {
      try {
        await sensorHub.start();
        if (!disposed) {
          setSensorHubState('connected');
          if (!ownerScopeId) return;
          try {
            await sensorHub.invoke('JoinOwnerGroup', ownerScopeId);
          } catch (error) {
            if (isOwnerScopeRequiredRealtimeError(error)) {
              setSensorHubState('disconnected');
              return;
            }
            // Keep connection alive; fallback polling may still serve data.
          }
        }
      } catch (error) {
        if (!disposed && !isExpectedStopError(error)) {
          setSensorHubState('disconnected');
        }
      }

      try {
        await alertHub.start();
        if (!disposed) {
          setAlertHubState('connected');
          if (!ownerScopeId) return;
          try {
            await alertHub.invoke('JoinOwnerGroup', ownerScopeId);
          } catch (error) {
            if (isOwnerScopeRequiredRealtimeError(error)) {
              setAlertHubState('disconnected');
              return;
            }
            // Keep connection alive; fallback polling may still serve data.
          }
        }
      } catch (error) {
        if (!disposed && !isExpectedStopError(error)) {
          setAlertHubState('disconnected');
        }
      }
    };

    void startConnections();

    return () => {
      disposed = true;
      void sensorHub.stop();
      void alertHub.stop();
      setSensorHubState('disconnected');
      setAlertHubState('disconnected');
    };
  }, [isAuthenticated, token, ownerScopeId, requiresOwnerSelection]);

  return { sensorHub: sensorHubRef, alertHub: alertHubRef };
}
