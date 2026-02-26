import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '@/api/alerts.api';

export function useAlertsPending() {
  return useQuery({
    queryKey: ['alerts', 'pending'],
    queryFn: () => alertsApi.getPending(),
    refetchInterval: 30000,
  });
}

export function useAlertsAll() {
  return useQuery({
    queryKey: ['alerts', 'all'],
    queryFn: () => alertsApi.getAll(),
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => alertsApi.resolve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
