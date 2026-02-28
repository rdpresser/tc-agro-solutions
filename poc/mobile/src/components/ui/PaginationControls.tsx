import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/providers/theme-provider';

type PaginationControlsProps = {
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  isLoading?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onPageChange: (page: number) => void;
};

function buildVisiblePages(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages]);
  pages.add(Math.max(1, currentPage - 1));
  pages.add(currentPage);
  pages.add(Math.min(totalPages, currentPage + 1));

  return Array.from(pages).sort((a, b) => a - b);
}

export function PaginationControls({
  pageNumber,
  pageSize,
  totalCount,
  hasPreviousPage,
  hasNextPage,
  isLoading = false,
  onPrevious,
  onNext,
  onPageChange,
}: PaginationControlsProps) {
  const { colors } = useTheme();
  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / Math.max(1, pageSize || 1)));
  const currentPage = Math.min(Math.max(1, pageNumber || 1), totalPages);
  const visiblePages = buildVisiblePages(currentPage, totalPages);

  return (
    <View className="mt-2 px-1">
      <Text className="text-sm text-center mb-2" style={{ color: colors.textSecondary }}>
        Page {currentPage} of {totalPages}
      </Text>

      <View className="flex-row items-center justify-between mb-2">
        <Button
          title="Previous"
          size="sm"
          variant="outline"
          onPress={onPrevious}
          disabled={!hasPreviousPage || isLoading}
        />
        <Button
          title="Next"
          size="sm"
          variant="outline"
          onPress={onNext}
          disabled={!hasNextPage || isLoading}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
        {visiblePages.map((page) => {
          const selected = page === currentPage;
          return (
            <TouchableOpacity
              key={page}
              onPress={() => onPageChange(page)}
              disabled={selected || isLoading}
              className="px-3 py-1.5 rounded-full border"
              style={selected
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: colors.chipBg, borderColor: colors.border }}
            >
              <Text style={{ color: selected ? '#ffffff' : colors.textSecondary, fontWeight: '600' }}>
                {page}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
