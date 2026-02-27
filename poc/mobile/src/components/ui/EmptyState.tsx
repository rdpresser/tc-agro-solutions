import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/theme-provider';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
}

export function EmptyState({ icon = 'file-tray-outline', title, message }: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View className="items-center justify-center py-16 px-8">
      <Ionicons name={icon} size={64} color={colors.textMuted} />
      <Text className="text-lg font-semibold mt-4" style={{ color: colors.text }}>
        {title}
      </Text>
      {message && (
        <Text className="text-center mt-2" style={{ color: colors.textSecondary }}>
          {message}
        </Text>
      )}
    </View>
  );
}
