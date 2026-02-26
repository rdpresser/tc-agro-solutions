import React, { useState } from 'react';
import {
  View, Text, KeyboardAvoidingView, Platform,
  ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth.store';
import { loginSchema, type LoginFormData } from '@/lib/validation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [showPassword, setShowPassword] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data);
      router.replace('/(app)/(dashboard)');
    } catch (error: any) {
      const message = error?.response?.data?.message
        || error?.response?.data?.title
        || 'Invalid credentials. Please try again.';
      Alert.alert('Login Failed', message);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerClassName="flex-1 justify-center px-6"
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / Header */}
        <View className="items-center mb-10">
          <View className="w-20 h-20 rounded-2xl bg-primary items-center justify-center mb-4">
            <Ionicons name="leaf" size={40} color="#fff" />
          </View>
          <Text className="text-3xl font-bold text-primary">TC Agro</Text>
          <Text className="text-gray-500 mt-1">Agricultural Monitoring Platform</Text>
        </View>

        {/* Form */}
        <View className="bg-white rounded-2xl p-6 shadow-sm">
          <Text className="text-xl font-bold text-gray-800 mb-6">Sign In</Text>

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Email"
                placeholder="your@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.email?.message}
                leftIcon={<Ionicons name="mail-outline" size={20} color="#999" />}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <View>
                <Input
                  label="Password"
                  placeholder="Enter your password"
                  secureTextEntry={!showPassword}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                  leftIcon={<Ionicons name="lock-closed-outline" size={20} color="#999" />}
                />
                <TouchableOpacity
                  className="absolute right-3 top-9"
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#999"
                  />
                </TouchableOpacity>
              </View>
            )}
          />

          <Button
            title="Sign In"
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            fullWidth
            size="lg"
          />
        </View>

        {/* Sign up link */}
        <View className="flex-row justify-center mt-6">
          <Text className="text-gray-500">Don't have an account? </Text>
          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity>
              <Text className="text-primary font-semibold">Sign Up</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
