import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

type WizardStep = 1 | 2 | 3;

interface WizardState {
  wizardStep: WizardStep;
  createdPropertyId: string | null;
  createdPlotId: string | null;
}

interface OnboardingState {
  hasCompletedOnboarding: boolean;
  isWizardActive: boolean;
  wizardStep: WizardStep;
  createdPropertyId: string | null;
  createdPlotId: string | null;
  isHydrated: boolean;

  hydrate: () => Promise<void>;
  startWizard: () => Promise<void>;
  advanceToStep2: (propertyId: string) => Promise<void>;
  advanceToStep3: (plotId: string) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
}

const COMPLETED_KEY = 'agro_onboarding_completed';
const WIZARD_KEY = 'agro_wizard_state';

async function persistWizardState(state: WizardState | null) {
  if (state) {
    await AsyncStorage.setItem(WIZARD_KEY, JSON.stringify(state));
  } else {
    await AsyncStorage.removeItem(WIZARD_KEY);
  }
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  hasCompletedOnboarding: false,
  isWizardActive: false,
  wizardStep: 1,
  createdPropertyId: null,
  createdPlotId: null,
  isHydrated: false,

  hydrate: async () => {
    const completed = await AsyncStorage.getItem(COMPLETED_KEY);
    if (completed === 'true') {
      set({ hasCompletedOnboarding: true, isWizardActive: false, isHydrated: true });
      return;
    }

    const wizardJson = await AsyncStorage.getItem(WIZARD_KEY);
    if (wizardJson) {
      try {
        const wizard: WizardState = JSON.parse(wizardJson);
        set({
          isWizardActive: true,
          wizardStep: wizard.wizardStep,
          createdPropertyId: wizard.createdPropertyId,
          createdPlotId: wizard.createdPlotId,
          isHydrated: true,
        });
        return;
      } catch {
        await AsyncStorage.removeItem(WIZARD_KEY);
      }
    }

    set({ isHydrated: true });
  },

  startWizard: async () => {
    const state: WizardState = { wizardStep: 1, createdPropertyId: null, createdPlotId: null };
    await persistWizardState(state);
    set({ isWizardActive: true, wizardStep: 1, createdPropertyId: null, createdPlotId: null });
  },

  advanceToStep2: async (propertyId: string) => {
    const state: WizardState = { wizardStep: 2, createdPropertyId: propertyId, createdPlotId: null };
    await persistWizardState(state);
    set({ wizardStep: 2, createdPropertyId: propertyId });
  },

  advanceToStep3: async (plotId: string) => {
    const state: WizardState = { wizardStep: 3, createdPropertyId: null, createdPlotId: plotId };
    await persistWizardState(state);
    set({ wizardStep: 3, createdPlotId: plotId });
  },

  completeOnboarding: async () => {
    await AsyncStorage.setItem(COMPLETED_KEY, 'true');
    await AsyncStorage.removeItem(WIZARD_KEY);
    set({ hasCompletedOnboarding: true, isWizardActive: false });
  },

  skipOnboarding: async () => {
    await AsyncStorage.setItem(COMPLETED_KEY, 'true');
    await AsyncStorage.removeItem(WIZARD_KEY);
    set({ hasCompletedOnboarding: true, isWizardActive: false });
  },
}));
