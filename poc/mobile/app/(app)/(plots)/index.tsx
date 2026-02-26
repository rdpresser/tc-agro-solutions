import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert as RNAlert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePlots, useDeletePlot } from '@/hooks/queries/use-plots';
import { useTheme } from '@/providers/theme-provider';
import { SearchBar } from '@/components/ui/SearchBar';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatArea, formatDate } from '@/lib/format';
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data, isLoading, isRefetching, refetch } = usePlots({
    pageSize: 50,
    filter: search || undefined,
    status: statusFilter || undefined,
  });
  const deleteMutation = useDeletePlot();

  const plots = data?.items || [];

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget, {
      onSuccess: () => { setDeleteTarget(null); RNAlert.alert('Deleted'); },
      onError: () => { setDeleteTarget(null); RNAlert.alert('Error', 'Failed to delete'); },
    });
  };

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
            <Ionicons name="leaf-outline" size={14} color={colors.textMuted} />
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
          <TouchableOpacity onPress={() => setDeleteTarget(item.id)} hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color="#dc3545" />
          </TouchableOpacity>
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
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search plots..." />
        <ScrollableChips
          items={statuses}
          selected={statusFilter}
          onSelect={setStatusFilter}
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
        />
      )}

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Delete Plot"
        message="Are you sure? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />
    </SafeAreaView>
  );
}

function ScrollableChips({ items, selected, onSelect }: { items: string[]; selected: string; onSelect: (v: string) => void }) {
  return (
    <View className="flex-row flex-wrap gap-2 mb-3">
      {items.map((item) => (
        <TouchableOpacity
          key={item || 'all'}
          onPress={() => onSelect(item)}
          className={`px-3 py-1.5 rounded-full border ${
            selected === item ? 'bg-primary border-primary' : 'bg-white border-gray-300'
          }`}
        >
          <Text className={selected === item ? 'text-white text-sm font-medium' : 'text-gray-600 text-sm'}>
            {item || 'All'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
