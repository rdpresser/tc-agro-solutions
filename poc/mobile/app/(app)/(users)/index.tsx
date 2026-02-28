import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert as RNAlert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUsers, useDeleteUser } from '@/hooks/queries/use-users';
import { useAuthStore } from '@/stores/auth.store';
import { useTheme } from '@/providers/theme-provider';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SearchBar } from '@/components/ui/SearchBar';
import { SortControl } from '@/components/ui/SortControl';
import { PaginationControls } from '@/components/ui/PaginationControls';
import type { User } from '@/types';

export default function UsersListScreen() {
  const { colors } = useTheme();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin';
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading, isRefetching, refetch } = useUsers({
    pageNumber: page,
    pageSize: 10,
    sortBy,
    sortDirection,
    filter: search || undefined,
  });
  const deleteMutation = useDeleteUser();

  const users = data?.items || [];

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget, {
      onSuccess: () => { setDeleteTarget(null); },
      onError: () => { setDeleteTarget(null); RNAlert.alert('Error', 'Failed to delete user'); },
    });
  };

  if (!isAdmin) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        <EmptyState
          icon="lock-closed-outline"
          title="Admin Only"
          message="User management is restricted to admin users."
        />
      </SafeAreaView>
    );
  }

  const renderItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/(app)/(users)/[id]', params: { id: item.id, email: item.email } })}
      activeOpacity={0.7}
    >
      <Card className="mb-3">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-full bg-primary/15 items-center justify-center">
            <Text className="text-primary font-bold text-lg">
              {item.name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="font-semibold" style={{ color: colors.text }}>{item.name}</Text>
              {item.id === currentUser?.id && (
                <Badge text="You" variant="primary" size="sm" />
              )}
            </View>
            <Text className="text-sm" style={{ color: colors.textSecondary }}>{item.email}</Text>
          </View>
          <View className="items-end gap-1">
            <Badge text={item.role} variant={item.role?.toLowerCase() === 'admin' ? 'primary' : 'secondary'} />
            <Badge
              text={item.isActive ? 'Active' : 'Inactive'}
              variant={item.isActive ? 'success' : 'secondary'}
            />
          </View>
        </View>
        {item.id !== currentUser?.id && (
          <View className="flex-row justify-end mt-2">
            <TouchableOpacity onPress={() => setDeleteTarget(item.id)} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={colors.statusDanger} />
            </TouchableOpacity>
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="px-4 pt-2 pb-2 flex-row items-center justify-between">
        <Text className="text-2xl font-bold" style={{ color: colors.text }}>Users</Text>
        <Button
          title="Add"
          onPress={() => router.push({ pathname: '/(app)/(users)/[id]', params: { id: 'new' } })}
          size="sm"
          icon={<Ionicons name="add" size={18} color="#fff" />}
        />
      </View>

      <View className="px-4">
        <SearchBar value={search} onChangeText={(value) => { setSearch(value); setPage(1); }} placeholder="Search users..." />
        <SortControl
          options={[
            { value: 'name', label: 'Name' },
            { value: 'email', label: 'Email' },
            { value: 'role', label: 'Role' },
          ]}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSortChange={(sb, sd) => { setSortBy(sb); setSortDirection(sd); setPage(1); }}
        />
      </View>

      {isLoading ? (
        <LoadingOverlay />
      ) : users.length === 0 ? (
        <EmptyState icon="people-outline" title="No Users" message={search ? 'No users match your search.' : undefined} />
      ) : (
        <FlatList
          data={users}
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

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Delete User"
        message="Are you sure you want to delete this user?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />
    </SafeAreaView>
  );
}
