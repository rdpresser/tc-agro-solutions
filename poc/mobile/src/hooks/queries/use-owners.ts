import { useQuery } from '@tanstack/react-query';
import { ownersApi } from '@/api/owners.api';

export function useOwners() {
  return useQuery({
    queryKey: ['owners'],
    queryFn: () => ownersApi.list(),
    staleTime: 5 * 60 * 1000,
  });
}
