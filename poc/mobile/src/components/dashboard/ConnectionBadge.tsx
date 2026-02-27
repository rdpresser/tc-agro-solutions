import React from 'react';
import { View, Text } from 'react-native';
import { useConnectionStore } from '@/stores/connection.store';

export function ConnectionBadge() {
  const sensorState = useConnectionStore((s) => s.sensorHubState);
  const alertState = useConnectionStore((s) => s.alertHubState);
  const isFallback = useConnectionStore((s) => s.isFallbackActive);

  const isConnected = sensorState === 'connected' && alertState === 'connected';
  const isReconnecting = sensorState === 'reconnecting' || alertState === 'reconnecting';

  let color = '#dc3545';
  let label = 'Offline';

  if (isConnected) {
    color = '#28a745';
    label = 'Live';
  } else if (isReconnecting) {
    color = '#ffc107';
    label = 'Reconnecting';
  } else if (isFallback) {
    color = '#fd7e14';
    label = 'Fallback';
  }

  return (
    <View className="flex-row items-center gap-1.5 px-2 py-1 rounded-full bg-black/5">
      <View className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <Text className="text-xs font-medium" style={{ color }}>{label}</Text>
    </View>
  );
}
