import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAlertsPending, useAlertsAll, useResolveAlert, useAlertsSummary } from '@/hooks/queries/use-alerts';
import { useTheme } from '@/providers/theme-provider';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchBar } from '@/components/ui/SearchBar';
import { formatRelativeTime, formatDateTime } from '@/lib/format';
import type { Alert } from '@/types';

type Tab = 'pending' | 'resolved' | 'all';

const normalizeSeverity = (severity?: string) => {
  const value = (severity || '').toLowerCase();
  if (value === 'warning') return 'medium';
  if (value === 'info') return 'low';
  return value;
};

const matchesSeverityFilter = (itemSeverity: string | undefined, filterSeverity: string) => {
  if (!filterSeverity) return true;
  const normalizedItem = normalizeSeverity(itemSeverity);
  const normalizedFilter = normalizeSeverity(filterSeverity);
  return normalizedItem === normalizedFilter;
};

const severityVariant = (s: string) => {
  switch (normalizeSeverity(s)) {
    case 'critical':
    case 'high':
      return 'danger' as const;
    case 'medium':
      return 'warning' as const;
    default:
      return 'info' as const;
  }
};

const severityBorderColor = (s: string) => {
  switch (normalizeSeverity(s)) {
    case 'critical':
    case 'high':
      return '#dc3545';
    case 'medium':
      return '#ffc107';
    default:
      return '#17a2b8';
  }
};

const severityIcon = (s: string) => {
  switch (normalizeSeverity(s)) {
    case 'critical':
    case 'high':
      return '🚨';
    case 'medium':
      return '⚠️';
    default:
      return 'ℹ️';
  }
};

