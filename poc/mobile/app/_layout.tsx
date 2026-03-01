import React from 'react';
import { LogBox } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryProvider } from '@/providers/query-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { useThemeStore } from '@/stores/theme.store';
import '../global.css';

if (__DEV__) {
  LogBox.ignoreLogs([
    "SafeAreaView has been deprecated and will be removed in a future release. Please use 'react-native-safe-area-context' instead.",
  ]);
}

function RootNav() {
  const theme = useThemeStore((s) => s.theme);

  return (
    <>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryProvider>
      <ThemeProvider>
        <AuthProvider>
          <RootNav />
        </AuthProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
