import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore } from '@/stores/theme.store';
import { useTheme } from '@/providers/theme-provider';
import { useBiometric } from '@/hooks/use-biometric';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const { isAvailable, isEnabled, biometricType, toggleBiometric } = useBiometric();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="px-4 pt-2 pb-2 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text className="text-2xl font-bold" style={{ color: colors.text }}>Settings</Text>
      </View>

      <ScrollView className="flex-1 px-4">
        {/* Profile */}
        <Card className="mb-4">
          <View className="flex-row items-center gap-3">
            <View className="w-14 h-14 rounded-full bg-primary items-center justify-center">
              <Text className="text-white font-bold text-xl">
                {user?.name?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-lg font-semibold" style={{ color: colors.text }}>
                {user?.name}
              </Text>
              <Text style={{ color: colors.textSecondary }}>{user?.email}</Text>
              <Badge text={user?.role || 'user'} variant="primary" />
            </View>
          </View>
        </Card>

        {/* Preferences */}
        <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
          Preferences
        </Text>

        <Card className="mb-4">
          {/* Dark Mode */}
          <View className="flex-row items-center justify-between py-2">
            <View className="flex-row items-center gap-3">
              <Ionicons name={theme === 'dark' ? 'moon' : 'sunny-outline'} size={22} color={colors.text} />
              <Text style={{ color: colors.text }}>Dark Mode</Text>
            </View>
            <Switch
              value={theme === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ true: '#2d5016', false: '#e0e0e0' }}
              thumbColor="#fff"
            />
          </View>

          {/* Biometric */}
          {isAvailable && (
            <View className="flex-row items-center justify-between py-2 border-t border-gray-100">
              <View className="flex-row items-center gap-3">
                <Ionicons name="finger-print-outline" size={22} color={colors.text} />
                <Text style={{ color: colors.text }}>{biometricType}</Text>
              </View>
              <Switch
                value={isEnabled}
                onValueChange={toggleBiometric}
                trackColor={{ true: '#2d5016', false: '#e0e0e0' }}
                thumbColor="#fff"
              />
            </View>
          )}
        </Card>

        {/* Navigation */}
        <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
          Management
        </Text>

        <Card className="mb-4">
          {user?.role?.toLowerCase() === 'admin' && (
            <TouchableOpacity
              onPress={() => router.push('/(app)/(users)')}
              className="flex-row items-center justify-between py-3 border-b border-gray-100"
            >
              <View className="flex-row items-center gap-3">
                <Ionicons name="people-outline" size={22} color={colors.text} />
                <Text style={{ color: colors.text }}>User Management</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => router.push('/(app)/(plots)')}
            className="flex-row items-center justify-between py-3 border-b border-gray-100"
          >
            <View className="flex-row items-center gap-3">
              <Ionicons name="grid-outline" size={22} color={colors.text} />
              <Text style={{ color: colors.text }}>Plots</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(app)/(settings)')}
            className="flex-row items-center justify-between py-3"
          >
            <View className="flex-row items-center gap-3">
              <Ionicons name="settings-outline" size={22} color={colors.text} />
              <Text style={{ color: colors.text }}>App Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          className="flex-row items-center justify-center gap-2 bg-danger/10 rounded-xl py-4 mb-8"
        >
          <Ionicons name="log-out-outline" size={22} color="#dc3545" />
          <Text className="text-danger font-semibold text-base">Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
