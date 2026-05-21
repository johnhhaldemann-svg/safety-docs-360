import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildOfflineDemoSupabaseUser,
  getOfflineDemoCookieName,
  getOfflineDemoToken,
} from "@/lib/offlineDesktopSession";

let browserClient: SupabaseClient | null = null;
let offlineSessionBootstrapped = false;

function isOfflineDesktopEnabled() {
  return process.env.NEXT_PUBLIC_OFFLINE_DESKTOP === "1";
}

type OfflineAuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: "bearer";
  user: {
    id: string;
    email: string;
  };
};

async function ensureOfflineSession() {
  const token = getOfflineDemoToken();
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

  if (!offlineSessionBootstrapped) {
    try {
      await fetch("/api/offline/session", { method: "POST", credentials: "include" });
    } catch {
      // Ignore bootstrap failures; fixed token path still supports demo mode.
    }
    offlineSessionBootstrapped = true;
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem("safety360:offline-demo-token", token);
    document.cookie = `${getOfflineDemoCookieName()}=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
  }

  const demoUser = buildOfflineDemoSupabaseUser();
  const session: OfflineAuthSession = {
    access_token: token,
    refresh_token: token,
    expires_in: 24 * 60 * 60,
    expires_at: expiresAt,
    token_type: "bearer",
    user: {
      id: demoUser.id,
      email: demoUser.email ?? "",
    },
  };

  return session;
}

function createOfflineClient() {
  return {
    auth: {
      async getUser() {
        return { data: { user: buildOfflineDemoSupabaseUser() }, error: null };
      },
      async getSession() {
        return { data: { session: await ensureOfflineSession() }, error: null };
      },
      onAuthStateChange(callback: (event: "SIGNED_IN", session: OfflineAuthSession) => void) {
        void ensureOfflineSession().then((session) => callback("SIGNED_IN", session));
        return { data: { subscription: { unsubscribe() {} } } };
      },
      async signOut() {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("safety360:offline-demo-token");
          document.cookie = `${getOfflineDemoCookieName()}=; Max-Age=0; path=/; SameSite=Lax`;
        }
        return { error: null };
      },
      async signInWithPassword() {
        return { data: { session: await ensureOfflineSession() }, error: null };
      },
    },
  } as unknown as SupabaseClient;
}

export function getSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  if (isOfflineDesktopEnabled()) {
    browserClient = createOfflineClient();
    return browserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase browser configuration.");
  }

  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}
