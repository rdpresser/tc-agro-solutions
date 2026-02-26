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
      background: isDark ? '#121212' : '#f5f5f0',
      surface: isDark ? '#1e1e1e' : '#ffffff',
      card: isDark ? '#2a2a2a' : '#ffffff',
      text: isDark ? '#f0f0f0' : '#1a1a1a',
      textSecondary: isDark ? '#a0a0a0' : '#666666',
      textMuted: isDark ? '#707070' : '#999999',
      border: isDark ? '#333333' : '#e0e0e0',
      primary: '#2d5016',
      primaryLight: '#4a7c2c',
    },
  };
}
