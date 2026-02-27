import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/dashboard.api';
import { propertiesApi } from '@/api/properties.api';
import { plotsApi } from '@/api/plots.api';
import { sensorsApi } from '@/api/sensors.api';
import { alertsApi } from '@/api/alerts.api';
import { useOwnerScope } from '@/hooks/use-owner-scope';
import type { DashboardStats } from '@/types';

export function useDashboardStats() {
  const ownerId = useOwnerScope();
  const ownerParam = ownerId ? { ownerId } : {};
  return useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats', ownerId],
    queryFn: async () => {
      const [properties, plots, sensors, alerts] = await Promise.all([
        propertiesApi.list({ pageSize: 1, ...ownerParam }),
        plotsApi.list({ pageSize: 1, ...ownerParam }),
        sensorsApi.list({ pageSize: 1, ...ownerParam }),
        alertsApi.getPending({ ...ownerParam }),
      ]);
      return {
        propertiesCount: properties.totalCount,
        plotsCount: plots.totalCount,
        sensorsCount: sensors.totalCount,
        alertsCount: alerts.length,
      };
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 2,
  });
}

export function useLatestReadings(limit = 10) {
  const ownerId = useOwnerScope();
  return useQuery({
    queryKey: ['dashboard', 'latest-readings', limit, ownerId],
    queryFn: () => dashboardApi.getLatestReadings(limit, ownerId),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    retry: 2,
  });
}

export function usePendingAlerts() {
  const ownerId = useOwnerScope();
  return useQuery({
    queryKey: ['alerts', 'pending', 'dashboard', ownerId],
    queryFn: () => alertsApi.getPending({ pageNumber: 1, pageSize: 200, ...(ownerId ? { ownerId } : {}) }),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    retry: 2,
  });
}
