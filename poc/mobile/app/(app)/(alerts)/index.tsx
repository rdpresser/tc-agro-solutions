import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert as RNAlert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAlertsPending, useAlertsAll, useResolveAlert } from '@/hooks/queries/use-alerts';
import { useTheme } from '@/providers/theme-provider';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatRelativeTime } from '@/lib/format';
import type { Alert } from '@/types';

type Tab = 'pending' | 'resolved' | 'all';

const severityVariant = (s: string) => {
  switch (s) {
    case 'critical': return 'danger';
    case 'warning': return 'warning';
    default: return 'info';
  }
};

const severityBorderColor = (s: string) => {
  switch (s) {
    case 'critical': return '#dc3545';
    case 'warning': return '#ffc107';
    default: return '#17a2b8';
  }
};

export default function AlertsScreen() {
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('pending');

  const { data: pending, isLoading: loadingPending, refetch: refetchPending, isRefetching: refetchingPending } = useAlertsPending();
  const { data: allAlerts, isLoading: loadingAll, refetch: refetchAll, isRefetching: refetchingAll } = useAlertsAll();
  const resolveMutation = useResolveAlert();

  const resolved = useMemo(
    () => (allAlerts || []).filter((a) => a.status === 'Resolved'),
    [allAlerts]
  );

  const currentData = tab === 'pending' ? pending : tab === 'resolved' ? resolved : allAlerts;
  const isLoading = tab === 'pending' ? loadingPending : loadingAll;
  const isRefetching = tab === 'pending' ? refetchingPending : refetchingAll;

  const onRefresh = () => {
    refetchPending();
    refetchAll();
  };

  const handleResolve = (id: string) => {
    RNAlert.alert('Resolve Alert', 'Mark this alert as resolved?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resolve',
        onPress: () => resolveMutation.mutate(id),
      },
    ]);
  };

  const renderItem = ({ item }: { item: Alert }) => (
    <Card
      className="mb-3 border-l-4"
      style={{ borderLeftColor: severityBorderColor(item.severity) }}
    >
      <View className="flex-row items-start justify-between mb-1">
        <Text className="font-semibold flex-1 mr-2" style={{ color: colors.text }}>
          {item.title}
        </Text>
        <Badge text={item.severity} variant={severityVariant(item.severity)} />
      </View>
      <Text className="text-sm mb-2" style={{ color: colors.textSecondary }}>
        {item.message}
      </Text>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          {item.plotName && (
            <View className="flex-row items-center gap-1">
              <Ionicons name="grid-outline" size={12} color={colors.textMuted} />
              <Text className="text-xs" style={{ color: colors.textMuted }}>{item.plotName}</Text>
            </View>
          )}
          <Text className="text-xs" style={{ color: colors.textMuted }}>
            {formatRelativeTime(item.createdAt)}
          </Text>
        </View>
        {item.status === 'Pending' && (
          <TouchableOpacity
            onPress={() => handleResolve(item.id)}
            className="flex-row items-center gap-1 bg-success/10 px-2 py-1 rounded"
          >
            <Ionicons name="checkmark-circle-outline" size={14} color="#28a745" />
            <Text className="text-xs font-medium text-success">Resolve</Text>
          </TouchableOpacity>
        )}
        {item.status === 'Resolved' && (
          <Badge text="Resolved" variant="success" />
        )}
      </View>
    </Card>
  );

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'pending', label: 'Pending', count: pending?.length },
    { key: 'resolved', label: 'Resolved', count: resolved?.length },
    { key: 'all', label: 'All', count: allAlerts?.length },
  ];

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="px-4 pt-2 pb-2">
        <Text className="text-2xl font-bold" style={{ color: colors.text }}>Alerts</Text>
      </View>

      {/* Tabs */}
      <View className="flex-row px-4 mb-3 gap-2">
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            className={`px-4 py-2 rounded-full ${tab === t.key ? 'bg-primary' : 'bg-white border border-gray-300'}`}
          >
            <Text className={`text-sm font-medium ${tab === t.key ? 'text-white' : 'text-gray-600'}`}>
              {t.label}{t.count != null ? ` (${t.count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <LoadingOverlay />
      ) : !currentData?.length ? (
        <EmptyState
          icon="checkmark-circle-outline"
          title={tab === 'pending' ? 'No Pending Alerts' : 'No Alerts'}
          message={tab === 'pending' ? 'All clear! No active alerts.' : undefined}
        />
      ) : (
        <FlatList
          data={currentData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerClassName="px-4 pb-4"
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor="#2d5016" />
          }
        />
      )}
    </SafeAreaView>
  );
}
