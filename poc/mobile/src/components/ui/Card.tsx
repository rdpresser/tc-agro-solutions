import React from 'react';
import { View, ViewProps } from 'react-native';
import { useTheme } from '@/providers/theme-provider';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '', ...props }: CardProps) {
  const { colors } = useTheme();

  return (
    <View
      className={`rounded-xl p-4 shadow-sm ${className}`}
      style={{ backgroundColor: colors.card }}
      {...props}
    >
      {children}
    </View>
  );
}
