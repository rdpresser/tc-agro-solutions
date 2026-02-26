import { useEffect, useRef, useCallback } from 'react';
import { HubConnectionBuilder, HubConnection, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { useAuthStore } from '@/stores/auth.store';
import { useConnectionStore } from '@/stores/connection.store';
import { useRealtimeStore } from '@/stores/realtime.store';
import { API_CONFIG } from '@/constants/api-config';
import type { SensorReading, Alert, ConnectionState } from '@/types';

export function useSignalR() {
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setSensorHubState = useConnectionStore((s) => s.setSensorHubState);
  const setAlertHubState = useConnectionStore((s) => s.setAlertHubState);
  const updateReading = useRealtimeStore((s) => s.updateReading);
  const addAlert = useRealtimeStore((s) => s.addAlert);
  const updateAlert = useRealtimeStore((s) => s.updateAlert);

  const sensorHubRef = useRef<HubConnection | null>(null);
  const alertHubRef = useRef<HubConnection | null>(null);

  const mapState = (state: HubConnectionState): ConnectionState => {
    switch (state) {
      case HubConnectionState.Connected: return 'connected';
      case HubConnectionState.Reconnecting: return 'reconnecting';
      default: return 'disconnected';
    }
  };

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

  useEffect(() => {
    if (!isAuthenticated || !token || !API_CONFIG.SIGNALR_ENABLED) return;

    // Sensor hub
    const sensorHub = buildHub('/dashboard/sensorshub', setSensorHubState);
    sensorHub.on('sensorReading', (data: SensorReading) => {
      updateReading(data);
    });
    sensorHub.on('sensorStatusChanged', () => {});
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
    alertHub.onreconnected(() => setAlertHubState('connected'));
    alertHub.onclose(() => setAlertHubState('disconnected'));

    alertHub.on('alertCreated', (data: Alert) => addAlert(data));
    alertHub.on('alertAcknowledged', (data: Alert) => updateAlert(data));
    alertHub.on('alertResolved', (data: Alert) => updateAlert(data));
    alertHubRef.current = alertHub;

    // Start both
    sensorHub.start()
      .then(() => setSensorHubState('connected'))
      .catch(() => setSensorHubState('disconnected'));

    alertHub.start()
      .then(() => setAlertHubState('connected'))
      .catch(() => setAlertHubState('disconnected'));

    return () => {
      sensorHub.stop();
      alertHub.stop();
      setSensorHubState('disconnected');
      setAlertHubState('disconnected');
    };
  }, [isAuthenticated, token]);

  return { sensorHub: sensorHubRef, alertHub: alertHubRef };
}
