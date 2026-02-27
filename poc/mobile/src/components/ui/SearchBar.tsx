import React from 'react';
import { View, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/theme-provider';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, placeholder = 'Search...' }: SearchBarProps) {
  const { colors } = useTheme();

  return (
    <View
      className="flex-row items-center rounded-lg px-3 mb-3"
      style={{ backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border }}
    >
      <Ionicons name="search" size={20} color={colors.textMuted} />
      <TextInput
        className="flex-1 py-2.5 ml-2 text-base"
        style={{ color: colors.text }}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}
