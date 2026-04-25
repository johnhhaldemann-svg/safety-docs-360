import { createServerClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseServerUrl } from "@/lib/supabaseAdmin";

/**
 * Supabase client for App Router route handlers and server components.
 * Reads the user session from cookies (kept fresh by `proxy.ts`).
 *
 * `next/headers` is loaded dynamically so this module is not pulled into client bundles
 * that import shared helpers from the same graph as `authorizeRequest`.
 */
export async function createSupabaseRouteHandlerClient() {
  const supabaseUrl = getSupabaseServerUrl();
  const supabaseAnonKey = getSupabaseAnonKey();
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Components can be read-only; proxy refreshes sessions.
        }
      },
    },
  });
}
