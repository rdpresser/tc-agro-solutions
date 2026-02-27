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
import { useTheme } from '@/providers/theme-provider';
import { USER_ROLES } from '@/constants/crop-types';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  username: z.string().min(1, 'Username is required').min(3, 'Min 3 characters'),
  password: z.string().min(1, 'Password is required').min(6, 'Min 6 characters'),
  role: z.string().min(1, 'Role is required'),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;

export default function UserFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: '', email: '', username: '', password: '', role: 'Producer' },
  });

  const onSubmit = async (data: CreateUserFormData) => {
    setIsLoading(true);
    try {
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
    } catch (error: any) {
      const message = error?.response?.data?.message
        || error?.response?.data?.title
        || 'Failed to create user.';
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isNew) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        <View className="px-4 pt-2 pb-4 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-xl font-bold" style={{ color: colors.text }}>User Detail</Text>
        </View>
        <View className="flex-1 items-center justify-center px-4">
          <Ionicons name="person-circle-outline" size={80} color={colors.textMuted} />
          <Text className="text-lg mt-4" style={{ color: colors.text }}>User ID: {id}</Text>
          <Text className="text-sm mt-2 text-center" style={{ color: colors.textSecondary }}>
            User editing is available from the user list
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const roleOptions = USER_ROLES.map((r) => ({ value: r.value, label: r.label }));

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View className="px-4 pt-2 pb-4 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-xl font-bold" style={{ color: colors.text }}>New User</Text>
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
              <Select
                label="Role"
                options={roleOptions}
                value={value}
                onChange={onChange}
                error={errors.role?.message}
              />
            )} />

            <View className="mt-2">
              <Button
                title="Create User"
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
