import { createClient } from "@supabase/supabase-js";

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function getSupabaseServerUrl() {
  return readEnv("NEXT_PUBLIC_SUPABASE_URL") ?? readEnv("SUPABASE_URL");
}

export function getSupabaseAnonKey() {
  return readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? readEnv("SUPABASE_ANON_KEY");
}

export function getSupabaseServiceRoleKey() {
  return (
    readEnv("SUPABASE_SERVICE_ROLE_KEY") ??
    readEnv("SUPABASE_SERVICE_ROLE") ??
    readEnv("SUPABASE_SERVICE_KEY") ??
    readEnv("SUPABASE_SERIVCE_ROLE_KEY")
  );
}

export function getSupabaseServerEnvStatus() {
  return {
    url: Boolean(getSupabaseServerUrl()),
    anonKey: Boolean(getSupabaseAnonKey()),
    serviceRoleKey: Boolean(getSupabaseServiceRoleKey()),
    sources: {
      url:
        (readEnv("NEXT_PUBLIC_SUPABASE_URL") && "NEXT_PUBLIC_SUPABASE_URL") ||
        (readEnv("SUPABASE_URL") && "SUPABASE_URL") ||
        null,
      anonKey:
        (readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") && "NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
        (readEnv("SUPABASE_ANON_KEY") && "SUPABASE_ANON_KEY") ||
        null,
      serviceRoleKey:
        (readEnv("SUPABASE_SERVICE_ROLE_KEY") && "SUPABASE_SERVICE_ROLE_KEY") ||
        (readEnv("SUPABASE_SERVICE_ROLE") && "SUPABASE_SERVICE_ROLE") ||
        (readEnv("SUPABASE_SERVICE_KEY") && "SUPABASE_SERVICE_KEY") ||
        (readEnv("SUPABASE_SERIVCE_ROLE_KEY") && "SUPABASE_SERIVCE_ROLE_KEY") ||
        null,
    },
  };
}

export function createSupabaseAdminClient() {
  const supabaseUrl = getSupabaseServerUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
