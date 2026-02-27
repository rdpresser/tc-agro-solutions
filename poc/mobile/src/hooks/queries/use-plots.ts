import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plotsApi } from '@/api/plots.api';
import { useOwnerScope } from '@/hooks/use-owner-scope';
import type { PaginatedRequest, CreatePlotRequest } from '@/types';

export function usePlots(params?: PaginatedRequest & { propertyId?: string; cropType?: string; status?: string }) {
  const ownerId = useOwnerScope();
  const scopedParams = { ...params, ...(ownerId ? { ownerId } : {}) };
  return useQuery({
    queryKey: ['plots', scopedParams],
    queryFn: () => plotsApi.list(scopedParams),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    retry: 2,
  });
}

export function usePlot(id: string) {
  return useQuery({
    queryKey: ['plots', id],
    queryFn: () => plotsApi.getById(id),
    enabled: !!id,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
  });
}

export function useCreatePlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePlotRequest) => plotsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plots'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdatePlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreatePlotRequest> }) =>
      plotsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plots'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeletePlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => plotsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plots'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
