import {
  activeCertificationsForMatching,
  type CertificationExpirationMap,
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
};

export type ProfileForMatching = {
  certifications: string[] | null | undefined;
  /** YYYY-MM-DD per certification name; omitted keys are treated as not expired. */
  certificationExpirations?: CertificationExpirationMap | null;
  job_title?: string | null;
  trade_specialty?: string | null;
};

export function normalizeForMatch(value: string): string {
  return value.trim().toLowerCase();
}

/** Keyword matches haystack if either includes the other (forgiving free-text). */
export function keywordMatchesHaystack(keywordNorm: string, haystackNorm: string): boolean {
  if (!keywordNorm || !haystackNorm) return false;
  return haystackNorm.includes(keywordNorm) || keywordNorm.includes(haystackNorm);
}

export function requirementAppliesToProfile(
  profile: ProfileForMatching,
  applyTrades?: string[] | null,
  applyPositions?: string[] | null
): boolean {
  const trades = (applyTrades ?? []).map((t) => t.trim()).filter(Boolean);
  const positions = (applyPositions ?? []).map((p) => p.trim()).filter(Boolean);

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

function buildHaystacksByField(profile: ProfileForMatching, fields: MatchField[]) {
  const certifications = activeCertificationsForMatching(
    profile.certifications,
    profile.certificationExpirations ?? undefined
  );
  const byField: Record<MatchField, { raw: string; norm: string; certIndex: number | null }[]> = {
    certifications: certifications.map((raw, certIndex) => ({
      raw,
      norm: normalizeForMatch(raw),
      certIndex,
    })),
    job_title: profile.job_title
      ? [{ raw: profile.job_title, norm: normalizeForMatch(profile.job_title), certIndex: null }]
      : [],
    trade_specialty: profile.trade_specialty
      ? [
          {
            raw: profile.trade_specialty,
            norm: normalizeForMatch(profile.trade_specialty),
            certIndex: null,
          },
        ]
      : [],
  };

  const haystacks: { norm: string; certIndex: number | null }[] = [];
  for (const f of fields) {
    for (const entry of byField[f]) {
      if (entry.norm) {
        haystacks.push({ norm: entry.norm, certIndex: entry.certIndex });
      }
    }
  }
  return haystacks;
}

export type TrainingMatrixRowResult = {
  cells: Record<string, TrainingMatrixCellState>;
  unmatchedCertifications: string[];
};

/**
 * For each requirement: if trade/position scope does not apply, cell is "na".
 * Otherwise same keyword vs haystack rules; certifications only contribute when the requirement applied.
 */
export function computeTrainingMatrixRow(
  profile: ProfileForMatching,
  requirements: TrainingRequirementInput[]
): TrainingMatrixRowResult {
  const certifications = activeCertificationsForMatching(
    profile.certifications,
    profile.certificationExpirations ?? undefined
  );
  const certContributed = certifications.map(() => false);
  const cells: Record<string, TrainingMatrixCellState> = {};

  for (const req of requirements) {
    if (!requirementAppliesToProfile(profile, req.apply_trades, req.apply_positions)) {
      cells[req.id] = "na";
      continue;
    }

    const fields = resolveMatchFields(req.match_fields);
    const haystacks = buildHaystacksByField(profile, fields);
    const keywords = (req.match_keywords ?? [])
      .map((k) => normalizeForMatch(k))
      .filter(Boolean);

    let satisfied = false;

    for (const kw of keywords) {
      for (const { norm, certIndex } of haystacks) {
        if (keywordMatchesHaystack(kw, norm)) {
          satisfied = true;
          if (certIndex !== null && certIndex >= 0 && certIndex < certContributed.length) {
            certContributed[certIndex] = true;
          }
        }
      }
    }

    cells[req.id] = satisfied ? "match" : "gap";
  }

  const unmatchedCertifications = certifications.filter((_, i) => !certContributed[i]);

  return { cells, unmatchedCertifications };
}
