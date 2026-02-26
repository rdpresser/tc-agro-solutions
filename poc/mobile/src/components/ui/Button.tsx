import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, { bg: string; text: string; border?: string }> = {
  primary: { bg: 'bg-primary', text: 'text-white' },
  secondary: { bg: 'bg-secondary', text: 'text-white' },
  outline: { bg: 'bg-transparent', text: 'text-primary', border: 'border border-primary' },
  danger: { bg: 'bg-danger', text: 'text-white' },
  ghost: { bg: 'bg-transparent', text: 'text-primary' },
};

const sizeStyles: Record<Size, { container: string; text: string }> = {
  sm: { container: 'px-3 py-1.5', text: 'text-sm' },
  md: { container: 'px-4 py-2.5', text: 'text-base' },
  lg: { container: 'px-6 py-3.5', text: 'text-lg' },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
}: ButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={`
        ${v.bg} ${v.border || ''} ${s.container}
        rounded-lg flex-row items-center justify-center
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? 'opacity-50' : ''}
      `}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? '#2d5016' : '#fff'} size="small" />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon}
          <Text className={`${v.text} ${s.text} font-semibold`}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
