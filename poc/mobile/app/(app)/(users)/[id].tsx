import React, { useState } from 'react';
import {
  View, Text, ScrollView, KeyboardAvoidingView,
  Platform, Alert, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { z } from 'zod';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/stores/auth.store';
import { useTheme } from '@/providers/theme-provider';
import { useUserByEmail, useUpdateUser } from '@/hooks/queries/use-users';
import { USER_ROLES } from '@/constants/crop-types';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { EmptyState } from '@/components/ui/EmptyState';

const userFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  username: z.string().min(1, 'Username is required').min(3, 'Min 3 characters'),
  password: z.string().optional().refine((value) => !value || value.length >= 6, 'Min 6 characters'),
  role: z.string().optional(),
});

type UserFormData = z.infer<typeof userFormSchema>;

export default function UserFormScreen() {
  const { id, email } = useLocalSearchParams<{ id: string; email?: string }>();
  const isNew = id === 'new';
  const { colors } = useTheme();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin';
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { data: existingUser, isLoading: loadingUser } = useUserByEmail(!isNew ? (email || '') : '');
  const updateUserMutation = useUpdateUser();

  const { control, handleSubmit, reset, formState: { errors } } = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { name: '', email: '', username: '', password: '', role: 'Producer' },
  });

  React.useEffect(() => {
    if (!isNew && existingUser) {
      reset({
        name: existingUser.name || '',
        email: existingUser.email || '',
        username: existingUser.username || '',
        password: '',
        role: existingUser.role || 'Producer',
      });
    }
  }, [isNew, existingUser, reset]);

  const onSubmit = async (data: UserFormData) => {
    if (!isAdmin) return;
    setIsLoading(true);
    try {
      if (isNew) {
        if (!data.password || data.password.length < 6) {
          Alert.alert('Validation', 'Password must have at least 6 characters.');
          return;
        }
        if (!data.role) {
          Alert.alert('Validation', 'Role is required.');
          return;
        }
        await authApi.register({
          name: data.name,
          email: data.email,
          username: data.username,
          password: data.password,
          role: data.role,
        });
        Alert.alert('Success', 'User created successfully!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        await updateUserMutation.mutateAsync({
          id,
          data: {
            name: data.name,
            email: data.email,
            username: data.username,
          },
        });
        Alert.alert('Success', 'User updated successfully!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (error: any) {
      const message = error?.response?.data?.message
        || error?.response?.data?.title
        || (isNew ? 'Failed to create user.' : 'Failed to update user.');
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        <EmptyState
          icon="lock-closed-outline"
          title="Admin Only"
          message="User management is restricted to admin users."
        />
      </SafeAreaView>
    );
  }

  if (!isNew && loadingUser) {
    return <LoadingOverlay fullScreen />;
  }

  const roleOptions = USER_ROLES.map((r) => ({ value: r.value, label: r.label }));

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View className="px-4 pt-2 pb-4 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-xl font-bold" style={{ color: colors.text }}>{isNew ? 'New User' : 'Edit User'}</Text>
        </View>

        <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
          <View className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: colors.card }}>
            <Controller control={control} name="name" render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Full Name"
                placeholder="User's full name"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.name?.message}
                leftIcon={<Ionicons name="person-outline" size={20} color="#999" />}
              />
            )} />

            <Controller control={control} name="email" render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Email"
                placeholder="user@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.email?.message}
                leftIcon={<Ionicons name="mail-outline" size={20} color="#999" />}
              />
            )} />

            <Controller control={control} name="username" render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Username"
                placeholder="Choose a username"
                autoCapitalize="none"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.username?.message}
                leftIcon={<Ionicons name="at-outline" size={20} color="#999" />}
              />
            )} />

            {isNew && (
              <>
                <Controller control={control} name="password" render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Password"
                    placeholder="Min 6 characters"
                    secureTextEntry={!showPassword}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.password?.message}
                    leftIcon={<Ionicons name="lock-closed-outline" size={20} color="#999" />}
                    rightIcon={
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                        <Ionicons
                          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color="#999"
                        />
                      </TouchableOpacity>
                    }
                  />
                )} />

                <Controller control={control} name="role" render={({ field: { onChange, value } }) => (
                  <Select label="Role" options={roleOptions} value={value || ''} onChange={onChange} error={errors.role?.message} />
                )} />
              </>
            )}

            {!isNew && (
              <Text className="text-xs mb-3" style={{ color: colors.textSecondary }}>
                In edit mode, role and password changes are not available.
              </Text>
            )}

            <View className="mt-2">
              <Button
                title={isNew ? 'Create User' : 'Update User'}
                onPress={handleSubmit(onSubmit)}
                loading={isLoading}
                fullWidth
                size="lg"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
