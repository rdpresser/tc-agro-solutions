import React, { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useOnboardingStore } from '@/stores/onboarding.store';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrateOnboarding = useOnboardingStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    hydrateOnboarding();
  }, [hydrate, hydrateOnboarding]);

  return <>{children}</>;
}
