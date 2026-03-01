import React from 'react';
import { Redirect, Tabs, router, useGlobalSearchParams, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/auth.store';
import { useOnboardingStore } from '@/stores/onboarding.store';
import { useSignalR } from '@/hooks/use-signalr';
import { useFallbackPolling } from '@/hooks/use-fallback-polling';
import { useAlertsSummary } from '@/hooks/queries/use-alerts';
import { useOwners } from '@/hooks/queries/use-owners';
import { useDashboardOwnerFilterStore } from '@/stores/dashboard-owner-filter.store';
import { useTheme } from '@/providers/theme-provider';
import type { User } from '@/types';

function AuthenticatedTabs({ user }: { user: User }) {
  const selectedOwnerId = useDashboardOwnerFilterStore((s) => s.selectedOwnerId);
  const setSelectedOwnerId = useDashboardOwnerFilterStore((s) => s.setSelectedOwnerId);
  const { data: owners = [] } = useOwners();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    const isAdmin = user.role?.toLowerCase() === 'admin';
    if (!isAdmin) return;
    if (selectedOwnerId) return;
    if (owners.length === 0) return;

    setSelectedOwnerId(owners[0].id);
  }, [user, selectedOwnerId, owners, setSelectedOwnerId]);

  useSignalR();
  useFallbackPolling();

  const ownerScopeId = user.role?.toLowerCase() === 'admin' ? (selectedOwnerId || undefined) : undefined;
  const { data: summary } = useAlertsSummary(24, ownerScopeId);
  const alertCount = summary?.pendingAlertsTotal || 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        popToTopOnBlur: true,
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
  const isWizardActive = useOnboardingStore((s) => s.isWizardActive);
  const isOnboardingHydrated = useOnboardingStore((s) => s.isHydrated);
  const skipOnboarding = useOnboardingStore((s) => s.skipOnboarding);
  const segments = useSegments();
  const params = useGlobalSearchParams<{ wizard?: string }>();

  React.useEffect(() => {
    if (!isOnboardingHydrated) return;
    if (!user || user.role?.toLowerCase() !== 'admin') return;
    if (!isWizardActive) return;

    skipOnboarding().then(() => {
      router.replace('/(app)/(dashboard)');
    });
  }, [isOnboardingHydrated, user, isWizardActive, skipOnboarding]);

  React.useEffect(() => {
    if (!isOnboardingHydrated || isWizardActive || params.wizard !== '1') {
      return;
    }

    if (segments.includes('(properties)')) {
      router.replace('/(app)/(properties)');
      return;
    }

    if (segments.includes('(plots)')) {
      router.replace('/(app)/(plots)');
      return;
    }

    if (segments.includes('(sensors)')) {
      router.replace('/(app)/(sensors)');
      return;
    }

    router.replace('/(app)/(dashboard)');
  }, [isOnboardingHydrated, isWizardActive, params.wizard, segments]);

  if (!isHydrated) return null;
  if (!isAuthenticated || !user) return <Redirect href="/(auth)/login" />;

  return <AuthenticatedTabs user={user} />;
}
