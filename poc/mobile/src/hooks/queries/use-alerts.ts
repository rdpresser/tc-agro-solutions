import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '@/api/alerts.api';
import type { AlertSummary } from '@/types';

export function useAlertsPending(params?: { severity?: string; search?: string }) {
  return useQuery({
    queryKey: ['alerts', 'pending', params],
    queryFn: () => alertsApi.getPending(params),
    refetchInterval: 30000,
  });
}

export function useAlertsAll(params?: { severity?: string; search?: string; status?: string }) {
  return useQuery({
    queryKey: ['alerts', 'all', params],
    queryFn: () => alertsApi.getAll(params),
    refetchInterval: 30000,
  });
}

export function useAlertsSummary(windowHours = 24) {
  return useQuery<AlertSummary | null>({
    queryKey: ['alerts', 'summary', windowHours],
    queryFn: () => alertsApi.getSummary(windowHours),
    refetchInterval: 30000,
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
