import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/theme-provider';

interface DatePickerProps {
  label?: string;
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  placeholder?: string;
  error?: string;
}

export function DatePicker({ label, value, onChange, placeholder = 'Select date', error }: DatePickerProps) {
  const { colors } = useTheme();
  const [show, setShow] = useState(false);

  const dateValue = value ? new Date(value + 'T12:00:00') : new Date();

  const handleChange = (_: unknown, selected?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (selected) {
      const yyyy = selected.getFullYear();
      const mm = String(selected.getMonth() + 1).padStart(2, '0');
      const dd = String(selected.getDate()).padStart(2, '0');
      onChange(`${yyyy}-${mm}-${dd}`);
    }
  };

  const formatDisplay = (v: string) => {
    if (!v) return '';
    const [y, m, d] = v.split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <View className="mb-4">
      {label && (
        <Text className="text-sm font-medium mb-1.5" style={{ color: colors.text }}>
          {label}
        </Text>
      )}
      <TouchableOpacity
        onPress={() => setShow(true)}
        className="flex-row items-center justify-between rounded-lg px-3 py-3"
        style={{
          backgroundColor: colors.inputBg,
          borderWidth: 1,
          borderColor: error ? '#dc3545' : colors.border,
        }}
      >
        <Text style={{ color: value ? colors.text : colors.textMuted }}>
          {value ? formatDisplay(value) : placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
      </TouchableOpacity>
      {error && <Text className="text-xs mt-1" style={{ color: '#dc3545' }}>{error}</Text>}

      {show && (
        Platform.OS === 'ios' ? (
          <View className="mt-2 rounded-lg overflow-hidden" style={{ backgroundColor: colors.surface }}>
            <DateTimePicker
              value={dateValue}
              mode="date"
              display="spinner"
              onChange={handleChange}
              themeVariant={colors.background === '#0f1510' ? 'dark' : 'light'}
            />
            <TouchableOpacity
              onPress={() => setShow(false)}
              className="py-2 items-center"
              style={{ borderTopWidth: 1, borderTopColor: colors.border }}
            >
              <Text className="text-sm font-semibold" style={{ color: colors.primary }}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <DateTimePicker
            value={dateValue}
            mode="date"
            display="default"
            onChange={handleChange}
          />
        )
      )}
    </View>
  );
}
