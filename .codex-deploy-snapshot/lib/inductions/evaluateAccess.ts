/**
 * Pure helpers for site access evaluation from programs, requirements, and completions.
 */

export type InductionProgramRow = {
  id: string;
  name: string;
  audience: string;
  active: boolean;
};

export type InductionRequirementRow = {
  id: string;
  program_id: string;
  jobsite_id: string | null;
  active: boolean;
  effective_from: string | null;
  effective_to: string | null;
};

export type InductionCompletionRow = {
  program_id: string;
  jobsite_id: string | null;
  user_id: string | null;
  visitor_display_name: string | null;
  expires_at: string | null;
  completed_at: string;
};

function todayUtcDateString() {
  return new Date().toISOString().slice(0, 10);
}

function requirementIsEffectiveOn(req: InductionRequirementRow, onDate: string) {
  if (!req.active) return false;
  const from = (req.effective_from ?? "").trim() || "1970-01-01";
  const to = (req.effective_to ?? "").trim();
  if (onDate < from) return false;
  if (to && onDate > to) return false;
  return true;
}

function completionIsValidForSubject(
  c: InductionCompletionRow,
  programId: string,
  jobsiteId: string,
  subjectUserId: string | null,
  visitorName: string | null
) {
  if (c.program_id !== programId) return false;
  if (subjectUserId && c.user_id && c.user_id === subjectUserId) {
    // ok
  } else if (!subjectUserId && visitorName && c.visitor_display_name) {
    if (c.visitor_display_name.trim().toLowerCase() !== visitorName.trim().toLowerCase()) return false;
  } else {
    return false;
  }
  if (c.jobsite_id != null && c.jobsite_id !== jobsiteId) return false;
  if (c.expires_at) {
    const exp = new Date(c.expires_at).getTime();
    if (!Number.isFinite(exp) || exp <= Date.now()) return false;
  }
  return true;
}

export function evaluateInductionAccess(input: {
  jobsiteId: string;
  subjectUserId: string | null;
  visitorDisplayName: string | null;
  programs: InductionProgramRow[];
  requirements: InductionRequirementRow[];
  completions: InductionCompletionRow[];
  /** ISO date YYYY-MM-DD; defaults to today UTC */
  asOfDate?: string;
}): {
  status: "eligible" | "blocked";
  missingProgramIds: string[];
  reasons: string[];
} {
  const onDate = input.asOfDate ?? todayUtcDateString();
  const { jobsiteId, subjectUserId, visitorDisplayName, programs, requirements, completions } = input;

  const programById = new Map(programs.map((p) => [p.id, p]));
  const applicableReqs = requirements.filter(
    (r) =>
      requirementIsEffectiveOn(r, onDate) &&
      (r.jobsite_id == null || r.jobsite_id === jobsiteId)
  );

  const requiredProgramIds = new Set<string>();
  for (const r of applicableReqs) {
    const p = programById.get(r.program_id);
    if (p?.active) requiredProgramIds.add(r.program_id);
  }

  const missing: string[] = [];
  const reasons: string[] = [];

  for (const programId of requiredProgramIds) {
    const prog = programById.get(programId);
    const label = prog?.name ?? programId;
    const hasValid = completions.some((c) =>
      completionIsValidForSubject(c, programId, jobsiteId, subjectUserId, visitorDisplayName)
    );
    if (!hasValid) {
      missing.push(programId);
      reasons.push(`Induction not completed or expired: ${label}`);
    }
  }

  return {
    status: missing.length === 0 ? "eligible" : "blocked",
    missingProgramIds: missing,
    reasons,
  };
}
