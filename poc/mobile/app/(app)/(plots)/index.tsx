import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePlots } from '@/hooks/queries/use-plots';
import { useOwners } from '@/hooks/queries/use-owners';
import { useAuthStore } from '@/stores/auth.store';
import { useDashboardOwnerFilterStore } from '@/stores/dashboard-owner-filter.store';
import { useTheme } from '@/providers/theme-provider';
import { SearchBar } from '@/components/ui/SearchBar';
import { SortControl } from '@/components/ui/SortControl';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { EmptyState } from '@/components/ui/EmptyState';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { formatArea, formatDate } from '@/lib/format';
import { getCropIcon } from '@/constants/crop-types';
import type { Plot } from '@/types';

const statusVariant = (s: string) => {
  switch (s?.toLowerCase()) {
    case 'active': return 'success';
    case 'harvested': return 'info';
    case 'fallow': return 'warning';
    default: return 'secondary';
  }
};

export default function PlotsListScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const selectedOwnerId = useDashboardOwnerFilterStore((s) => s.selectedOwnerId);
  const setSelectedOwnerId = useDashboardOwnerFilterStore((s) => s.setSelectedOwnerId);
  const { data: owners = [] } = useOwners();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading, isRefetching, refetch } = usePlots({
    pageNumber: page,
    pageSize: 10,
    filter: search || undefined,
    status: statusFilter || undefined,
    sortBy,
    sortDirection,
    ...(isAdmin && selectedOwnerId ? { ownerId: selectedOwnerId } : {}),
  });

  React.useEffect(() => {
    if (!isAdmin) return;
    if (selectedOwnerId) return;
    if (owners.length === 0) return;
    setSelectedOwnerId(owners[0].id);
  }, [isAdmin, selectedOwnerId, owners, setSelectedOwnerId]);

  const ownerOptions = [
    { value: '', label: 'All owners' },
    ...owners.map((owner) => ({
      value: owner.id,
      label: `${owner.name}${owner.email ? ` - ${owner.email}` : ''}`,
    })),
  ];

  const plots = data?.items || [];

  // Status filter chips
  const statuses = ['', 'Active', 'Harvested', 'Fallow', 'Preparing'];

  const renderItem = ({ item }: { item: Plot }) => (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/(app)/(plots)/[id]', params: { id: item.id } })}
      activeOpacity={0.7}
    >
      <Card className="mb-3">
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1">
            <Text className="text-base font-semibold" style={{ color: colors.text }}>{item.name}</Text>
            <Text className="text-sm" style={{ color: colors.textSecondary }}>{item.propertyName}</Text>
          </View>
          <Badge text={item.status || 'Unknown'} variant={statusVariant(item.status)} />
        </View>

        <View className="flex-row flex-wrap gap-3">
          <View className="flex-row items-center gap-1">
            <Text className="text-sm">{getCropIcon(item.cropType)}</Text>
            <Text className="text-sm" style={{ color: colors.textSecondary }}>{item.cropType}</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="resize-outline" size={14} color={colors.textMuted} />
            <Text className="text-sm" style={{ color: colors.textSecondary }}>{formatArea(item.areaHectares)}</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="hardware-chip-outline" size={14} color={colors.textMuted} />
            <Text className="text-sm" style={{ color: colors.textSecondary }}>{item.sensorsCount} sensors</Text>
          </View>
        </View>

        {item.plantingDate && (
          <Text className="text-xs mt-2" style={{ color: colors.textMuted }}>
            Planted: {formatDate(item.plantingDate)}
          </Text>
        )}

        <View className="flex-row justify-end mt-2">
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="px-4 pt-2 pb-2 flex-row items-center justify-between">
        <Text className="text-2xl font-bold" style={{ color: colors.text }}>Plots</Text>
        <Button
          title="Add"
          onPress={() => router.push({ pathname: '/(app)/(plots)/[id]', params: { id: 'new' } })}
          size="sm"
          icon={<Ionicons name="add" size={18} color="#fff" />}
        />
      </View>

      <View className="px-4">
        {isAdmin && (
          <Select
            label="Owner scope"
            placeholder="Select owner scope"
            options={ownerOptions}
            value={selectedOwnerId || ''}
            onChange={(value) => {
              setSelectedOwnerId(value || null);
              setPage(1);
            }}
          />
        )}

        <SearchBar value={search} onChangeText={(value) => { setSearch(value); setPage(1); }} placeholder="Search plots..." />
        <SortControl
          options={[
            { value: 'name', label: 'Name' },
            { value: 'cropType', label: 'Crop Type' },
            { value: 'areaHectares', label: 'Area' },
            { value: 'plantingDate', label: 'Planting Date' },
            { value: 'status', label: 'Status' },
          ]}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSortChange={(sb, sd) => { setSortBy(sb); setSortDirection(sd); setPage(1); }}
        />
        <ScrollableChips
          items={statuses}
          selected={statusFilter}
          onSelect={(value) => { setStatusFilter(value); setPage(1); }}
        />
      </View>

      {isLoading ? (
        <LoadingOverlay />
      ) : plots.length === 0 ? (
        <EmptyState icon="grid-outline" title="No Plots" message="Create your first plot" />
      ) : (
        <FlatList
          data={plots}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerClassName="px-4 pb-4"
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor="#2d5016" />
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

function ScrollableChips({ items, selected, onSelect }: { items: string[]; selected: string; onSelect: (v: string) => void }) {
  const { colors } = useTheme();
  return (
    <View className="flex-row flex-wrap gap-2 mb-3">
      {items.map((item) => (
        <TouchableOpacity
          key={item || 'all'}
          onPress={() => onSelect(item)}
          className={`px-3 py-1.5 rounded-full ${selected !== item ? 'border' : ''}`}
          style={selected === item
            ? { backgroundColor: colors.primary }
            : { backgroundColor: colors.chipBg, borderColor: colors.border }
          }
        >
          <Text className="text-sm font-medium" style={{ color: selected === item ? '#ffffff' : colors.textSecondary }}>
            {item || 'All'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
