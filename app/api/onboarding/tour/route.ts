/**
 * /api/onboarding/tour
 *
 * GET  – Returns the user's guided tour state (completion + dismissal timestamps).
 * PATCH – Updates guided_tour_completed_at or guided_tour_dismissed_at.
 *
 * Reads/writes directly to the guided_tour_* columns added by migration
 * 20260616100000_guided_tour_state.sql on user_onboarding_state.
 */

import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";

export const runtime = "nodejs";

type TourStateRow = {
  guided_tour_completed_at: string | null;
  guided_tour_dismissed_at: string | null;
};

type PatchBody = {
  guided_tour_completed_at?: string | null;
  guided_tour_dismissed_at?: string | null;
};

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    allowPending: true,
    allowSuspended: true,
  });
  if ("error" in auth) return auth.error;

  const { data, error } = await (auth.supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: TourStateRow | null; error: { message?: string } | null }>;
        };
      };
    };
  })
    .from("user_onboarding_state")
    .select("guided_tour_completed_at, guided_tour_dismissed_at")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { guided_tour_completed_at: null, guided_tour_dismissed_at: null },
    );
  }

  return NextResponse.json({
    guided_tour_completed_at: data?.guided_tour_completed_at ?? null,
    guided_tour_dismissed_at: data?.guided_tour_dismissed_at ?? null,
  });
}

// ---------------------------------------------------------------------------
// PATCH
// ---------------------------------------------------------------------------
export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, {
    allowPending: true,
    allowSuspended: true,
  });
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const row: Record<string, unknown> = {
    user_id: auth.user.id,
    updated_at: new Date().toISOString(),
  };

  if ("guided_tour_completed_at" in body) {
    row.guided_tour_completed_at = body.guided_tour_completed_at;
  }
  if ("guided_tour_dismissed_at" in body) {
    row.guided_tour_dismissed_at = body.guided_tour_dismissed_at;
  }

  const { error } = await (auth.supabase as unknown as {
    from: (t: string) => {
      upsert: (
        values: Record<string, unknown>,
        opts?: Record<string, unknown>
      ) => Promise<{ error: { message?: string } | null }>;
    };
  })
    .from("user_onboarding_state")
    .upsert(row, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to save tour state." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
