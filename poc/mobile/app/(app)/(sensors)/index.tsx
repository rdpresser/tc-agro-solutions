import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert as RNAlert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSensors, useDeleteSensor } from '@/hooks/queries/use-sensors';
import { useTheme } from '@/providers/theme-provider';
import { SENSOR_STATUSES } from '@/constants/crop-types';
import { SearchBar } from '@/components/ui/SearchBar';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatDate } from '@/lib/format';
import type { Sensor } from '@/types';

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
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data, isLoading, isRefetching, refetch } = useSensors({
    pageSize: 50,
    filter: search || undefined,
  });
  const deleteMutation = useDeleteSensor();

  const sensors = data?.items || [];

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget, {
      onSuccess: () => { setDeleteTarget(null); },
      onError: () => { setDeleteTarget(null); RNAlert.alert('Error', 'Failed to delete'); },
    });
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
            <Text className="text-sm" style={{ color: colors.textSecondary }}>{item.type}</Text>
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
                color={item.batteryLevel > 20 ? colors.textMuted : '#dc3545'}
              />
              <Text className="text-sm" style={{ color: colors.textSecondary }}>{item.batteryLevel}%</Text>
            </View>
          )}
        </View>
        <View className="flex-row items-center justify-between mt-2">
          <Text className="text-xs" style={{ color: colors.textMuted }}>
            Installed: {formatDate(item.installedAt)}
          </Text>
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
        <Text className="text-2xl font-bold" style={{ color: colors.text }}>Sensors</Text>
        <View className="flex-row gap-2">
          <Button
            title="Live"
            onPress={() => router.push('/(app)/(sensors)/monitoring')}
            size="sm"
            variant="outline"
            icon={<Ionicons name="pulse" size={16} color="#2d5016" />}
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
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search sensors..." />
      </View>

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
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor="#2d5016" />
          }
        />
      )}

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Delete Sensor"
        message="Are you sure? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />
    </SafeAreaView>
  );
}
