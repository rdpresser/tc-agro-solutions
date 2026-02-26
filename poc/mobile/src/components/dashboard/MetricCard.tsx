import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';

interface MetricCardProps {
  title: string;
  value: string;
  unit: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  trend?: 'up' | 'down' | 'stable';
}

export function MetricCard({ title, value, unit, icon, color, trend }: MetricCardProps) {
  const trendIcon = trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove';
  const trendColor = trend === 'up' ? '#28a745' : trend === 'down' ? '#dc3545' : '#666';

  return (
    <Card className="flex-1 min-w-[45%]">
      <View className="flex-row items-center gap-2 mb-2">
        <Ionicons name={icon} size={16} color={color} />
        <Text className="text-xs text-gray-500">{title}</Text>
      </View>
      <View className="flex-row items-baseline gap-1">
        <Text className="text-xl font-bold" style={{ color }}>{value}</Text>
        <Text className="text-xs text-gray-400">{unit}</Text>
      </View>
      {trend && (
        <View className="flex-row items-center mt-1">
          <Ionicons name={trendIcon} size={14} color={trendColor} />
        </View>
      )}
    </Card>
  );
}
