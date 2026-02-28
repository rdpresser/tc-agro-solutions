import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/auth.store';
import { useSignalR } from '@/hooks/use-signalr';
import { useFallbackPolling } from '@/hooks/use-fallback-polling';
import { useAlertsSummary } from '@/hooks/queries/use-alerts';
import { useDashboardOwnerFilterStore } from '@/stores/dashboard-owner-filter.store';
import { useTheme } from '@/providers/theme-provider';
import type { User } from '@/types';

function AuthenticatedTabs({ user }: { user: User }) {
  const selectedOwnerId = useDashboardOwnerFilterStore((s) => s.selectedOwnerId);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  useSignalR();
  useFallbackPolling();

  const ownerScopeId = user.role?.toLowerCase() === 'admin' ? (selectedOwnerId || undefined) : undefined;
  const { data: summary } = useAlertsSummary(24, ownerScopeId);
  const alertCount = summary?.pendingAlertsTotal || 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isDark ? colors.primaryLight : colors.primary,
        tabBarInactiveTintColor: isDark ? colors.textSecondary : colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          height: 64 + Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
      }}
    >
      <Tabs.Screen
        name="(dashboard)"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={focused ? 24 : 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(properties)"
        options={{
          title: 'Properties',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'business' : 'business-outline'} size={focused ? 24 : 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(plots)"
        options={{
          title: 'Plots',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'leaf' : 'leaf-outline'} size={focused ? 24 : 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(sensors)"
        options={{
          title: 'Sensors',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'pulse' : 'pulse-outline'} size={focused ? 24 : 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(settings)"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={focused ? 24 : 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(alerts)"
        options={{
          href: null,
          title: 'Alerts',
          tabBarBadge: alertCount > 0 ? alertCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#dc3545', fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="(users)"
        options={{
          href: null,
          title: 'Users',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={focused ? 24 : 22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

export default function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const user = useAuthStore((s) => s.user);

  if (!isHydrated) return null;
  if (!isAuthenticated || !user) return <Redirect href="/(auth)/login" />;

  return <AuthenticatedTabs user={user} />;
}
