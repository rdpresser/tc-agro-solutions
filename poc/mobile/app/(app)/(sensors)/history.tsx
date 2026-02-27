import React, { useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSensorReadings } from '@/hooks/queries/use-sensors';
import { useTheme } from '@/providers/theme-provider';
import { Card } from '@/components/ui/Card';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateTime, formatTemperature, formatPercentage } from '@/lib/format';
import type { SensorReading } from '@/types';

const CHART_COLORS = {
  temperature: '#E74C3C',
  humidity: '#3498DB',
  soilMoisture: '#27AE60',
};

const screenWidth = Dimensions.get('window').width;

export default function SensorHistoryScreen() {
  const { colors } = useTheme();
  const { id, label } = useLocalSearchParams<{ id: string; label: string }>();
  const { data: readings, isLoading, refetch, isRefetching } = useSensorReadings(id, 7);

  const chartData = useMemo(() => {
    if (!readings?.length) return null;

    const sorted = [...readings].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Sample down to ~30 points max for readability
    const step = Math.max(1, Math.floor(sorted.length / 30));
    const sampled = sorted.filter((_, i) => i % step === 0);

    return sampled;
  }, [readings]);

  const stats = useMemo(() => {
    if (!readings?.length) return null;
    const temps = readings.map((r) => r.temperature).filter(Boolean);
    const hums = readings.map((r) => r.humidity).filter(Boolean);
    const soils = readings.map((r) => r.soilMoisture).filter(Boolean);
    return {
      temp: { min: Math.min(...temps), max: Math.max(...temps), avg: temps.reduce((a, b) => a + b, 0) / temps.length },
      hum: { min: Math.min(...hums), max: Math.max(...hums), avg: hums.reduce((a, b) => a + b, 0) / hums.length },
      soil: { min: Math.min(...soils), max: Math.max(...soils), avg: soils.reduce((a, b) => a + b, 0) / soils.length },
    };
  }, [readings]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="px-4 pt-2 pb-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-bold" style={{ color: colors.text }}>Sensor History</Text>
          {label && (
            <Text className="text-sm" style={{ color: colors.textSecondary }}>{label} - Last 7 days</Text>
          )}
        </View>
      </View>

      {isLoading ? (
        <LoadingOverlay />
      ) : !chartData?.length ? (
        <EmptyState icon="analytics-outline" title="No Readings" message="No historical data for this sensor." />
      ) : (
        <ScrollView
          className="flex-1 px-4"
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor="#2d5016" />
          }
        >
          {/* Mini Chart (ASCII-style bar visualization) */}
          <Card className="mb-4">
            <Text className="font-semibold mb-3" style={{ color: colors.text }}>Temperature Trend</Text>
            <MiniBarChart
              data={chartData.map((r) => r.temperature)}
              color={CHART_COLORS.temperature}
              unit="°C"
              colors={colors}
            />
          </Card>

          <Card className="mb-4">
            <Text className="font-semibold mb-3" style={{ color: colors.text }}>Humidity Trend</Text>
            <MiniBarChart
              data={chartData.map((r) => r.humidity)}
              color={CHART_COLORS.humidity}
              unit="%"
              colors={colors}
            />
          </Card>

          <Card className="mb-4">
            <Text className="font-semibold mb-3" style={{ color: colors.text }}>Soil Moisture Trend</Text>
            <MiniBarChart
              data={chartData.map((r) => r.soilMoisture)}
              color={CHART_COLORS.soilMoisture}
              unit="%"
              colors={colors}
            />
          </Card>

          {/* Stats Summary */}
          {stats && (
            <Card className="mb-4">
              <Text className="font-semibold mb-3" style={{ color: colors.text }}>7-Day Summary</Text>

              <StatRow label="Temperature" color={CHART_COLORS.temperature} icon="thermometer-outline" colors={colors}>
                <Text className="text-xs" style={{ color: colors.textSecondary }}>
                  Min: {formatTemperature(stats.temp.min)} | Avg: {formatTemperature(stats.temp.avg)} | Max: {formatTemperature(stats.temp.max)}
                </Text>
              </StatRow>

              <StatRow label="Humidity" color={CHART_COLORS.humidity} icon="water-outline" colors={colors}>
                <Text className="text-xs" style={{ color: colors.textSecondary }}>
                  Min: {formatPercentage(stats.hum.min)} | Avg: {formatPercentage(stats.hum.avg)} | Max: {formatPercentage(stats.hum.max)}
                </Text>
              </StatRow>

              <StatRow label="Soil Moisture" color={CHART_COLORS.soilMoisture} icon="leaf-outline" colors={colors}>
                <Text className="text-xs" style={{ color: colors.textSecondary }}>
                  Min: {formatPercentage(stats.soil.min)} | Avg: {formatPercentage(stats.soil.avg)} | Max: {formatPercentage(stats.soil.max)}
                </Text>
              </StatRow>
            </Card>
          )}

          {/* Recent Readings Table */}
          <Card className="mb-6">
            <Text className="font-semibold mb-3" style={{ color: colors.text }}>
              Latest Readings ({readings?.length || 0} total)
            </Text>
            {readings?.slice(0, 10).map((r, i) => (
              <View
                key={r.id || i}
                className="flex-row items-center py-2"
                style={{ borderBottomWidth: 1, borderBottomColor: colors.borderLight }}
              >
                <Text className="text-xs flex-1" style={{ color: colors.textMuted }}>
                  {formatDateTime(r.timestamp)}
                </Text>
                <Text className="text-xs w-16 text-right" style={{ color: CHART_COLORS.temperature }}>
                  {formatTemperature(r.temperature)}
                </Text>
                <Text className="text-xs w-14 text-right" style={{ color: CHART_COLORS.humidity }}>
                  {formatPercentage(r.humidity)}
                </Text>
                <Text className="text-xs w-14 text-right" style={{ color: CHART_COLORS.soilMoisture }}>
                  {formatPercentage(r.soilMoisture)}
                </Text>
              </View>
            ))}
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function MiniBarChart({
  data,
  color,
  unit,
  colors,
}: {
  data: number[];
  color: string;
  unit: string;
  colors: { text: string; textMuted: string };
}) {
  if (!data.length) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const barWidth = Math.max(4, (screenWidth - 80) / data.length - 2);

  return (
    <View>
      <View className="flex-row items-end gap-0.5" style={{ height: 80 }}>
        {data.map((val, i) => {
          const height = Math.max(4, ((val - min) / range) * 70);
          return (
            <View
              key={i}
              style={{
                width: barWidth,
                height,
                backgroundColor: color,
                borderRadius: 2,
                opacity: 0.8,
              }}
            />
          );
        })}
      </View>
      <View className="flex-row justify-between mt-1">
        <Text className="text-xs" style={{ color: colors.textMuted }}>
          {min.toFixed(1)}{unit}
        </Text>
        <Text className="text-xs" style={{ color: colors.textMuted }}>
          {max.toFixed(1)}{unit}
        </Text>
      </View>
    </View>
  );
}

function StatRow({
  label,
  color,
  icon,
  children,
  colors,
}: {
  label: string;
  color: string;
  icon: string;
  children: React.ReactNode;
  colors: { text: string; textSecondary: string; borderLight: string };
}) {
  return (
    <View className="flex-row items-center gap-2 py-2" style={{ borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
      <Ionicons name={icon as any} size={16} color={color} />
      <View className="flex-1">
        <Text className="text-sm font-medium" style={{ color: colors.text }}>{label}</Text>
        {children}
      </View>
    </View>
  );
}
