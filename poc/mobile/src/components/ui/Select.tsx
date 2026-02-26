import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/theme-provider';

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  placeholder?: string;
  options: readonly Option[] | Option[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function Select({ label, placeholder = 'Select...', options, value, onChange, error }: SelectProps) {
  const [visible, setVisible] = useState(false);
  const { colors } = useTheme();
  const selected = options.find((o) => o.value === value);

  return (
    <View className="mb-4">
      {label && (
        <Text className="text-sm font-medium mb-1.5" style={{ color: colors.text }}>
          {label}
        </Text>
      )}
      <TouchableOpacity
        onPress={() => setVisible(true)}
        className={`
          flex-row items-center justify-between rounded-lg border px-3 py-3
          ${error ? 'border-danger' : 'border-gray-300'}
        `}
        style={{ backgroundColor: colors.surface }}
      >
        <Text style={{ color: selected ? colors.text : colors.textMuted }}>
          {selected?.label || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
      </TouchableOpacity>
      {error && <Text className="text-danger text-xs mt-1">{error}</Text>}

      <Modal visible={visible} transparent animationType="slide">
        <TouchableOpacity
          className="flex-1 bg-black/50 justify-end"
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View
            className="rounded-t-2xl max-h-[60%]"
            style={{ backgroundColor: colors.surface }}
          >
            <View className="flex-row justify-between items-center px-4 py-3 border-b border-gray-200">
              <Text className="text-lg font-semibold" style={{ color: colors.text }}>
                {label || 'Select'}
              </Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={options as Option[]}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  className={`px-4 py-3.5 border-b border-gray-100 ${
                    item.value === value ? 'bg-primary/10' : ''
                  }`}
                  onPress={() => {
                    onChange(item.value);
                    setVisible(false);
                  }}
                >
                  <Text
                    style={{
                      color: item.value === value ? '#2d5016' : colors.text,
                      fontWeight: item.value === value ? '600' : '400',
                    }}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
