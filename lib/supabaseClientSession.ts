import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type CachedToken = {
  accessToken: string;
  expiresAtMs: number;
};

let cachedToken: CachedToken | null = null;
let tokenRequest: Promise<string | null> | null = null;

const EXPIRY_SKEW_MS = 30_000;
const FALLBACK_TOKEN_TTL_MS = 60_000;

export function clearSupabaseClientSessionCache() {
  cachedToken = null;
  tokenRequest = null;
}

export async function getSupabaseAccessToken(options: { forceRefresh?: boolean } = {}) {
  const now = Date.now();
  if (
    !options.forceRefresh &&
    cachedToken &&
    cachedToken.expiresAtMs - EXPIRY_SKEW_MS > now
  ) {
    return cachedToken.accessToken;
  }

  if (!options.forceRefresh && tokenRequest) {
    return tokenRequest;
  }

  const supabase = getSupabaseBrowserClient();
  tokenRequest = supabase.auth
    .getSession()
    .then(({ data }) => {
      const session = data.session;
      if (!session?.access_token) {
        cachedToken = null;
        return null;
      }

      cachedToken = {
        accessToken: session.access_token,
        expiresAtMs: session.expires_at ? session.expires_at * 1000 : now + FALLBACK_TOKEN_TTL_MS,
      };
      return session.access_token;
    })
    .finally(() => {
      tokenRequest = null;
    });

  return tokenRequest;
}

export async function getSupabaseAuthHeaders(options: { forceRefresh?: boolean } = {}) {
  const token = await getSupabaseAccessToken(options);
  return token ? { Authorization: `Bearer ${token}` } : null;
}
