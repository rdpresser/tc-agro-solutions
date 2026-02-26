import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth.store';
import { useSignalR } from '@/hooks/use-signalr';
import { useFallbackPolling } from '@/hooks/use-fallback-polling';
import { useAlertsPending } from '@/hooks/queries/use-alerts';
import { useTheme } from '@/providers/theme-provider';

export default function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const { colors } = useTheme();

  // Initialize real-time connections
  useSignalR();
  useFallbackPolling();

  // Alert badge count
  const { data: pendingAlerts } = useAlertsPending();
  const alertCount = pendingAlerts?.length || 0;

  if (!isHydrated) return null;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2d5016',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: 4,
          height: 56,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="(dashboard)"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(properties)"
        options={{
          title: 'Properties',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="business-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(sensors)"
        options={{
          title: 'Monitoring',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pulse-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(alerts)"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="warning-outline" size={size} color={color} />
          ),
          tabBarBadge: alertCount > 0 ? alertCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#dc3545', fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="(plots)"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipsis-horizontal" size={size} color={color} />
          ),
        }}
      />
      {/* Hidden tabs */}
      <Tabs.Screen name="(users)" options={{ href: null }} />
      <Tabs.Screen name="(settings)" options={{ href: null }} />
    </Tabs>
  );
}
