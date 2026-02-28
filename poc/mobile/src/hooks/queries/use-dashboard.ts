import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/dashboard.api';
import { propertiesApi } from '@/api/properties.api';
import { plotsApi } from '@/api/plots.api';
import { sensorsApi } from '@/api/sensors.api';
import { alertsApi } from '@/api/alerts.api';
import { useOwnerScope } from '@/hooks/use-owner-scope';
import type { DashboardStats } from '@/types';

export function useDashboardStats(ownerIdOverride?: string) {
  const ownerScopeId = useOwnerScope();
  const ownerId = ownerIdOverride ?? ownerScopeId;
  const ownerParam = ownerId ? { ownerId } : {};
  return useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats', ownerId],
    queryFn: async () => {
      const [properties, plots, sensors, alertsSummary] = await Promise.all([
        propertiesApi.list({ pageSize: 1, ...ownerParam }),
        plotsApi.list({ pageSize: 1, ...ownerParam }),
        sensorsApi.list({ pageSize: 1, ...ownerParam }),
        alertsApi.getSummary(24, ownerId),
      ]);
      return {
        propertiesCount: properties.totalCount,
        plotsCount: plots.totalCount,
        sensorsCount: sensors.totalCount,
        alertsCount: Number(alertsSummary?.pendingAlertsTotal || 0),
      };
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 2,
  });
}

export function useLatestReadings(limit = 10, ownerIdOverride?: string) {
  const ownerScopeId = useOwnerScope();
  const ownerId = ownerIdOverride ?? ownerScopeId;
  return useQuery({
    queryKey: ['dashboard', 'latest-readings', limit, ownerId],
    queryFn: () => dashboardApi.getLatestReadings(limit, ownerId),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    retry: 2,
  });
}

export function usePendingAlerts(ownerIdOverride?: string) {
  const ownerScopeId = useOwnerScope();
  const ownerId = ownerIdOverride ?? ownerScopeId;
  return useQuery({
    queryKey: ['alerts', 'pending', 'dashboard', ownerId],
    queryFn: async () => {
      const page = await alertsApi.getPendingPage({ pageNumber: 1, pageSize: 20, ...(ownerId ? { ownerId } : {}) });
      return page.items;
    },
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    retry: 2,
  });
}
