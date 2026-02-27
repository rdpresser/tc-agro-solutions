import { useAuthStore } from '@/stores/auth.store';

/**
 * Returns the ownerId to scope API calls.
 * - Non-admin users: returns their user ID (from JWT `sub` claim)
 * - Admin users: returns undefined (sees everything)
 */
export function useOwnerScope(): string | undefined {
  const user = useAuthStore((s) => s.user);
  if (!user) return undefined;
  const isAdmin = user.role?.toLowerCase() === 'admin';
  return isAdmin ? undefined : user.id;
}
