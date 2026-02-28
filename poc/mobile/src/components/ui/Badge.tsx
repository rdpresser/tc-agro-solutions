import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/providers/theme-provider';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'secondary' | 'primary';

interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

export function Badge({ text, variant = 'secondary', size = 'sm' }: BadgeProps) {
  const { colors, isDark } = useTheme();
  const sizeClass = size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  const variantPalette: Record<BadgeVariant, { bg: string; text: string }> = {
    success: { bg: colors.successBg, text: colors.statusSuccess },
    warning: { bg: colors.warningBg, text: isDark ? '#ffd24d' : '#946200' },
    danger: { bg: colors.dangerBg, text: colors.statusDanger },
    info: { bg: colors.infoBg, text: colors.statusInfo },
    secondary: { bg: isDark ? colors.border : '#e5e7eb', text: isDark ? colors.textSecondary : '#374151' },
    primary: { bg: `${colors.primary}20`, text: colors.primary },
  };

  const palette = variantPalette[variant];

  return (
    <View className={`${sizeClass} rounded-full self-start`} style={{ backgroundColor: palette.bg }}>
      <Text className={`${textSize} font-medium`} style={{ color: palette.text }}>{text}</Text>
    </View>
  );
}
