import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/auth.store';

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  if (!isHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#2d5016" />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(app)/(dashboard)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
