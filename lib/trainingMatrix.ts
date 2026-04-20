import {
  activeCertificationsForMatching,
  type CertificationExpirationMap,
  daysUntilExpiryCalendar,
  expiryUiStatus,
  type ExpiryUiStatus,
} from "./certificationExpirations";

export const DEFAULT_MATCH_FIELDS = ["certifications"] as const;

export type MatchField = "certifications" | "job_title" | "trade_specialty";

export type TrainingMatrixCellState = "match" | "gap" | "na";

export type TrainingRequirementInput = {
  id: string;
  match_keywords: string[];
  match_fields?: string[] | null;
  /** Empty or omitted = applies to all trades. */
  apply_trades?: string[] | null;
  /** Empty or omitted = applies to all positions. */
  apply_positions?: string[] | null;
  /** Empty or omitted = applies to all subtrades. */
  apply_sub_trades?: string[] | null;
  /** Empty or omitted = applies to all task codes. */
  apply_task_codes?: string[] | null;
};

export type ProfileForMatching = {
  certifications: string[] | null | undefined;
  /** YYYY-MM-DD per certification name; omitted keys are treated as not expired. */
  certificationExpirations?: CertificationExpirationMap | null;
  job_title?: string | null;
  trade_specialty?: string | null;
};

export type TrainingMatrixContext = {
  selectedTrade?: string | null;
  selectedSubTrade?: string | null;
  selectedTaskCode?: string | null;
};

