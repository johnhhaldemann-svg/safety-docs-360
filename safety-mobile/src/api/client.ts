import axios from "axios";
import * as SecureStore from "expo-secure-store";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://safety360docs.com/api/mobile";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000
});

let accessTokenCache: string | null = null;
let refreshTokenCache: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAuthTokens(accessToken: string | null, refreshToken?: string | null) {
  accessTokenCache = accessToken;
  if (typeof refreshToken !== "undefined") refreshTokenCache = refreshToken;
  if (accessToken) api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
  else delete api.defaults.headers.common.Authorization;
}

async function getStoredAccessToken() {
  if (accessTokenCache) return accessTokenCache;
  const token = await SecureStore.getItemAsync("access_token");
  if (token) setAuthTokens(token);
  return token;
}

async function getStoredRefreshToken() {
  if (refreshTokenCache) return refreshTokenCache;
  const token = await SecureStore.getItemAsync("refresh_token");
  refreshTokenCache = token;
  return token;
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = await getStoredRefreshToken();
    if (!refreshToken) return null;
    const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken }, { timeout: 20000 });
    const nextAccessToken = typeof data?.accessToken === "string" ? data.accessToken : null;
    const nextRefreshToken = typeof data?.refreshToken === "string" ? data.refreshToken : refreshToken;
    if (!nextAccessToken) return null;
    await SecureStore.setItemAsync("access_token", nextAccessToken);
    await SecureStore.setItemAsync("refresh_token", nextRefreshToken);
    setAuthTokens(nextAccessToken, nextRefreshToken);
    return nextAccessToken;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

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
  const token = await getStoredAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config as
      | (typeof error.config & { _retry?: boolean; headers?: Record<string, string> })
      | undefined;
    const status = error?.response?.status;
    if (status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const nextToken = await refreshAccessToken().catch(() => null);
      if (nextToken) {
        originalRequest.headers = {
          ...(originalRequest.headers ?? {}),
          Authorization: `Bearer ${nextToken}`
        };
        return api(originalRequest);
      }
    }
    const data = error?.response?.data as { error?: unknown; message?: unknown } | undefined;
    const message = data?.error ?? data?.message;
    if (typeof message === "string" && message.trim()) {
      const apiError = new Error(message) as Error & { status?: number };
      apiError.status = error?.response?.status;
      if (apiError.status === 401) {
        void SecureStore.deleteItemAsync("access_token");
        void SecureStore.deleteItemAsync("refresh_token");
        setAuthTokens(null, null);
      }
      return Promise.reject(apiError);
    }
    if (error?.response?.status) {
      const apiError = new Error(`API returned ${error.response.status}.`) as Error & { status?: number };
      apiError.status = error.response.status;
      if (apiError.status === 401) {
        void SecureStore.deleteItemAsync("access_token");
        void SecureStore.deleteItemAsync("refresh_token");
        setAuthTokens(null, null);
      }
      return Promise.reject(apiError);
    }
    return Promise.reject(error);
  }
);
