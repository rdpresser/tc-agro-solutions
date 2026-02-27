import React, { forwardRef } from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';
import { useTheme } from '@/providers/theme-provider';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<TextInput, InputProps>(
  ({ label, error, leftIcon, rightIcon, ...props }, ref) => {
    const { colors } = useTheme();

    return (
      <View className="mb-4">
        {label && (
          <Text
            className="text-sm font-medium mb-1.5"
            style={{ color: colors.text }}
          >
            {label}
          </Text>
        )}
        <View
          className={`
            flex-row items-center rounded-lg border px-3
            ${error ? 'border-danger' : 'border-gray-300'}
          `}
          style={{ backgroundColor: colors.surface }}
        >
          {leftIcon && <View className="mr-2">{leftIcon}</View>}
          <TextInput
            ref={ref}
            className="flex-1 py-3 text-base"
            style={{ color: colors.text }}
            placeholderTextColor={colors.textMuted}
            {...props}
          />
          {rightIcon && <View className="ml-2">{rightIcon}</View>}
        </View>
        {error && (
          <Text className="text-danger text-xs mt-1">{error}</Text>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';
