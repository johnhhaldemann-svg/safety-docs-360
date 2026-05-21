import type { User } from "@supabase/supabase-js";

const OFFLINE_DEMO_TOKEN = "safety360-offline-demo-token";
const OFFLINE_DEMO_COOKIE = "offline_demo_token";
const OFFLINE_DEMO_USER_ID = "offline-sales-demo-user";
export const OFFLINE_DEMO_EMAIL = "demo.20260425@safety360docs.local";
const OFFLINE_DEMO_TEAM = "Demo Workspace";
const OFFLINE_DEMO_COMPANY_ID = "demo-company";
const OFFLINE_DEMO_COMPANY_NAME = "Summit Ridge Constructors";

export function isOfflineDesktopEnabled() {
  return process.env.NEXT_PUBLIC_OFFLINE_DESKTOP === "1";
}

export function getOfflineDemoToken() {
  return OFFLINE_DEMO_TOKEN;
}

export function getOfflineDemoCookieName() {
  return OFFLINE_DEMO_COOKIE;
}

export function getOfflineDemoSessionPayload() {
  return {
    token: OFFLINE_DEMO_TOKEN,
    user: {
      id: OFFLINE_DEMO_USER_ID,
      email: OFFLINE_DEMO_EMAIL,
      role: "sales_demo",
      team: OFFLINE_DEMO_TEAM,
      companyId: OFFLINE_DEMO_COMPANY_ID,
      companyName: OFFLINE_DEMO_COMPANY_NAME,
    },
  };
}

export function readOfflineDemoTokenFromRequest(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.startsWith("Bearer ")) {
    const token = authorization.slice(7).trim();
    if (token) return token;
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const [rawName, rawValue] = pair.split("=");
    if ((rawName ?? "").trim() === OFFLINE_DEMO_COOKIE) {
      return decodeURIComponent((rawValue ?? "").trim());
    }
  }
  return "";
}

export function isValidOfflineDemoToken(token: string) {
  return token === OFFLINE_DEMO_TOKEN;
}

export function buildOfflineDemoSupabaseUser(): User {
  return {
    id: OFFLINE_DEMO_USER_ID,
    app_metadata: {
      provider: "offline",
      providers: ["offline"],
      role: "sales_demo",
      team: OFFLINE_DEMO_TEAM,
      company_id: OFFLINE_DEMO_COMPANY_ID,
      account_status: "active",
    },
    user_metadata: {
      role: "sales_demo",
      team: OFFLINE_DEMO_TEAM,
      company_id: OFFLINE_DEMO_COMPANY_ID,
      account_status: "active",
      full_name: "SafetyDocs360 Demo",
    },
    aud: "authenticated",
    confirmation_sent_at: undefined,
    recovery_sent_at: undefined,
    email_change_sent_at: undefined,
    new_email: undefined,
    new_phone: undefined,
    invited_at: undefined,
    action_link: undefined,
    email: OFFLINE_DEMO_EMAIL,
    phone: "",
    created_at: new Date().toISOString(),
    confirmed_at: new Date().toISOString(),
    email_confirmed_at: new Date().toISOString(),
    phone_confirmed_at: undefined,
    last_sign_in_at: new Date().toISOString(),
    role: "authenticated",
    updated_at: new Date().toISOString(),
    identities: [],
    factors: [],
    is_anonymous: false,
  };
}
