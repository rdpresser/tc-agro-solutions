import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert as RNAlert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSensors, useChangeSensorStatus } from '@/hooks/queries/use-sensors';
import { useTheme } from '@/providers/theme-provider';
import { SENSOR_STATUSES, getSensorIcon } from '@/constants/crop-types';
import { SearchBar } from '@/components/ui/SearchBar';
import { FilterChips } from '@/components/ui/FilterChips';
import { SortControl } from '@/components/ui/SortControl';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { EmptyState } from '@/components/ui/EmptyState';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { formatDate } from '@/lib/format';
import type { Sensor } from '@/types';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  ...SENSOR_STATUSES.map((s) => ({ value: s.value, label: s.value })),
];

const statusVariant = (s: string) => {
  switch (s) {
    case 'Active': return 'success';
    case 'Inactive': return 'secondary';
    case 'Maintenance': return 'warning';
    case 'Faulty': return 'danger';
    default: return 'secondary';
  }
};

export default function SensorsListScreen() {
  const { colors, isDark } = useTheme();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('installedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const { data, isLoading, isRefetching, refetch } = useSensors({
    pageNumber: page,
    pageSize: 10,
    filter: search || undefined,
    status: statusFilter || undefined,
    sortBy,
    sortDirection,
  });
  const changeStatusMutation = useChangeSensorStatus();

  const sensors = data?.items || [];

  const handleChangeStatus = (sensor: Sensor) => {
    const options = SENSOR_STATUSES.filter((s) => s.value !== sensor.status);
    RNAlert.alert(
      'Change Sensor Status',
      `Select new status for ${sensor.label}`,
      [
        ...options.map((status) => ({
          text: status.label,
          onPress: () => {
            changeStatusMutation.mutate(
              { id: sensor.id, data: { newStatus: status.value } },
              {
                onSuccess: () => RNAlert.alert('Success', 'Sensor status updated.'),
                onError: () => RNAlert.alert('Error', 'Failed to update sensor status.'),
              }
            );
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const renderItem = ({ item }: { item: Sensor }) => (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/(app)/(sensors)/[id]', params: { id: item.id } })}
      activeOpacity={0.7}
    >
      <Card className="mb-3">
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1">
            <Text className="text-base font-semibold" style={{ color: colors.text }}>{item.label}</Text>
            <Text className="text-sm" style={{ color: colors.textSecondary }}>{getSensorIcon(item.type)} {item.type}</Text>
          </View>
          <Badge text={item.status} variant={statusVariant(item.status)} />
        </View>
        <View className="flex-row gap-4">
          <View className="flex-row items-center gap-1">
            <Ionicons name="grid-outline" size={14} color={colors.textMuted} />
            <Text className="text-sm" style={{ color: colors.textSecondary }}>{item.plotName}</Text>
          </View>
          {item.batteryLevel != null && (
            <View className="flex-row items-center gap-1">
              <Ionicons
                name={item.batteryLevel > 20 ? 'battery-half-outline' : 'battery-dead-outline'}
                size={14}
                color={item.batteryLevel > 20 ? colors.textMuted : colors.statusDanger}
              />
              <Text className="text-sm" style={{ color: colors.textSecondary }}>{item.batteryLevel}%</Text>
            </View>
          )}
        </View>
        <View className="flex-row items-center justify-between mt-2">
          <Text className="text-xs" style={{ color: colors.textMuted }}>
            Installed: {formatDate(item.installedAt)}
          </Text>
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => handleChangeStatus(item)}
              hitSlop={8}
            >
              <Ionicons name="swap-horizontal-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(app)/(sensors)/history', params: { id: item.id, label: item.label } })}
              hitSlop={8}
            >
              <Ionicons name="analytics-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="px-4 pt-2 pb-2 flex-row items-center justify-between">
        <Text className="text-2xl font-bold" style={{ color: colors.text }}>Sensors</Text>
        <View className="flex-row gap-2">
          <Button
            title="Live"
            onPress={() => router.push('/(app)/(sensors)/monitoring')}
            size="sm"
            variant="outline"
            icon={<Ionicons name="pulse" size={16} color={isDark ? colors.primaryLight : colors.primary} />}
          />
          <Button
            title="Add"
            onPress={() => router.push({ pathname: '/(app)/(sensors)/[id]', params: { id: 'new' } })}
            size="sm"
            icon={<Ionicons name="add" size={18} color="#fff" />}
          />
        </View>
      </View>

      <View className="px-4">
        <SearchBar value={search} onChangeText={(value) => { setSearch(value); setPage(1); }} placeholder="Search sensors..." />
        <SortControl
          options={[
            { value: 'installedAt', label: 'Installed' },
            { value: 'label', label: 'Name' },
            { value: 'type', label: 'Type' },
            { value: 'status', label: 'Status' },
          ]}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSortChange={(sb, sd) => { setSortBy(sb); setSortDirection(sd); setPage(1); }}
        />
      </View>

      <FilterChips options={STATUS_OPTIONS} value={statusFilter} onChange={(value) => { setStatusFilter(value); setPage(1); }} />

      {isLoading ? (
        <LoadingOverlay />
      ) : sensors.length === 0 ? (
        <EmptyState icon="hardware-chip-outline" title="No Sensors" message="Create your first sensor" />
      ) : (
        <FlatList
          data={sensors}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerClassName="px-4 pb-4"
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />
          }
          ListFooterComponent={
            <PaginationControls
              pageNumber={data?.pageNumber || page}
              pageSize={data?.pageSize || 10}
              totalCount={data?.totalCount || 0}
              hasPreviousPage={Boolean(data?.hasPreviousPage)}
              hasNextPage={Boolean(data?.hasNextPage)}
              isLoading={isRefetching}
              onPrevious={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => {
                if (data?.hasNextPage) setPage((p) => p + 1);
              }}
              onPageChange={(nextPage) => setPage(nextPage)}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
