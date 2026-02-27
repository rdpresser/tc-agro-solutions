import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'agro_token';
const USER_KEY = 'agro_user';

// SecureStore not available on web; fall back to AsyncStorage
const isWeb = Platform.OS === 'web';

export async function setToken(token: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

export async function getToken(): Promise<string | null> {
  if (isWeb) {
    return AsyncStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function deleteToken(): Promise<void> {
  if (isWeb) {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

export async function setUserData(user: object): Promise<void> {
  const json = JSON.stringify(user);
  if (isWeb) {
    await AsyncStorage.setItem(USER_KEY, json);
  } else {
    await SecureStore.setItemAsync(USER_KEY, json);
  }
}

export async function getUserData(): Promise<object | null> {
  let json: string | null;
  if (isWeb) {
    json = await AsyncStorage.getItem(USER_KEY);
  } else {
    json = await SecureStore.getItemAsync(USER_KEY);
  }
  return json ? JSON.parse(json) : null;
}

export async function deleteUserData(): Promise<void> {
  if (isWeb) {
    await AsyncStorage.removeItem(USER_KEY);
  } else {
    await SecureStore.deleteItemAsync(USER_KEY);
  }
}

export async function clearAll(): Promise<void> {
  await deleteToken();
  await deleteUserData();
}
