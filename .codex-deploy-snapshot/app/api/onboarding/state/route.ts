import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import {
  emptyOnboardingState,
  getUserOnboardingState,
  saveUserOnboardingState,
  type OnboardingState,
} from "@/lib/onboardingState";

export const runtime = "nodejs";

type PatchBody = {
  markCommandCenterViewed?: boolean;
  dismissed?: boolean;
  completedSteps?: OnboardingState["completedSteps"];
};

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    allowPending: true,
    allowSuspended: true,
  });
  if ("error" in auth) return auth.error;

  const result = await getUserOnboardingState({
    supabase: auth.supabase,
    userId: auth.user.id,
  });

  if (result.error) {
    return NextResponse.json(emptyOnboardingState());
  }

  return NextResponse.json(result.data);
}

export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, {
    allowPending: true,
    allowSuspended: true,
  });
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  const current = await getUserOnboardingState({
    supabase: auth.supabase,
    userId: auth.user.id,
  });
  const now = new Date().toISOString();
  const nextState: Partial<OnboardingState> = {};

  if (body?.markCommandCenterViewed) {
    nextState.lastSeenCommandCenterAt = now;
    nextState.completedSteps = [...current.data.completedSteps, "command_center"];
  }

  if (body?.dismissed) {
    nextState.dismissedAt = now;
  }

  if (body?.completedSteps) {
    nextState.completedSteps = [
      ...new Set([...(nextState.completedSteps ?? current.data.completedSteps), ...body.completedSteps]),
    ];
  }

  const result = await saveUserOnboardingState({
    supabase: auth.supabase,
    userId: auth.user.id,
    state: nextState,
  });

  if (result.error) {
    return NextResponse.json(
      { error: result.error.message || "Failed to save onboarding state." },
      { status: 500 }
    );
  }

  const refreshed = await getUserOnboardingState({
    supabase: auth.supabase,
    userId: auth.user.id,
  });

  return NextResponse.json(refreshed.data);
}
