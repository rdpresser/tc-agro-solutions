import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '@/api/alerts.api';
import type { AlertSummary } from '@/types';

export function useAlertsPending(params?: { severity?: string; search?: string }) {
  return useQuery({
    queryKey: ['alerts', 'pending', params],
    queryFn: () => alertsApi.getPending(params),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    retry: 2,
  });
}

export function useAlertsAll(params?: { severity?: string; search?: string; status?: string }) {
  return useQuery({
    queryKey: ['alerts', 'all', params],
    queryFn: () => alertsApi.getAll(params),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    retry: 2,
  });
}

export function useAlertsSummary(windowHours = 24) {
  return useQuery<AlertSummary | null>({
    queryKey: ['alerts', 'summary', windowHours],
    queryFn: () => alertsApi.getSummary(windowHours),
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    retry: 2,
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      alertsApi.resolve(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
