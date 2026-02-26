import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sensorsApi } from '@/api/sensors.api';
import type { PaginatedRequest } from '@/types';

export function useSensors(params?: PaginatedRequest & { type?: string; status?: string; propertyId?: string; plotId?: string }) {
  return useQuery({
    queryKey: ['sensors', params],
    queryFn: () => sensorsApi.list(params),
  });
}

export function useSensor(id: string) {
  return useQuery({
    queryKey: ['sensors', id],
    queryFn: () => sensorsApi.getById(id),
    enabled: !!id,
  });
}

export function useSensorReadings(sensorId: string, days = 7) {
  return useQuery({
    queryKey: ['sensor-readings', sensorId, days],
    queryFn: () => sensorsApi.getReadings(sensorId, days),
    enabled: !!sensorId,
  });
}

export function useCreateSensor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { label: string; type: string; plotId: string }) =>
      sensorsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sensors'] });
    },
  });
}

export function useDeleteSensor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sensorsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sensors'] });
    },
  });
}
