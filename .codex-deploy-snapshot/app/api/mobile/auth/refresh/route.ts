import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseServerUrl } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabaseUrl = getSupabaseServerUrl();
  const supabaseAnonKey = getSupabaseAnonKey();
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Missing Supabase auth configuration." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { refreshToken?: string } | null;
  const refreshToken = String(body?.refreshToken ?? "").trim();
  if (!refreshToken) {
    return NextResponse.json({ error: "Refresh token is required." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) {
    return NextResponse.json({ error: error?.message || "Session refresh failed." }, { status: 401 });
  }

  return NextResponse.json({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at ?? null,
    tokenType: data.session.token_type,
  });
}
