import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useTheme } from '@/providers/theme-provider';

interface LoadingOverlayProps {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingOverlay({ message = 'Loading...', fullScreen = false }: LoadingOverlayProps) {
  const { colors, isDark } = useTheme();

  if (fullScreen) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={isDark ? colors.primaryLight : colors.primary} />
        <Text className="mt-3 text-base" style={{ color: colors.textSecondary }}>{message}</Text>
      </View>
    );
  }

  return (
    <View className="items-center justify-center py-12">
      <ActivityIndicator size="large" color={isDark ? colors.primaryLight : colors.primary} />
      <Text className="mt-3 text-base" style={{ color: colors.textSecondary }}>{message}</Text>
    </View>
  );
}
