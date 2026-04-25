export type OnboardingStepId =
  | "company_profile"
  | "team_invites"
  | "first_jobsite"
  | "first_document"
  | "command_center";

export type OnboardingState = {
  completedSteps: OnboardingStepId[];
  dismissedAt: string | null;
  lastSeenCommandCenterAt: string | null;
};

type MessageError = { message?: string | null };
type SupabaseLikeClient = {
  from: (table: string) => unknown;
};

const ONBOARDING_STEP_IDS: OnboardingStepId[] = [
  "company_profile",
  "team_invites",
  "first_jobsite",
  "first_document",
  "command_center",
];

export function emptyOnboardingState(): OnboardingState {
  return {
    completedSteps: [],
    dismissedAt: null,
    lastSeenCommandCenterAt: null,
  };
}

function normalizeCompletedSteps(value: unknown): OnboardingStepId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowed = new Set<string>(ONBOARDING_STEP_IDS);
  const seen = new Set<OnboardingStepId>();
  for (const item of value) {
    if (typeof item !== "string" || !allowed.has(item)) {
      continue;
    }
    seen.add(item as OnboardingStepId);
  }
  return [...seen];
}

export function normalizeOnboardingState(row: unknown): OnboardingState {
  if (!row || typeof row !== "object") {
    return emptyOnboardingState();
  }

  const record = row as {
    completed_steps?: unknown;
    dismissed_at?: unknown;
    last_seen_command_center_at?: unknown;
  };

  return {
    completedSteps: normalizeCompletedSteps(record.completed_steps),
    dismissedAt: typeof record.dismissed_at === "string" ? record.dismissed_at : null,
    lastSeenCommandCenterAt:
      typeof record.last_seen_command_center_at === "string"
        ? record.last_seen_command_center_at
        : null,
  };
}

export async function getUserOnboardingState(params: {
  supabase: SupabaseLikeClient;
  userId: string;
}) {
  const { data, error } = await (
    params.supabase.from("user_onboarding_state") as {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => PromiseLike<{ data: unknown; error: MessageError | null }>;
        };
      };
    }
  )
    .select("completed_steps, dismissed_at, last_seen_command_center_at")
    .eq("user_id", params.userId)
    .maybeSingle();

  return {
    data: normalizeOnboardingState(data),
    error,
  };
}

export async function saveUserOnboardingState(params: {
  supabase: SupabaseLikeClient;
  userId: string;
  state: Partial<OnboardingState>;
}) {
  const row: Record<string, unknown> = {
    user_id: params.userId,
    updated_at: new Date().toISOString(),
  };

  if (params.state.completedSteps) {
    row.completed_steps = normalizeCompletedSteps(params.state.completedSteps);
  }
  if ("dismissedAt" in params.state) {
    row.dismissed_at = params.state.dismissedAt;
  }
  if ("lastSeenCommandCenterAt" in params.state) {
    row.last_seen_command_center_at = params.state.lastSeenCommandCenterAt;
  }

  const { error } = await (
    params.supabase.from("user_onboarding_state") as {
      upsert: (
        values: Record<string, unknown>,
        options?: Record<string, unknown>
      ) => PromiseLike<{ error: MessageError | null }>;
    }
  ).upsert(row, { onConflict: "user_id" });

  return { error };
}
