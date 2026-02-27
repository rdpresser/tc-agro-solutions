import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/providers/theme-provider';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export function StatCard({ title, value, icon, color }: StatCardProps) {
  const { colors } = useTheme();

  return (
    <Card className="flex-1 min-w-[45%]">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-xs uppercase tracking-wider" style={{ color: colors.textSecondary }}>{title}</Text>
          <Text className="text-2xl font-bold mt-1" style={{ color }}>
            {value}
          </Text>
        </View>
        <View
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: `${color}20` }}
        >
          <Ionicons name={icon} size={20} color={color} />
        </View>
      </View>
    </Card>
  );
}
