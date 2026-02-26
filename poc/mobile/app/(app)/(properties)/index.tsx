import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProperties, useDeleteProperty } from '@/hooks/queries/use-properties';
import { useTheme } from '@/providers/theme-provider';
import { SearchBar } from '@/components/ui/SearchBar';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatArea, formatDate } from '@/lib/format';
import type { Property } from '@/types';

export default function PropertiesListScreen() {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data, isLoading, isRefetching, refetch } = useProperties({
    pageNumber: page,
    pageSize: 20,
    filter: search || undefined,
  });

  const deleteMutation = useDeleteProperty();

  const properties = data?.items || [];

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget, {
      onSuccess: () => {
        setDeleteTarget(null);
        Alert.alert('Success', 'Property deleted successfully');
      },
      onError: () => {
        setDeleteTarget(null);
        Alert.alert('Error', 'Failed to delete property');
      },
    });
  }, [deleteTarget, deleteMutation]);

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
          <TouchableOpacity
            onPress={() => setDeleteTarget(item.id)}
            hitSlop={8}
          >
            <Ionicons name="trash-outline" size={18} color="#dc3545" />
          </TouchableOpacity>
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
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search properties..." />
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
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor="#2d5016" />
          }
          onEndReached={() => {
            if (data?.hasNextPage) setPage((p) => p + 1);
          }}
          onEndReachedThreshold={0.5}
        />
      )}

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Delete Property"
        message="Are you sure? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />
    </SafeAreaView>
  );
}
