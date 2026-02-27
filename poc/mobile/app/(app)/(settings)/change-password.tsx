import React, { useState } from 'react';
import {
  View, Text, ScrollView, KeyboardAvoidingView,
  Platform, Alert, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '@/api/auth.api';
import { useTheme } from '@/providers/theme-provider';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  confirmNewPassword: z.string().min(1, 'Confirm your new password'),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: 'Passwords do not match',
  path: ['confirmNewPassword'],
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword'],
});

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export default function ChangePasswordScreen() {
  const { colors, isDark } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' },
  });

  const onSubmit = async (data: ChangePasswordFormData) => {
    setIsLoading(true);
    try {
      await authApi.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      Alert.alert('Success', 'Password changed successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
      reset();
    } catch (error: any) {
      const message = error?.response?.data?.message
        || error?.response?.data?.title
        || 'Failed to change password. Please check your current password and try again.';
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const eyeIcon = (visible: boolean, toggle: () => void) => (
    <TouchableOpacity onPress={toggle}>
      <Ionicons
        name={visible ? 'eye-off-outline' : 'eye-outline'}
        size={20}
        color={colors.textMuted}
      />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View className="px-4 pt-2 pb-4 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-xl font-bold" style={{ color: colors.text }}>
            Change Password
          </Text>
        </View>

        <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
          <View
            className="rounded-2xl p-5"
            style={{
              backgroundColor: colors.card,
              shadowColor: isDark ? 'transparent' : '#000',
              shadowOpacity: 0.05,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            }}
          >
            {/* Current Password */}
            <Controller
              control={control}
              name="currentPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Current Password"
                  placeholder="Enter your current password"
                  secureTextEntry={!showCurrent}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.currentPassword?.message}
                  leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />}
                  rightIcon={eyeIcon(showCurrent, () => setShowCurrent(!showCurrent))}
                />
              )}
            />

            {/* Divider */}
            <View
              className="my-2 mb-4"
              style={{ height: 1, backgroundColor: colors.border }}
            />

            {/* New Password */}
            <Controller
              control={control}
              name="newPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="New Password"
                  placeholder="Min 6 characters"
                  secureTextEntry={!showNew}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.newPassword?.message}
                  leftIcon={<Ionicons name="key-outline" size={20} color={colors.textMuted} />}
                  rightIcon={eyeIcon(showNew, () => setShowNew(!showNew))}
                />
              )}
            />

            {/* Confirm New Password */}
            <Controller
              control={control}
              name="confirmNewPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Confirm New Password"
                  placeholder="Repeat new password"
                  secureTextEntry={!showConfirm}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.confirmNewPassword?.message}
                  leftIcon={<Ionicons name="key-outline" size={20} color={colors.textMuted} />}
                  rightIcon={eyeIcon(showConfirm, () => setShowConfirm(!showConfirm))}
                />
              )}
            />

            <View className="mt-2">
              <Button
                title="Change Password"
                onPress={handleSubmit(onSubmit)}
                loading={isLoading}
                fullWidth
                size="lg"
              />
            </View>
          </View>

          {/* Tips */}
          <View className="mt-4 mb-8 px-1">
            <Text className="text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
              Password tips:
            </Text>
            <View className="gap-1">
              <Text className="text-sm" style={{ color: colors.textMuted }}>
                {'\u2022'} At least 6 characters
              </Text>
              <Text className="text-sm" style={{ color: colors.textMuted }}>
                {'\u2022'} Must be different from your current password
              </Text>
              <Text className="text-sm" style={{ color: colors.textMuted }}>
                {'\u2022'} Use a mix of letters, numbers, and symbols
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
