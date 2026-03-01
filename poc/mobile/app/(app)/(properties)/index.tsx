import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProperties } from '@/hooks/queries/use-properties';
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
import type { Property } from '@/types';

export default function PropertiesListScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const selectedOwnerId = useDashboardOwnerFilterStore((s) => s.selectedOwnerId);
  const setSelectedOwnerId = useDashboardOwnerFilterStore((s) => s.setSelectedOwnerId);
  const { data: owners = [] } = useOwners();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading, isRefetching, refetch } = useProperties({
    pageNumber: page,
    pageSize: 10,
    filter: search || undefined,
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

  const properties = data?.items || [];

  const renderItem = ({ item }: { item: Property }) => (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/(app)/(properties)/[id]', params: { id: item.id } })}
      activeOpacity={0.7}
    >
      <Card className="mb-3">
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1">
            <Text className="text-base font-semibold" style={{ color: colors.text }}>
              {item.name}
            </Text>
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              {item.ownerName}
            </Text>
          </View>
          <Badge
            text={item.isActive ? 'Active' : 'Inactive'}
            variant={item.isActive ? 'success' : 'secondary'}
          />
        </View>

        <View className="flex-row gap-4 mb-2">
          <View className="flex-row items-center gap-1">
            <Ionicons name="location-outline" size={14} color={colors.textMuted} />
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              {item.city}, {item.state}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="resize-outline" size={14} color={colors.textMuted} />
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              {formatArea(item.areaHectares)}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-1">
            <Ionicons name="grid-outline" size={14} color={colors.textMuted} />
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              {item.plotCount} plots
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="px-4 pt-2 pb-2 flex-row items-center justify-between">
        <Text className="text-2xl font-bold" style={{ color: colors.text }}>Properties</Text>
        <Button
          title="Add"
          onPress={() => router.push({ pathname: '/(app)/(properties)/[id]', params: { id: 'new' } })}
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

        <SearchBar value={search} onChangeText={(value) => { setSearch(value); setPage(1); }} placeholder="Search properties..." />
        <SortControl
          options={[
            { value: 'name', label: 'Name' },
            { value: 'ownerName', label: 'Owner' },
            { value: 'city', label: 'City' },
            { value: 'state', label: 'State' },
            { value: 'areaHectares', label: 'Area' },
            { value: 'createdAt', label: 'Created' },
          ]}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSortChange={(sb, sd) => { setSortBy(sb); setSortDirection(sd); setPage(1); }}
        />
      </View>

      {isLoading ? (
        <LoadingOverlay />
      ) : properties.length === 0 ? (
        <EmptyState
          icon="business-outline"
          title="No Properties"
          message="Create your first property to get started"
        />
      ) : (
        <FlatList
          data={properties}
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
