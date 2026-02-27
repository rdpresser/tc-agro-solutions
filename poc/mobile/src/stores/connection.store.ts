import { create } from 'zustand';
import type { ConnectionState } from '@/types';

interface ConnectionStoreState {
  sensorHubState: ConnectionState;
  alertHubState: ConnectionState;
  isFallbackActive: boolean;

  setSensorHubState: (state: ConnectionState) => void;
  setAlertHubState: (state: ConnectionState) => void;
  setFallbackActive: (active: boolean) => void;
}

export const useConnectionStore = create<ConnectionStoreState>((set) => ({
  sensorHubState: 'disconnected',
  alertHubState: 'disconnected',
  isFallbackActive: false,

  setSensorHubState: (state) => set({ sensorHubState: state }),
  setAlertHubState: (state) => set({ alertHubState: state }),
  setFallbackActive: (active) => set({ isFallbackActive: active }),
}));
