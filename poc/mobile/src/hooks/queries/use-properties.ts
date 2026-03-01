import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { propertiesApi } from '@/api/properties.api';
import { useOwnerScope } from '@/hooks/use-owner-scope';
import type { PaginatedRequest, CreatePropertyRequest, UpdatePropertyRequest } from '@/types';

export function useProperties(params?: PaginatedRequest & { ownerId?: string }) {
  const ownerScopeId = useOwnerScope();
  const ownerId = ownerScopeId || params?.ownerId;
  const scopedParams = { ...params, ...(ownerId ? { ownerId } : {}) };
  return useQuery({
    queryKey: ['properties', scopedParams],
    queryFn: () => propertiesApi.list(scopedParams),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    retry: 2,
  });
}

export function useProperty(id: string) {
  return useQuery({
    queryKey: ['properties', id],
    queryFn: () => propertiesApi.getById(id),
    enabled: !!id,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
  });
}

export function useCreateProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePropertyRequest) => propertiesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePropertyRequest }) =>
      propertiesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => propertiesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
