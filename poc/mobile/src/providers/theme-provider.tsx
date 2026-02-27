import React, { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { useThemeStore } from '@/stores/theme.store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useThemeStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return <>{children}</>;
}

export function useTheme() {
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === 'dark';

  return {
    theme,
    isDark,
    colors: {
      background: isDark ? '#0f1510' : '#f5f5f0',
      surface: isDark ? '#1a2118' : '#ffffff',
      card: isDark ? '#1f2b1c' : '#ffffff',
      text: isDark ? '#e8ece6' : '#1a1a1a',
      textSecondary: isDark ? '#a3b09e' : '#666666',
      textMuted: isDark ? '#6b7d66' : '#999999',
      border: isDark ? '#2e3d2a' : '#e0e0e0',
      borderLight: isDark ? '#263323' : '#f0f0f0',
      primary: isDark ? '#4a8c2a' : '#2d5016',
      primaryLight: isDark ? '#5ea03a' : '#4a7c2c',
      inputBg: isDark ? '#162013' : '#ffffff',
      chipBg: isDark ? '#1a2718' : '#ffffff',
      dangerBg: isDark ? '#2a1215' : '#fff5f5',
      warningBg: isDark ? '#2a2412' : '#fff8e6',
      infoBg: isDark ? '#121e2a' : '#e8f4fd',
      successBg: isDark ? '#122a15' : '#e8fde8',
    },
  };
}
