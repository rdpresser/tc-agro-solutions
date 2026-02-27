import { create } from 'zustand';
import type { SensorReading, Alert } from '@/types';

interface RealtimeState {
  latestReadings: Map<string, SensorReading>;
  recentAlerts: Alert[];

  updateReading: (reading: SensorReading) => void;
  setReadings: (readings: SensorReading[]) => void;
  addAlert: (alert: Alert) => void;
  updateAlert: (alert: Alert) => void;
  setAlerts: (alerts: Alert[]) => void;
  clearReadings: () => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  latestReadings: new Map(),
  recentAlerts: [],

  updateReading: (reading) =>
    set((state) => {
      const map = new Map(state.latestReadings);
      map.set(reading.sensorId, reading);
      return { latestReadings: map };
    }),

  setReadings: (readings) =>
    set(() => {
      const map = new Map<string, SensorReading>();
      readings.forEach((r) => map.set(r.sensorId, r));
      return { latestReadings: map };
    }),

  addAlert: (alert) =>
    set((state) => ({
      recentAlerts: [alert, ...state.recentAlerts].slice(0, 50),
    })),

  updateAlert: (alert) =>
    set((state) => ({
      recentAlerts: state.recentAlerts.map((a) =>
        a.id === alert.id ? { ...a, ...alert } : a
      ),
    })),

  setAlerts: (alerts) => set({ recentAlerts: alerts }),

  clearReadings: () => set({ latestReadings: new Map() }),
}));
