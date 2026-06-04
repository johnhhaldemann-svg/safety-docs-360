import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export const ACCESS_TOKEN_KEY = "access_token";
export const REFRESH_TOKEN_KEY = "refresh_token";

const webMemoryStorage = new Map<string, string>();

function webLocalStorage() {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export async function getStoredToken(key: string) {
  if (Platform.OS === "web") {
    return webLocalStorage()?.getItem(key) ?? webMemoryStorage.get(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

export async function setStoredToken(key: string, value: string) {
  if (Platform.OS === "web") {
    const storage = webLocalStorage();
    if (storage) storage.setItem(key, value);
    else webMemoryStorage.set(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteStoredToken(key: string) {
  if (Platform.OS === "web") {
    webLocalStorage()?.removeItem(key);
    webMemoryStorage.delete(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
