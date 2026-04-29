import axios from "axios";
import * as SecureStore from "expo-secure-store";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://safety360docs.com/api/mobile";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000
});

export function getApiErrorStatus(error: unknown) {
  if (typeof error === "object" && error && "status" in error && typeof (error as { status?: unknown }).status === "number") {
    return (error as { status: number }).status;
  }
  return null;
}

export function getFriendlyApiError(error: unknown, fallback = "Something went wrong. Check your connection and try again.") {
  if (error instanceof Error && error.message.trim()) {
    if (error.message.includes("Network Error")) return "Could not reach Safety360 Docs. Check your internet connection.";
    if (error.message.includes("timeout")) return "The request took too long. Try again with a stronger connection.";
    if (error.message.includes("API returned 401")) return "Your session expired. Sign in again.";
    return error.message;
  }
  return fallback;
}

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
      if (apiError.status === 401) {
        void SecureStore.deleteItemAsync("access_token");
        void SecureStore.deleteItemAsync("refresh_token");
      }
      return Promise.reject(apiError);
    }
    if (error?.response?.status) {
      const apiError = new Error(`API returned ${error.response.status}.`) as Error & { status?: number };
      apiError.status = error.response.status;
      if (apiError.status === 401) {
        void SecureStore.deleteItemAsync("access_token");
        void SecureStore.deleteItemAsync("refresh_token");
      }
      return Promise.reject(apiError);
    }
    return Promise.reject(error);
  }
);
