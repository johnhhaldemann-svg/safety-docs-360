import { useEffect, useState } from "react";
import { setAuthTokens } from "@/api/client";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, deleteStoredToken, getStoredToken, setStoredToken } from "@/auth/tokenStorage";

export async function saveSession(accessToken: string, refreshToken?: string | null) {
  await setStoredToken(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    await setStoredToken(REFRESH_TOKEN_KEY, refreshToken);
  }
  setAuthTokens(accessToken, refreshToken ?? null);
}

export async function clearSession() {
  await deleteStoredToken(ACCESS_TOKEN_KEY);
  await deleteStoredToken(REFRESH_TOKEN_KEY);
  setAuthTokens(null, null);
}

export function useAuthToken() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getStoredToken(ACCESS_TOKEN_KEY)
      .then((value) => {
        if (value) setAuthTokens(value);
        if (mounted) setToken(value);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return { token, loading };
}
