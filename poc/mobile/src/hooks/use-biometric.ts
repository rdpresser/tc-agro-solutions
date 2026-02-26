import { useState, useEffect, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_ENABLED_KEY = 'agro_biometric_enabled';

export function useBiometric() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Biometric');

  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setIsAvailable(compatible && enrolled);

      if (compatible) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('Face ID');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('Fingerprint');
        }
      }

      const enabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      setIsEnabled(enabled === 'true');
    })();
  }, []);

  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to continue',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return result.success;
  }, [isAvailable]);

  const toggleBiometric = useCallback(async () => {
    const next = !isEnabled;
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, String(next));
    setIsEnabled(next);
  }, [isEnabled]);

  return { isAvailable, isEnabled, biometricType, authenticate, toggleBiometric };
}