export function normalizeForMatch(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeScopedValues(values: string[] | null | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

/** Keyword matches haystack if either includes the other (forgiving free-text). */
export function keywordMatchesHaystack(keywordNorm: string, haystackNorm: string): boolean {
  if (!keywordNorm || !haystackNorm) return false;
  return haystackNorm.includes(keywordNorm) || keywordNorm.includes(haystackNorm);
}

/**
 * For top-level matrix filters: if no filter is selected, keep the row visible.
 * Once a filter is selected, unrestricted rows still remain visible while scoped rows
 * must match the selected value.
 */
export function matchesSelectedMatrixFilter(
  options: string[] | null | undefined,
  selected: string | null | undefined
): boolean {
  const scoped = normalizeScopedValues(options);
  if (!selected?.trim()) return true;
  if (scoped.length === 0) return true;
  const normalizedSelected = normalizeForMatch(selected);
  return scoped.some((value) => normalizeForMatch(value) === normalizedSelected);
}

/**
 * For generated subtrade/task requirements: unrestricted rows are always visible,
 * but scoped rows stay hidden until the matching context filter is selected.
 */
export function activatesScopedRequirement(
  options: string[] | null | undefined,
  selected: string | null | undefined
): boolean {
  const scoped = normalizeScopedValues(options);
  if (scoped.length === 0) return true;
  if (!selected?.trim()) return false;
  const normalizedSelected = normalizeForMatch(selected);
  return scoped.some((value) => normalizeForMatch(value) === normalizedSelected);
}

export function requirementAppliesToProfile(
  profile: ProfileForMatching,
  applyTrades?: string[] | null,
  applyPositions?: string[] | null,
  applySubTrades?: string[] | null,
  applyTaskCodes?: string[] | null,
  context?: TrainingMatrixContext | null
): boolean {
  const trades = (applyTrades ?? []).map((t) => t.trim()).filter(Boolean);
  const positions = (applyPositions ?? []).map((p) => p.trim()).filter(Boolean);
  const subTrades = (applySubTrades ?? []).map((t) => t.trim()).filter(Boolean);
  const taskCodes = (applyTaskCodes ?? []).map((t) => t.trim()).filter(Boolean);

  if (trades.length > 0) {
    const t = normalizeForMatch(profile.trade_specialty ?? "");
    if (!t) return false;
    if (!trades.some((opt) => normalizeForMatch(opt) === t)) return false;
  }
  if (positions.length > 0) {
    const p = normalizeForMatch(profile.job_title ?? "");
    if (!p) return false;
    if (!positions.some((opt) => normalizeForMatch(opt) === p)) return false;
  }
  if (subTrades.length > 0) {
    const selectedSubTrade = normalizeForMatch(context?.selectedSubTrade ?? "");
    if (!selectedSubTrade) return false;
    if (!subTrades.some((opt) => normalizeForMatch(opt) === selectedSubTrade)) return false;
  }
  if (taskCodes.length > 0) {
    const selectedTaskCode = normalizeForMatch(context?.selectedTaskCode ?? "");
    if (!selectedTaskCode) return false;
    if (!taskCodes.some((opt) => normalizeForMatch(opt) === selectedTaskCode)) return false;
  }
  return true;
}

function resolveMatchFields(fields?: string[] | null): MatchField[] {
  const raw = fields?.length ? fields : [...DEFAULT_MATCH_FIELDS];
  const allowed = new Set<MatchField>(["certifications", "job_title", "trade_specialty"]);
  const out: MatchField[] = [];
  for (const f of raw) {
    const n = f.trim().toLowerCase() as MatchField;
    if (allowed.has(n) && !out.includes(n)) {
      out.push(n);
    }
  }
  return out.length ? out : ["certifications"];
}

type HaystackEntry = {
  norm: string;
  certIndex: number | null;
  field: MatchField;
  raw: string;
};

function buildHaystacksByField(profile: ProfileForMatching, fields: MatchField[]): HaystackEntry[] {
  const certifications = activeCertificationsForMatching(
    profile.certifications,
    profile.certificationExpirations ?? undefined
  );
  const byField: Record<MatchField, HaystackEntry[]> = {
    certifications: certifications.map((raw, certIndex) => ({
      raw,
      norm: normalizeForMatch(raw),
      certIndex,
      field: "certifications",
    })),
    job_title: profile.job_title
      ? [
          {
            raw: profile.job_title,
            norm: normalizeForMatch(profile.job_title),
            certIndex: null,
            field: "job_title",
          },
        ]
      : [],
    trade_specialty: profile.trade_specialty
      ? [
          {
            raw: profile.trade_specialty,
            norm: normalizeForMatch(profile.trade_specialty),
            certIndex: null,
            field: "trade_specialty",
          },
        ]
      : [],
  };

  const haystacks: HaystackEntry[] = [];
  for (const f of fields) {
    for (const entry of byField[f]) {
      if (entry.norm) {
        haystacks.push(entry);
      }
    }
  }
  return haystacks;
}

export type TrainingMatrixCellDetail = {
  state: TrainingMatrixCellState;
  matchSource?: MatchField;
  matchedLabel?: string;
  expiresOn?: string | null;
  daysUntilExpiry?: number | null;
  expiryStatus?: ExpiryUiStatus;
  /** For gap cells: requirement keywords to help remediation. */
  gapKeywords?: string[];
};

export type TrainingMatrixRowResult = {
  cells: Record<string, TrainingMatrixCellState>;
  cellDetails: Record<string, TrainingMatrixCellDetail>;
  unmatchedCertifications: string[];
};

/**
 * For each requirement: if trade/position scope does not apply, cell is "na".
 * Otherwise same keyword vs haystack rules; certifications only contribute when the requirement applied.
 */
const AS_OF = () => new Date();

function detailForMatch(
  profile: ProfileForMatching,
  hit: HaystackEntry,
  activeCerts: string[],
  asOf: Date
): Pick<
  TrainingMatrixCellDetail,
  "matchSource" | "matchedLabel" | "expiresOn" | "daysUntilExpiry" | "expiryStatus"
> {
  if (hit.field === "certifications" && hit.certIndex !== null) {
    const raw = activeCerts[hit.certIndex] ?? hit.raw;
    const exp = profile.certificationExpirations?.[raw] ?? null;
    return {
      matchSource: "certifications",
      matchedLabel: raw,
      expiresOn: exp ?? null,
      daysUntilExpiry: daysUntilExpiryCalendar(exp, asOf),
      expiryStatus: expiryUiStatus(exp, asOf),
    };
  }
  if (hit.field === "job_title") {
    return {
      matchSource: "job_title",
      matchedLabel: hit.raw,
      expiresOn: null,
      daysUntilExpiry: null,
      expiryStatus: "none",
    };
  }
  return {
    matchSource: "trade_specialty",
    matchedLabel: hit.raw,
    expiresOn: null,
    daysUntilExpiry: null,
    expiryStatus: "none",
  };
}

export function computeTrainingMatrixRow(
  profile: ProfileForMatching,
  requirements: TrainingRequirementInput[],
  asOf: Date = AS_OF(),
  context?: TrainingMatrixContext | null
): TrainingMatrixRowResult {
  const certifications = activeCertificationsForMatching(
    profile.certifications,
    profile.certificationExpirations ?? undefined
  );
  const certContributed = certifications.map(() => false);
  const cells: Record<string, TrainingMatrixCellState> = {};
  const cellDetails: Record<string, TrainingMatrixCellDetail> = {};

  for (const req of requirements) {
    if (
      !requirementAppliesToProfile(
        profile,
        req.apply_trades,
        req.apply_positions,
        req.apply_sub_trades,
        req.apply_task_codes,
        context
      )
    ) {
      cells[req.id] = "na";
      cellDetails[req.id] = { state: "na" };
      continue;
    }

    const fields = resolveMatchFields(req.match_fields);
    const haystacks = buildHaystacksByField(profile, fields);
    const keywords = (req.match_keywords ?? [])
      .map((k) => normalizeForMatch(k))
      .filter(Boolean);

    let satisfied = false;
    let firstHit: HaystackEntry | null = null;

    for (const kw of keywords) {
      for (const entry of haystacks) {
        if (keywordMatchesHaystack(kw, entry.norm)) {
          satisfied = true;
          if (entry.certIndex !== null && entry.certIndex >= 0 && entry.certIndex < certContributed.length) {
            certContributed[entry.certIndex] = true;
          }
          if (!firstHit) {
            firstHit = entry;
          }
        }
      }
    }

    const state: TrainingMatrixCellState = satisfied ? "match" : "gap";
    cells[req.id] = state;

    if (satisfied && firstHit) {
      const d = detailForMatch(profile, firstHit, certifications, asOf);
      cellDetails[req.id] = { state: "match", ...d };
    } else if (!satisfied) {
      const rawKw = (req.match_keywords ?? []).map((k) => k.trim()).filter(Boolean);
      cellDetails[req.id] = {
        state: "gap",
        gapKeywords: rawKw.slice(0, 4),
      };
    } else {
      cellDetails[req.id] = { state: "match" };
    }
  }

  const unmatchedCertifications = certifications.filter((_, i) => !certContributed[i]);

  return { cells, cellDetails, unmatchedCertifications };
}
