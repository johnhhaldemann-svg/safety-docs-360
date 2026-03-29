export const DEFAULT_MATCH_FIELDS = ["certifications"] as const;

export type MatchField = "certifications" | "job_title" | "trade_specialty";

export type TrainingRequirementInput = {
  id: string;
  match_keywords: string[];
  match_fields?: string[] | null;
};

export type ProfileForMatching = {
  certifications: string[] | null | undefined;
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
  const certifications = profile.certifications ?? [];
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
  cells: Record<string, boolean>;
  unmatchedCertifications: string[];
};

/**
 * For each requirement, satisfied if any normalized keyword matches any selected haystack (substring rule).
 * A certification list entry is "used" if any requirement's keyword matched that specific entry's text.
 */
export function computeTrainingMatrixRow(
  profile: ProfileForMatching,
  requirements: TrainingRequirementInput[]
): TrainingMatrixRowResult {
  const certifications = profile.certifications ?? [];
  const certContributed = certifications.map(() => false);
  const cells: Record<string, boolean> = {};

  for (const req of requirements) {
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

    cells[req.id] = satisfied;
  }

  const unmatchedCertifications = certifications.filter((_, i) => !certContributed[i]);

  return { cells, unmatchedCertifications };
}
