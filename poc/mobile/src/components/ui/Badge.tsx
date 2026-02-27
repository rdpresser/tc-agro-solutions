import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/providers/theme-provider';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'secondary' | 'primary';

interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: 'bg-success/15', text: 'text-success' },
  warning: { bg: 'bg-warning/15', text: 'text-yellow-700' },
  danger: { bg: 'bg-danger/15', text: 'text-danger' },
  info: { bg: 'bg-info/15', text: 'text-info' },
  secondary: { bg: 'bg-gray-200', text: 'text-gray-700' },
  primary: { bg: 'bg-primary/15', text: 'text-primary' },
};

export function Badge({ text, variant = 'secondary', size = 'sm' }: BadgeProps) {
  const { colors, isDark } = useTheme();
  const v = variantColors[variant];
  const sizeClass = size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  if (variant === 'secondary') {
    return (
      <View
        className={`${sizeClass} rounded-full self-start`}
        style={{ backgroundColor: isDark ? colors.border : '#e5e7eb' }}
      >
        <Text className={`${textSize} font-medium`} style={{ color: isDark ? colors.textSecondary : '#374151' }}>
          {text}
        </Text>
      </View>
    );
  }

  return (
    <View className={`${v.bg} ${sizeClass} rounded-full self-start`}>
      <Text className={`${v.text} ${textSize} font-medium`}>{text}</Text>
    </View>
  );
}
