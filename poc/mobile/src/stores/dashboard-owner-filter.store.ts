import { create } from 'zustand';

interface DashboardOwnerFilterState {
  selectedOwnerId: string | null;
  setSelectedOwnerId: (ownerId: string | null) => void;
  clearSelectedOwnerId: () => void;
}

export const useDashboardOwnerFilterStore = create<DashboardOwnerFilterState>((set) => ({
  selectedOwnerId: null,
  setSelectedOwnerId: (ownerId) => set({ selectedOwnerId: ownerId }),
  clearSelectedOwnerId: () => set({ selectedOwnerId: null }),
}));