export default function AlertsScreen() {
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('pending');
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [detailAlert, setDetailAlert] = useState<Alert | null>(null);
  const [resolveAlert, setResolveAlert] = useState<Alert | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');

  const { data: pending, isLoading: loadingPending, refetch: refetchPending, isRefetching: refetchingPending } =
    useAlertsPending();
  const { data: allAlerts, isLoading: loadingAll, refetch: refetchAll, isRefetching: refetchingAll } =
    useAlertsAll();
  const { data: summary } = useAlertsSummary();
  const resolveMutation = useResolveAlert();

  const applyFilters = useCallback((items: Alert[] = []) => {
    const normalizedSearch = search.trim().toLowerCase();
    const normalizedSeverity = severityFilter.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSeverity = matchesSeverityFilter(item.severity, normalizedSeverity);
      const matchesSearch =
        !normalizedSearch
        || item.title?.toLowerCase().includes(normalizedSearch)
        || item.message?.toLowerCase().includes(normalizedSearch)
        || item.plotName?.toLowerCase().includes(normalizedSearch)
        || item.propertyName?.toLowerCase().includes(normalizedSearch)
        || item.alertType?.toLowerCase().includes(normalizedSearch);

      return matchesSeverity && matchesSearch;
    });
  }, [search, severityFilter]);

  const filteredPending = useMemo(() => applyFilters(pending || []), [pending, applyFilters]);
  const filteredAll = useMemo(() => applyFilters(allAlerts || []), [allAlerts, applyFilters]);

  const resolved = useMemo(
    () => filteredAll.filter((a) => a.status?.toLowerCase() === 'resolved'),
    [filteredAll]
  );

  const currentData = tab === 'pending' ? filteredPending : tab === 'resolved' ? resolved : filteredAll;
  const isLoading = tab === 'pending' ? loadingPending : loadingAll;
  const isRefetching = tab === 'pending' ? refetchingPending : refetchingAll;

  const onRefresh = () => {
    refetchPending();
    refetchAll();
  };

  const handleResolveSubmit = useCallback(() => {
    if (!resolveAlert) return;
    resolveMutation.mutate(
      { id: resolveAlert.id, notes: resolveNotes.trim() || undefined },
      {
        onSuccess: () => {
          setResolveAlert(null);
          setResolveNotes('');
        },
      }
    );
  }, [resolveAlert, resolveNotes, resolveMutation]);

  const renderItem = ({ item }: { item: Alert }) => (
    <TouchableOpacity activeOpacity={0.7} onPress={() => setDetailAlert(item)}>
      <Card
        className="mb-3 border-l-4"
        style={{ borderLeftColor: severityBorderColor(item.severity) }}
      >
        <View className="flex-row items-start justify-between mb-1">
          <View className="flex-row items-center gap-1 flex-1 mr-2">
            <Text>{severityIcon(item.severity)}</Text>
            <Text className="font-semibold flex-1" style={{ color: colors.text }}>
              {item.title}
            </Text>
          </View>
          <Badge text={item.severity} variant={severityVariant(item.severity)} />
        </View>
        <Text className="text-sm mb-2" style={{ color: colors.textSecondary }} numberOfLines={2}>
          {item.message}
        </Text>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            {item.plotName && (
              <View className="flex-row items-center gap-1">
                <Ionicons name="leaf-outline" size={12} color={colors.textMuted} />
                <Text className="text-xs" style={{ color: colors.textMuted }}>{item.plotName}</Text>
              </View>
            )}
            {item.propertyName && (
              <View className="flex-row items-center gap-1">
                <Ionicons name="business-outline" size={12} color={colors.textMuted} />
                <Text className="text-xs" style={{ color: colors.textMuted }}>{item.propertyName}</Text>
              </View>
            )}
            <Text className="text-xs" style={{ color: colors.textMuted }}>
              {formatRelativeTime(item.createdAt)}
            </Text>
          </View>
          {item.status?.toLowerCase() === 'pending' && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                setResolveAlert(item);
              }}
              className="flex-row items-center gap-1 bg-success/10 px-2 py-1 rounded"
            >
              <Ionicons name="checkmark-circle-outline" size={14} color="#28a745" />
              <Text className="text-xs font-medium" style={{ color: '#28a745' }}>Resolve</Text>
            </TouchableOpacity>
          )}
          {item.status?.toLowerCase() === 'resolved' && (
            <Badge text="Resolved" variant="success" />
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'pending', label: 'Pending', count: filteredPending.length },
    { key: 'resolved', label: 'Resolved', count: resolved?.length },
    { key: 'all', label: 'All', count: filteredAll.length },
  ];

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="px-4 pt-2 pb-2">
        <Text className="text-2xl font-bold" style={{ color: colors.text }}>Alerts</Text>
      </View>

      {/* Summary Cards */}
      {summary && (
        <View className="px-4 mb-3">
          <Text className="text-xs mb-2" style={{ color: colors.textMuted }}>
            Pending summary (last {summary.windowHours}h)
          </Text>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => setSeverityFilter('critical')}
              className="flex-1 rounded-lg px-3 py-2 items-center"
              style={{
                backgroundColor: colors.dangerBg,
                borderWidth: severityFilter === 'critical' ? 1 : 0,
                borderColor: '#dc3545',
              }}
            >
            <Text className="text-lg font-bold" style={{ color: '#dc3545' }}>{summary.criticalPendingCount}</Text>
            <Text className="text-xs" style={{ color: colors.textMuted }}>Critical</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSeverityFilter('high')}
              className="flex-1 rounded-lg px-3 py-2 items-center"
              style={{
                backgroundColor: colors.warningBg,
                borderWidth: severityFilter === 'high' ? 1 : 0,
                borderColor: '#fd7e14',
              }}
            >
            <Text className="text-lg font-bold" style={{ color: '#fd7e14' }}>{summary.highPendingCount}</Text>
            <Text className="text-xs" style={{ color: colors.textMuted }}>High</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSeverityFilter('medium')}
              className="flex-1 rounded-lg px-3 py-2 items-center"
              style={{
                backgroundColor: colors.warningBg,
                borderWidth: severityFilter === 'medium' ? 1 : 0,
                borderColor: '#ffc107',
              }}
            >
            <Text className="text-lg font-bold" style={{ color: '#ffc107' }}>{summary.mediumPendingCount}</Text>
            <Text className="text-xs" style={{ color: colors.textMuted }}>Medium</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSeverityFilter('low')}
              className="flex-1 rounded-lg px-3 py-2 items-center"
              style={{
                backgroundColor: colors.infoBg,
                borderWidth: severityFilter === 'low' ? 1 : 0,
                borderColor: '#17a2b8',
              }}
            >
            <Text className="text-lg font-bold" style={{ color: '#17a2b8' }}>{summary.lowPendingCount}</Text>
            <Text className="text-xs" style={{ color: colors.textMuted }}>Low</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => setSeverityFilter('')} className="mt-2 self-start">
            <Text className="text-xs font-medium" style={{ color: colors.primary }}>
              Clear severity filter
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search */}
      <View className="px-4">
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search alerts..." />
      </View>

      {/* Tabs */}
      <View className="flex-row px-4 mb-3 gap-2">
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            className={`px-4 py-2 rounded-full ${tab === t.key ? '' : 'border'}`}
            style={tab === t.key
              ? { backgroundColor: colors.primary }
              : { backgroundColor: colors.chipBg, borderColor: colors.border }
            }
          >
            <Text
              className="text-sm font-medium"
              style={{ color: tab === t.key ? '#ffffff' : colors.textSecondary }}
            >
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

      {/* Alert Detail Modal */}
      <Modal visible={!!detailAlert} transparent animationType="slide">
        <TouchableOpacity
          className="flex-1 bg-black/50 justify-end"
          activeOpacity={1}
          onPress={() => setDetailAlert(null)}
        >
          <View
            className="rounded-t-2xl max-h-[80%]"
            style={{ backgroundColor: colors.surface }}
            onStartShouldSetResponder={() => true}
          >
            <View className="flex-row justify-between items-center px-4 py-3" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text className="text-lg font-semibold" style={{ color: colors.text }}>
                Alert Details
              </Text>
              <TouchableOpacity onPress={() => setDetailAlert(null)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            {detailAlert && (
              <ScrollView className="px-4 py-3">
                <View
                  className="rounded-lg p-3 mb-3 border-l-4"
                  style={{
                    borderLeftColor: severityBorderColor(detailAlert.severity),
                    backgroundColor: colors.card,
                  }}
                >
                  <Text className="font-bold text-base mb-1" style={{ color: colors.text }}>
                    {severityIcon(detailAlert.severity)} {detailAlert.title}
                  </Text>
                  <Text style={{ color: colors.textSecondary }}>{detailAlert.message}</Text>
                </View>

                <DetailRow label="Status" colors={colors}>
                  <Badge
                    text={detailAlert.status}
                    variant={detailAlert.status?.toLowerCase() === 'resolved' ? 'success' : 'warning'}
                  />
                </DetailRow>
                <DetailRow label="Severity" colors={colors}>
                  <Badge text={detailAlert.severity} variant={severityVariant(detailAlert.severity)} />
                </DetailRow>
                {detailAlert.alertType && (
                  <DetailRow label="Type" value={detailAlert.alertType} colors={colors} />
                )}
                {detailAlert.sensorId && (
                  <DetailRow label="Sensor ID" value={detailAlert.sensorId} colors={colors} />
                )}
                {detailAlert.plotName && (
                  <DetailRow label="Plot" value={detailAlert.plotName} colors={colors} />
                )}
                {detailAlert.propertyName && (
                  <DetailRow label="Property" value={detailAlert.propertyName} colors={colors} />
                )}
                <DetailRow label="Created" value={formatDateTime(detailAlert.createdAt)} colors={colors} />
                {detailAlert.resolvedAt && (
                  <DetailRow label="Resolved" value={formatDateTime(detailAlert.resolvedAt)} colors={colors} />
                )}

                {detailAlert.status?.toLowerCase() === 'pending' && (
                  <View className="mt-4 mb-6">
                    <Button
                      title="Resolve Alert"
                      onPress={() => {
                        setDetailAlert(null);
                        setResolveAlert(detailAlert);
                      }}
                      icon={<Ionicons name="checkmark-circle" size={18} color="#fff" />}
                    />
                  </View>
                )}
                <View className="h-6" />
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Resolve with Notes Modal */}
      <Modal visible={!!resolveAlert} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-black/50 justify-center px-6"
        >
          <View className="rounded-2xl p-5" style={{ backgroundColor: colors.surface }}>
            <Text className="text-lg font-bold mb-1" style={{ color: colors.text }}>
              Resolve Alert
            </Text>
            <Text className="text-sm mb-4" style={{ color: colors.textSecondary }}>
              {resolveAlert?.title}
            </Text>

            <Text className="text-sm font-medium mb-1.5" style={{ color: colors.text }}>
              Resolution Notes (optional)
            </Text>
            <TextInput
              className="rounded-lg px-3 py-2 mb-1 min-h-[100px]"
              style={{ color: colors.text, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, textAlignVertical: 'top' }}
              placeholder="Describe how the alert was resolved..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={1000}
              value={resolveNotes}
              onChangeText={setResolveNotes}
            />
            <Text className="text-xs mb-4 text-right" style={{ color: colors.textMuted }}>
              {resolveNotes.length}/1000
            </Text>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => {
                    setResolveAlert(null);
                    setResolveNotes('');
                  }}
                />
              </View>
              <View className="flex-1">
                <Button
                  title="Resolve"
                  onPress={handleResolveSubmit}
                  loading={resolveMutation.isPending}
                  icon={<Ionicons name="checkmark-circle" size={18} color="#fff" />}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  children,
  colors,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
  colors: { text: string; textSecondary: string; borderLight: string };
}) {
  return (
    <View className="flex-row items-center justify-between py-2" style={{ borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
      <Text className="text-sm" style={{ color: colors.textSecondary }}>
        {label}
      </Text>
      {children || (
        <Text className="text-sm font-medium" style={{ color: colors.text }}>
          {value}
        </Text>
      )}
    </View>
  );
}
