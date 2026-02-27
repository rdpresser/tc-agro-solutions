import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { Button } from './Button';
import { useTheme } from '@/providers/theme-provider';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        className="flex-1 bg-black/50 items-center justify-center px-6"
        activeOpacity={1}
        onPress={onCancel}
      >
        <View
          className="w-full rounded-2xl p-6"
          style={{ backgroundColor: colors.surface }}
          onStartShouldSetResponder={() => true}
        >
          <Text className="text-xl font-bold mb-2" style={{ color: colors.text }}>
            {title}
          </Text>
          <Text className="mb-6" style={{ color: colors.textSecondary }}>
            {message}
          </Text>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button title={cancelLabel} onPress={onCancel} variant="outline" fullWidth />
            </View>
            <View className="flex-1">
              <Button
                title={confirmLabel}
                onPress={onConfirm}
                variant={variant}
                fullWidth
                loading={loading}
              />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
