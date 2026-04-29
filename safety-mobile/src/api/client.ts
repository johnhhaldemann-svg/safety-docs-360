import axios from "axios";
import * as SecureStore from "expo-secure-store";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://safety360docs.com/api/mobile";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error?.response?.data as { error?: unknown; message?: unknown } | undefined;
    const message = data?.error ?? data?.message;
    if (typeof message === "string" && message.trim()) {
      const apiError = new Error(message) as Error & { status?: number };
      apiError.status = error?.response?.status;
      return Promise.reject(apiError);
    }
    if (error?.response?.status) {
      const apiError = new Error(`API returned ${error.response.status}.`) as Error & { status?: number };
      apiError.status = error.response.status;
      return Promise.reject(apiError);
    }
    return Promise.reject(error);
  }
);
