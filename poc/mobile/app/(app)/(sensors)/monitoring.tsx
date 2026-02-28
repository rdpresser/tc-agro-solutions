import React, { useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLatestReadings } from '@/hooks/queries/use-dashboard';
import { useRealtimeStore } from '@/stores/realtime.store';
import { useTheme } from '@/providers/theme-provider';
import { ConnectionBadge } from '@/components/dashboard/ConnectionBadge';
import { Card } from '@/components/ui/Card';
import { formatRelativeTime, formatTemperature, formatPercentage, getTemperatureColor, getHumidityColor, getSoilMoistureColor } from '@/lib/format';
import type { SensorReading } from '@/types';

export default function MonitoringScreen() {
  const { colors } = useTheme();
  const { data: apiReadings, refetch, isRefetching } = useLatestReadings(20);
  const realtimeReadings = useRealtimeStore((s) => s.latestReadings);

  const readings = useMemo(() => {
    const map = new Map<string, SensorReading>();
    (apiReadings || []).forEach((r) => map.set(r.sensorId, r));
    realtimeReadings.forEach((r, key) => map.set(key, r));
    return Array.from(map.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [apiReadings, realtimeReadings]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="px-4 pt-2 pb-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-xl font-bold" style={{ color: colors.text }}>Live Monitoring</Text>
        </View>
        <ConnectionBadge />
      </View>

      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />
        }
      >
        {readings.length === 0 ? (
          <View className="items-center justify-center py-20">
            <Ionicons name="pulse-outline" size={64} color={colors.textMuted} />
            <Text className="text-lg font-semibold mt-4" style={{ color: colors.text }}>
              No Live Data
            </Text>
            <Text style={{ color: colors.textSecondary }}>Waiting for sensor readings...</Text>
          </View>
        ) : (
          <View className="flex-row flex-wrap gap-3 pb-6">
            {readings.map((reading) => (
              <View key={reading.sensorId} className="w-[48%]">
                <Card>
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-sm font-semibold flex-1" numberOfLines={1} style={{ color: colors.text }}>
                      {reading.sensorLabel || reading.sensorId?.slice(0, 8)}
                    </Text>
                    <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.statusSuccess }} />
                  </View>

                  <View className="gap-1.5">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-1">
                        <Ionicons name="thermometer-outline" size={12} color={colors.statusDanger} />
                        <Text className="text-xs" style={{ color: colors.textMuted }}>Temp</Text>
                      </View>
                      <Text className="text-sm font-bold" style={{ color: getTemperatureColor(reading.temperature) }}>
                        {formatTemperature(reading.temperature)}
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-1">
                        <Ionicons name="water-outline" size={12} color={colors.statusInfo} />
                        <Text className="text-xs" style={{ color: colors.textMuted }}>Hum</Text>
                      </View>
                      <Text className="text-sm font-bold" style={{ color: getHumidityColor(reading.humidity) }}>
                        {formatPercentage(reading.humidity)}
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-1">
                        <Ionicons name="leaf-outline" size={12} color={colors.statusSuccess} />
                        <Text className="text-xs" style={{ color: colors.textMuted }}>Soil</Text>
                      </View>
                      <Text className="text-sm font-bold" style={{ color: getSoilMoistureColor(reading.soilMoisture) }}>
                        {formatPercentage(reading.soilMoisture)}
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-1">
                        <Ionicons name="rainy-outline" size={12} color={colors.textSecondary} />
                        <Text className="text-xs" style={{ color: colors.textMuted }}>Rain</Text>
                      </View>
                      <Text className="text-sm font-bold" style={{ color: colors.textSecondary }}>
                        {reading.rainfall?.toFixed(1)} mm
                      </Text>
                    </View>
                  </View>

                  <Text className="text-xs mt-2 text-center" style={{ color: colors.textMuted }}>
                    {formatRelativeTime(reading.timestamp)}
                  </Text>
                  {reading.plotName && (
                    <Text className="text-xs text-center" numberOfLines={1} style={{ color: colors.textMuted }}>
                      {reading.plotName}
                    </Text>
                  )}
                </Card>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
