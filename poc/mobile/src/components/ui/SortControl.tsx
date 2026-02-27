import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/theme-provider';

export interface SortOption {
  value: string;
  label: string;
}

interface SortControlProps {
  options: SortOption[];
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  onSortChange: (sortBy: string, sortDirection: 'asc' | 'desc') => void;
}

export function SortControl({ options, sortBy, sortDirection, onSortChange }: SortControlProps) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  const currentLabel = options.find((o) => o.value === sortBy)?.label || 'Sort';

  const toggleDirection = () => {
    onSortChange(sortBy, sortDirection === 'asc' ? 'desc' : 'asc');
  };

  const selectSort = (value: string) => {
    onSortChange(value, sortDirection);
    setVisible(false);
  };

  const chipStyle = { backgroundColor: colors.chipBg, borderColor: colors.border };

  return (
    <View className="flex-row items-center gap-2 mb-2">
      <TouchableOpacity
        onPress={() => setVisible(true)}
        className="flex-row items-center gap-1 px-3 py-1.5 rounded-full border"
        style={chipStyle}
      >
        <Ionicons name="swap-vertical-outline" size={14} color={colors.textSecondary} />
        <Text className="text-xs" style={{ color: colors.textSecondary }}>{currentLabel}</Text>
        <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={toggleDirection}
        className="flex-row items-center gap-1 px-3 py-1.5 rounded-full border"
        style={chipStyle}
      >
        <Ionicons
          name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}
          size={14}
          color={colors.textSecondary}
        />
        <Text className="text-xs" style={{ color: colors.textSecondary }}>
          {sortDirection === 'asc' ? 'Asc' : 'Desc'}
        </Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity
          className="flex-1 bg-black/50 justify-end"
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View
            className="rounded-t-2xl pb-8"
            style={{ backgroundColor: colors.surface }}
            onStartShouldSetResponder={() => true}
          >
            <View className="px-4 py-3" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text className="text-base font-semibold" style={{ color: colors.text }}>Sort By</Text>
            </View>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => selectSort(opt.value)}
                className="px-4 py-3 flex-row items-center justify-between"
                style={{ borderBottomWidth: 1, borderBottomColor: colors.borderLight }}
              >
                <Text className="text-sm" style={{ color: colors.text }}>{opt.label}</Text>
                {sortBy === opt.value && (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
