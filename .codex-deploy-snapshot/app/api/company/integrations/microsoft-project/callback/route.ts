import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  exchangeMicrosoftCodeForToken,
  fetchMicrosoftGraphMe,
  upsertMicrosoftProjectConnection,
  verifyMicrosoftOAuthState,
} from "@/lib/microsoftProject";

export const runtime = "nodejs";

function redirectWithStatus(origin: string, returnTo: string, params: Record<string, string>) {
  const target = new URL(returnTo.startsWith("/") ? returnTo : "/company-integrations", origin);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  return NextResponse.redirect(target);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim();
  const state = url.searchParams.get("state")?.trim();
  const microsoftError = url.searchParams.get("error_description") || url.searchParams.get("error");
  const origin = url.origin;

  if (microsoftError) {
    return redirectWithStatus(origin, "/company-integrations", {
      microsoftProject: "error",
      message: microsoftError.slice(0, 160),
    });
  }
  if (!code || !state) {
    return redirectWithStatus(origin, "/company-integrations", {
      microsoftProject: "error",
      message: "Missing Microsoft authorization response.",
    });
  }

  let verified: ReturnType<typeof verifyMicrosoftOAuthState>;
  try {
    verified = verifyMicrosoftOAuthState(state);
  } catch (error) {
    return redirectWithStatus(origin, "/company-integrations", {
      microsoftProject: "error",
      message: error instanceof Error ? error.message : "Invalid Microsoft authorization state.",
    });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return redirectWithStatus(origin, verified.returnTo, {
      microsoftProject: "error",
      message: "Supabase service role is required to complete Microsoft OAuth.",
    });
  }

  try {
    const token = await exchangeMicrosoftCodeForToken(code);
    const graphMe = await fetchMicrosoftGraphMe(token.access_token!);
    await upsertMicrosoftProjectConnection({
      supabase: admin,
      companyId: verified.companyId,
      actorUserId: verified.userId,
      token,
      graphMe,
      dataverseEnvironmentUrl: verified.dataverseEnvironmentUrl,
    });
    return redirectWithStatus(origin, verified.returnTo, { microsoftProject: "connected" });
  } catch (error) {
    return redirectWithStatus(origin, verified.returnTo, {
      microsoftProject: "error",
      message: error instanceof Error ? error.message.slice(0, 160) : "Microsoft Project connection failed.",
    });
  }
}
