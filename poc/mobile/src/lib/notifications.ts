import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Alert } from '@/types';

const NOTIFICATIONS_ENABLED_KEY = 'agro_notifications_enabled';

let Notifications: typeof import('expo-notifications') | null = null;

try {
  Notifications = require('expo-notifications');
} catch {
  // Native module not available (e.g. Expo Go without native rebuild)
}

function isAvailable(): boolean {
  return Notifications != null;
}

export function setupNotificationHandler() {
  if (!isAvailable()) return;

  try {
    Notifications!.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === 'android') {
      Notifications!.setNotificationChannelAsync('alerts', {
        name: 'Farm Alerts',
        importance: Notifications!.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
    }
  } catch {
    // graceful fallback
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isAvailable()) return false;

  try {
    const { status: existing } = await Notifications!.getPermissionsAsync();
    if (existing === 'granted') return true;

    const { status } = await Notifications!.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function isNotificationsEnabled(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
  return stored !== 'false'; // default true
}

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, String(enabled));
}

const severityTitles: Record<string, string> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  warning: 'Warning',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
};

export async function triggerAlertNotification(alert: Alert): Promise<void> {
  if (!isAvailable()) return;

  try {
    const enabled = await isNotificationsEnabled();
    if (!enabled) return;

    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return;

    const prefix = severityTitles[alert.severity] || alert.severity;

    await Notifications!.scheduleNotificationAsync({
      content: {
        title: `[${prefix}] ${alert.title}`,
        body: alert.message,
        data: { alertId: alert.id },
        ...(Platform.OS === 'android' ? { channelId: 'alerts' } : {}),
      },
      trigger: null, // immediate
    });
  } catch {
    // graceful fallback — toast will still show
  }
}
