import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plotsApi } from '@/api/plots.api';
import type { PaginatedRequest, CreatePlotRequest } from '@/types';

export function usePlots(params?: PaginatedRequest & { propertyId?: string; cropType?: string; status?: string }) {
  return useQuery({
    queryKey: ['plots', params],
    queryFn: () => plotsApi.list(params),
  });
}

export function usePlot(id: string) {
  return useQuery({
    queryKey: ['plots', id],
    queryFn: () => plotsApi.getById(id),
    enabled: !!id,
  });
}

export function useCreatePlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePlotRequest) => plotsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plots'] });
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
    },
  });
}

export function useDeletePlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => plotsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plots'] });
    },
  });
}
