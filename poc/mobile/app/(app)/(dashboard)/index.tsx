import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useDashboardStats, useLatestReadings, usePendingAlerts } from '@/hooks/queries/use-dashboard';
import { useRealtimeStore } from '@/stores/realtime.store';
import { useAuthStore } from '@/stores/auth.store';
import { useTheme } from '@/providers/theme-provider';
import { StatCard } from '@/components/dashboard/StatCard';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ConnectionBadge } from '@/components/dashboard/ConnectionBadge';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { formatRelativeTime, formatTemperature, formatPercentage, getTemperatureColor, getHumidityColor, getSoilMoistureColor } from '@/lib/format';
import type { SensorReading } from '@/types';

export default function DashboardScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { data: stats, isLoading: statsLoading, isRefetching } = useDashboardStats();
  const { data: readings } = useLatestReadings(10);
  const { data: pendingAlerts } = usePendingAlerts();
  const realtimeReadings = useRealtimeStore((s) => s.latestReadings);

  // Merge API readings with real-time updates
  const mergedReadings = useMemo(() => {
    const base = readings || [];
    const map = new Map<string, SensorReading>();
    base.forEach((r) => map.set(r.sensorId, r));
    realtimeReadings.forEach((r, key) => map.set(key, r));
    return Array.from(map.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  }, [readings, realtimeReadings]);

  // Compute avg metrics from readings
  const metrics = useMemo(() => {
    if (!mergedReadings.length) return { temp: 0, hum: 0, soil: 0, rain: 0 };
    const len = mergedReadings.length;
    return {
      temp: mergedReadings.reduce((s, r) => s + (r.temperature || 0), 0) / len,
      hum: mergedReadings.reduce((s, r) => s + (r.humidity || 0), 0) / len,
      soil: mergedReadings.reduce((s, r) => s + (r.soilMoisture || 0), 0) / len,
      rain: mergedReadings.reduce((s, r) => s + (r.rainfall || 0), 0) / len,
    };
  }, [mergedReadings]);

  const onRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['alerts', 'pending'] });
  };

  if (statsLoading) return <LoadingOverlay fullScreen />;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-6"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor="#2d5016" />
        }
      >
        {/* Header */}
        <View className="px-4 pt-2 pb-4 flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-2xl font-bold" style={{ color: colors.text }}>
              🌾 Dashboard
            </Text>
            <Text style={{ color: colors.textSecondary }}>
              Welcome, {user?.name || 'User'}
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            <ConnectionBadge />
            <TouchableOpacity onPress={() => router.push('/(app)/(settings)')}>
              <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Grid */}
        <View className="px-4 flex-row flex-wrap gap-3 mb-4">
          <StatCard
            title="Properties"
            value={stats?.propertiesCount ?? 0}
            icon="business-outline"
            color="#2d5016"
          />
          <StatCard
            title="Plots"
            value={stats?.plotsCount ?? 0}
            icon="grid-outline"
            color="#6b4423"
          />
          <StatCard
            title="Sensors"
            value={stats?.sensorsCount ?? 0}
            icon="hardware-chip-outline"
            color="#17a2b8"
          />
          <StatCard
            title="Active Alerts"
            value={stats?.alertsCount ?? 0}
            icon="warning-outline"
            color="#dc3545"
          />
        </View>

        {/* Metrics */}
        <View className="px-4 mb-4">
          <Text className="text-lg font-semibold mb-3" style={{ color: colors.text }}>
            Real-Time Metrics
          </Text>
          <View className="flex-row flex-wrap gap-3">
            <MetricCard
              title="Temperature"
              value={metrics.temp.toFixed(1)}
              unit="°C"
              icon="thermometer-outline"
              color="#E74C3C"
            />
            <MetricCard
              title="Humidity"
              value={metrics.hum.toFixed(0)}
              unit="%"
              icon="water-outline"
              color="#3498DB"
            />
            <MetricCard
              title="Soil Moisture"
              value={metrics.soil.toFixed(0)}
              unit="%"
              icon="leaf-outline"
              color="#27AE60"
            />
            <MetricCard
              title="Rainfall"
              value={metrics.rain.toFixed(1)}
              unit="mm"
              icon="rainy-outline"
              color="#9B59B6"
            />
          </View>
        </View>

        {/* Latest Readings Table */}
        <View className="px-4 mb-4">
          <Text className="text-lg font-semibold mb-3" style={{ color: colors.text }}>
            Latest Readings
          </Text>
          {mergedReadings.length === 0 ? (
            <Card>
              <Text className="text-center py-4" style={{ color: colors.textMuted }}>
                No readings available
              </Text>
            </Card>
          ) : (
            mergedReadings.slice(0, 5).map((reading, i) => (
              <Card key={reading.sensorId + i} className="mb-2">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="font-semibold" style={{ color: colors.text }}>
                    {reading.sensorLabel || reading.sensorId?.slice(0, 8)}
                  </Text>
                  <Text className="text-xs" style={{ color: colors.textMuted }}>
                    {formatRelativeTime(reading.timestamp)}
                  </Text>
                </View>
                <View className="flex-row gap-4">
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="thermometer-outline" size={14} color="#E74C3C" />
                    <Text style={{ color: getTemperatureColor(reading.temperature) }}>
                      {formatTemperature(reading.temperature)}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="water-outline" size={14} color="#3498DB" />
                    <Text style={{ color: getHumidityColor(reading.humidity) }}>
                      {formatPercentage(reading.humidity)}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="leaf-outline" size={14} color="#27AE60" />
                    <Text style={{ color: getSoilMoistureColor(reading.soilMoisture) }}>
                      {formatPercentage(reading.soilMoisture)}
                    </Text>
                  </View>
                </View>
                {reading.plotName && (
                  <Text className="text-xs mt-1" style={{ color: colors.textMuted }}>
                    {reading.plotName} {reading.propertyName ? `- ${reading.propertyName}` : ''}
                  </Text>
                )}
              </Card>
            ))
          )}
        </View>

        {/* Pending Alerts */}
        {(pendingAlerts?.length ?? 0) > 0 && (
          <View className="px-4">
            <Text className="text-lg font-semibold mb-3" style={{ color: colors.text }}>
              Pending Alerts
            </Text>
            {pendingAlerts!.slice(0, 3).map((alert) => (
              <Card key={alert.id} className="mb-2 border-l-4" style={{ borderLeftColor: alert.severity === 'critical' ? '#dc3545' : alert.severity === 'warning' ? '#ffc107' : '#17a2b8' }}>
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="font-semibold flex-1" style={{ color: colors.text }}>
                    {alert.title}
                  </Text>
                  <Badge
                    text={alert.severity}
                    variant={alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'info'}
                  />
                </View>
                <Text className="text-sm" style={{ color: colors.textSecondary }}>
                  {alert.message}
                </Text>
                <Text className="text-xs mt-1" style={{ color: colors.textMuted }}>
                  {formatRelativeTime(alert.createdAt)}
                </Text>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
