import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '@/providers/theme-provider';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterChipsProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

export function FilterChips({ options, value, onChange }: FilterChipsProps) {
  const { colors } = useTheme();

  return (
    <View className="px-4 mb-3">
      <View className="flex-row gap-2 flex-wrap">
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-full ${
              value === opt.value ? '' : 'border'
            }`}
            style={value === opt.value
              ? { backgroundColor: colors.primary }
              : { backgroundColor: colors.chipBg, borderColor: colors.border }
            }
          >
            <Text
              className={`text-sm font-medium ${
                value === opt.value ? 'text-white' : ''
              }`}
              style={value !== opt.value ? { color: colors.textSecondary } : undefined}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
