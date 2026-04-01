import type { ExposureEventType } from "@/lib/incidents/exposureEventType";
import type { InjuryType } from "@/lib/incidents/injuryType";

/**
 * Illustrative static priors P(injury type | exposure), for blending with company history.
 * Not official BLS microdata; use for ranking / cold-start only.
 */
export const EXPOSURE_TO_INJURY_PRIOR: Record<
  ExposureEventType,
  Partial<Record<InjuryType, number>>
> = {
  fall_same_level: { contusion: 0.35, strain: 0.25, sprain: 0.2, fracture: 0.1, laceration: 0.1 },
  fall_to_lower_level: { fracture: 0.35, contusion: 0.25, strain: 0.15, sprain: 0.15, other: 0.1 },
  struck_by_object: { contusion: 0.3, laceration: 0.25, fracture: 0.2, strain: 0.15, other: 0.1 },
  caught_in_between: { fracture: 0.25, laceration: 0.25, amputation: 0.15, contusion: 0.2, strain: 0.15 },
  overexertion: { strain: 0.45, sprain: 0.35, contusion: 0.1, other: 0.1 },
  contact_with_equipment: { laceration: 0.3, contusion: 0.25, fracture: 0.2, amputation: 0.1, other: 0.15 },
  exposure_harmful_substance: { burn: 0.35, other: 0.35, contusion: 0.15, strain: 0.15 },
  electrical: { burn: 0.45, other: 0.25, fracture: 0.15, contusion: 0.15 },
  other: { other: 0.4, contusion: 0.2, strain: 0.2, laceration: 0.2 },
};

function normalizeDistribution(dist: Partial<Record<InjuryType, number>>): Record<InjuryType, number> {
  const entries = Object.entries(dist).filter(([, w]) => typeof w === "number" && w > 0) as [
    InjuryType,
    number,
  ][];
  const sum = entries.reduce((a, [, w]) => a + w, 0);
  const out = {} as Record<InjuryType, number>;
  if (sum <= 0) {
    (Object.keys(dist) as InjuryType[]).forEach((k) => {
      out[k] = 1 / Math.max(1, Object.keys(dist).length);
    });
    return out;
  }
  for (const [k, w] of entries) out[k] = w / sum;
  return out;
}

/** Prior distribution over injury types for an exposure (normalized). */
export function priorInjuryMixForExposure(eventType: ExposureEventType): Record<InjuryType, number> {
  const raw = EXPOSURE_TO_INJURY_PRIOR[eventType] ?? EXPOSURE_TO_INJURY_PRIOR.other;
  return normalizeDistribution(raw);
}

/**
 * Blend empirical counts with static prior (Laplace-smoothed).
 * `alpha` — weight on prior vs data (higher = trust prior more when data is sparse).
 */
export function blendInjuryDistribution(
  empirical: Partial<Record<InjuryType, number>>,
  eventType: ExposureEventType,
  alpha = 4
): { injuryType: InjuryType; probability: number }[] {
  const prior = priorInjuryMixForExposure(eventType);
  const types = new Set<InjuryType>([...Object.keys(prior), ...Object.keys(empirical)] as InjuryType[]);
  let totalEmp = 0;
  for (const t of types) totalEmp += Math.max(0, empirical[t] ?? 0);
  const out: { injuryType: InjuryType; probability: number }[] = [];
  let sum = 0;
  for (const t of types) {
    const emp = (empirical[t] ?? 0) / Math.max(1, totalEmp);
    const p = (prior[t] ?? 0) * alpha + emp * totalEmp;
    out.push({ injuryType: t, probability: p });
    sum += p;
  }
  return out
    .map((row) => ({ ...row, probability: sum > 0 ? row.probability / sum : 0 }))
    .sort((a, b) => b.probability - a.probability);
}
