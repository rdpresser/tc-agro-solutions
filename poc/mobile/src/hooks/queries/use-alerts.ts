import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '@/api/alerts.api';
import { useOwnerScope } from '@/hooks/use-owner-scope';
import type { AlertSummary, PaginatedResponse, Alert } from '@/types';

export function useAlertsPending(params?: { pageNumber?: number; pageSize?: number; severity?: string; search?: string }) {
  const ownerId = useOwnerScope();
  const scopedParams = { ...params, ...(ownerId ? { ownerId } : {}) };
  return useQuery<PaginatedResponse<Alert>>({
    queryKey: ['alerts', 'pending', scopedParams],
    queryFn: () => alertsApi.getPendingPage(scopedParams),
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    retry: 2,
  });
}

export function useAlertsResolved(params?: { pageNumber?: number; pageSize?: number; severity?: string; search?: string }) {
  const ownerId = useOwnerScope();
  const scopedParams = { ...params, ...(ownerId ? { ownerId } : {}) };
  return useQuery<PaginatedResponse<Alert>>({
    queryKey: ['alerts', 'resolved', scopedParams],
    queryFn: () => alertsApi.getResolvedPage(scopedParams),
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    retry: 2,
  });
}

export function useAlertsAll(params?: { pageNumber?: number; pageSize?: number; severity?: string; search?: string; status?: string }) {
  const ownerId = useOwnerScope();
  const scopedParams = { ...params, ...(ownerId ? { ownerId } : {}) };
  return useQuery<PaginatedResponse<Alert>>({
    queryKey: ['alerts', 'all', scopedParams],
    queryFn: () => alertsApi.getAllPage(scopedParams),
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    retry: 2,
  });
}

export function useAlertsSummary(windowHours = 24, ownerIdOverride?: string) {
  const ownerScopeId = useOwnerScope();
  const ownerId = ownerIdOverride ?? ownerScopeId;
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
    onSettled: () => {
      // Always refetch after mutation settles (success or error)
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
