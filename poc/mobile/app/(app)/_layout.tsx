import React, { useState, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Redirect, Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/auth.store';
import { useSignalR } from '@/hooks/use-signalr';
import { useFallbackPolling } from '@/hooks/use-fallback-polling';
import { useNotifications } from '@/hooks/use-notifications';
import { useAlertsPending } from '@/hooks/queries/use-alerts';
import { useRealtimeStore } from '@/stores/realtime.store';
import { useTheme } from '@/providers/theme-provider';
import { Toast } from '@/components/ui/Toast';
import type { Alert as AlertType } from '@/types';

export default function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const user = useAuthStore((s) => s.user);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Initialize real-time connections
  useSignalR();
  useFallbackPolling();
  useNotifications();

  // Toast state for in-app alert banners
  const recentAlerts = useRealtimeStore((s) => s.recentAlerts);
  const [toastAlert, setToastAlert] = useState<AlertType | null>(null);
  const prevAlertCountRef = useRef(0);

  useEffect(() => {
    if (recentAlerts.length > prevAlertCountRef.current && recentAlerts.length > 0) {
      setToastAlert(recentAlerts[0]);
    }
    prevAlertCountRef.current = recentAlerts.length;
  }, [recentAlerts]);

  // Alert badge count
  const { data: pendingAlerts } = useAlertsPending();
  const alertCount = pendingAlerts?.length || 0;

  const isAdmin = user?.role?.toLowerCase() === 'admin';

  if (!isHydrated) return null;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <View style={{ flex: 1 }}>
    <Toast
      alert={toastAlert}
      onDismiss={() => setToastAlert(null)}
      onPress={() => {
        setToastAlert(null);
        router.push('/(app)/(alerts)');
      }}
    />
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
        name="(alerts)"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={focused ? 24 : 22} color={color} />
          ),
          tabBarBadge: alertCount > 0 ? alertCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#dc3545', fontSize: 10 },
        }}
      />
      {/* Hidden tabs */}
      <Tabs.Screen
        name="(users)"
        options={{ href: isAdmin ? undefined : null, title: 'Users',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={focused ? 24 : 22} color={color} />
          ),
          tabBarItemStyle: isAdmin ? undefined : { display: 'none' },
        }}
      />
      <Tabs.Screen name="(settings)" options={{ href: null }} />
    </Tabs>
    </View>
  );
}
