import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '@/api/alerts.api';
import { useOwnerScope } from '@/hooks/use-owner-scope';
import type { Alert, AlertSummary } from '@/types';

export function useAlertsPending(params?: { severity?: string; search?: string }) {
  const ownerId = useOwnerScope();
  const scopedParams = { ...params, ...(ownerId ? { ownerId } : {}) };
  return useQuery({
    queryKey: ['alerts', 'pending', scopedParams],
    queryFn: () => alertsApi.getPending(scopedParams),
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    retry: 2,
  });
}

export function useAlertsResolved(params?: { severity?: string; search?: string }) {
  const ownerId = useOwnerScope();
  const scopedParams = { ...params, ...(ownerId ? { ownerId } : {}) };
  return useQuery({
    queryKey: ['alerts', 'resolved', scopedParams],
    queryFn: () => alertsApi.getResolved(scopedParams),
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    retry: 2,
  });
}

export function useAlertsAll(params?: { severity?: string; search?: string; status?: string }) {
  const ownerId = useOwnerScope();
  const scopedParams = { ...params, ...(ownerId ? { ownerId } : {}) };
  return useQuery({
    queryKey: ['alerts', 'all', scopedParams],
    queryFn: () => alertsApi.getAll(scopedParams),
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    retry: 2,
  });
}

export function useAlertsSummary(windowHours = 24) {
  const ownerId = useOwnerScope();
  return useQuery<AlertSummary | null>({
    queryKey: ['alerts', 'summary', windowHours, ownerId],
    queryFn: () => alertsApi.getSummary(windowHours, ownerId),
    staleTime: 0,
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
    onMutate: async ({ id }) => {
      // Cancel outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: ['alerts'] });

      // Optimistic: move alert from pending to resolved in cache
      queryClient.setQueriesData<Alert[]>(
        { queryKey: ['alerts', 'pending'] },
        (old) => old?.filter((a) => a.id !== id),
      );
      queryClient.setQueriesData<Alert[]>(
        { queryKey: ['alerts', 'all'] },
        (old) => old?.map((a) => a.id === id ? { ...a, status: 'Resolved' as const, resolvedAt: new Date().toISOString() } : a),
      );
    },
    onSettled: () => {
      // Always refetch after mutation settles (success or error)
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
