import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/dashboard.api';
import { propertiesApi } from '@/api/properties.api';
import { plotsApi } from '@/api/plots.api';
import { sensorsApi } from '@/api/sensors.api';
import { alertsApi } from '@/api/alerts.api';
import type { DashboardStats } from '@/types';

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const [properties, plots, sensors, alerts] = await Promise.all([
        propertiesApi.list({ pageSize: 1 }),
        plotsApi.list({ pageSize: 1 }),
        sensorsApi.list({ pageSize: 1 }),
        alertsApi.getPending(),
      ]);
      return {
        propertiesCount: properties.totalCount,
        plotsCount: plots.totalCount,
        sensorsCount: sensors.totalCount,
        alertsCount: alerts.length,
      };
    },
    staleTime: 60 * 1000,
  });
}

export function useLatestReadings(limit = 10) {
  return useQuery({
    queryKey: ['dashboard', 'latest-readings', limit],
    queryFn: () => dashboardApi.getLatestReadings(limit),
    refetchInterval: 30000,
  });
}

export function usePendingAlerts() {
  return useQuery({
    queryKey: ['alerts', 'pending'],
    queryFn: () => alertsApi.getPending(),
    refetchInterval: 30000,
  });
}
