import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  isHydrated: boolean;
  setTheme: (theme: Theme) => Promise<void>;
  toggleTheme: () => Promise<void>;
  hydrate: () => Promise<void>;
}

const THEME_KEY = 'agro_theme';

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'light',
  isHydrated: false,

  hydrate: async () => {
    const stored = await AsyncStorage.getItem(THEME_KEY);
    const theme = (stored as Theme) || (Appearance.getColorScheme() ?? 'light');
    set({ theme, isHydrated: true });
  },

  setTheme: async (theme: Theme) => {
    await AsyncStorage.setItem(THEME_KEY, theme);
    set({ theme });
  },

  toggleTheme: async () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    await get().setTheme(next);
  },
}));
