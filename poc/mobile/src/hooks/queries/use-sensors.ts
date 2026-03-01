import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sensorsApi } from '@/api/sensors.api';
import { useOwnerScope } from '@/hooks/use-owner-scope';
import type { PaginatedRequest, CreateSensorRequest } from '@/types';

export function useSensors(params?: PaginatedRequest & { type?: string; status?: string; propertyId?: string; plotId?: string; ownerId?: string }) {
  const ownerScopeId = useOwnerScope();
  const ownerId = ownerScopeId || params?.ownerId;
  const scopedParams = { ...params, ...(ownerId ? { ownerId } : {}) };
  return useQuery({
    queryKey: ['sensors', scopedParams],
    queryFn: () => sensorsApi.list(scopedParams),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    retry: 2,
  });
}

export function useSensor(id: string) {
  return useQuery({
    queryKey: ['sensors', id],
    queryFn: () => sensorsApi.getById(id),
    enabled: !!id,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
  });
}

export function useSensorReadings(sensorId: string, days = 7) {
  return useQuery({
    queryKey: ['sensor-readings', sensorId, days],
    queryFn: () => sensorsApi.getReadings(sensorId, days),
    enabled: !!sensorId,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
  });
}

export function useCreateSensor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSensorRequest) =>
      sensorsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sensors'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useChangeSensorStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { newStatus: string; reason?: string } }) =>
      sensorsApi.changeStatus(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sensors'] });
      queryClient.invalidateQueries({ queryKey: ['sensor-readings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteSensor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sensorsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sensors'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
