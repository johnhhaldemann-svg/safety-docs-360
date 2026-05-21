/**
 * Primary body region affected (trade / training / prevention analytics).
 * Stored as `body_part` on `company_incidents`; API uses camelCase `bodyPart`.
 */

export const BODY_PARTS = [
  "back",
  "hand",
  "fingers",
  "knee",
  "shoulder",
  "eye",
  "foot",
  "other",
] as const;

export type BodyPart = (typeof BODY_PARTS)[number];

const SET = new Set<string>(BODY_PARTS);

export function isBodyPart(value: string): value is BodyPart {
  return SET.has(value);
}

/** Returns null when empty or invalid. */
export function normalizeBodyPart(input: unknown): BodyPart | null {
  const v = String(input ?? "").trim().toLowerCase();
  if (!v) return null;
  return isBodyPart(v) ? v : null;
}

export const BODY_PART_LABELS: Record<BodyPart, string> = {
  back: "Back",
  hand: "Hand",
  fingers: "Fingers",
  knee: "Knee",
  shoulder: "Shoulder",
  eye: "Eye",
  foot: "Foot",
  other: "Other",
};
