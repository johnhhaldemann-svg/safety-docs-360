/** Calendar date YYYY-MM-DD in UTC for certification expiry. */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDateOnly(value: string): Date | null {
  const m = DATE_ONLY.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return dt;
}

/** True if expiresOn is a valid date strictly before the UTC calendar day of asOf. */
export function isCertificationExpired(expiresOn: string | undefined | null, asOf: Date): boolean {
  if (expiresOn == null || String(expiresOn).trim() === "") return false;
  const exp = parseIsoDateOnly(String(expiresOn));
  if (!exp) return false;
  const t = new Date(asOf);
  const todayUtc = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  return todayUtc > exp.getTime();
}

export type CertificationExpirationMap = Record<string, string>;

export function parseCertificationExpirations(raw: unknown): CertificationExpirationMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const out: CertificationExpirationMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const name = k.trim();
    if (!name || typeof v !== "string") continue;
    const d = v.trim();
    if (!DATE_ONLY.test(d) || !parseIsoDateOnly(d)) continue;
    out[name] = d;
  }
  return out;
}

/**
 * Certifications that count as currently held for compliance / matrix matching.
 * Missing expiration entry = still valid (not expired).
 */
export function activeCertificationsForMatching(
  certifications: string[] | null | undefined,
  expirations: CertificationExpirationMap | null | undefined,
  asOf: Date = new Date()
): string[] {
  const list = certifications ?? [];
  const exp = expirations ?? {};
  return list.filter((name) => !isCertificationExpired(exp[name], asOf));
}

export type ExpiryUiStatus = "none" | "ok" | "soon" | "expired";

/** Whole calendar days from asOf (UTC date) until expiresOn (UTC date), inclusive of expiry day as 0 when same day. */
export function daysUntilExpiryCalendar(
  expiresOn: string | null | undefined,
  asOf: Date
): number | null {
  if (expiresOn == null || String(expiresOn).trim() === "") return null;
  const exp = parseIsoDateOnly(String(expiresOn));
  if (!exp) return null;
  const t = new Date(asOf);
  const todayUtc = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  return Math.round((exp.getTime() - todayUtc) / 86400000);
}

export function expiryUiStatus(
  expiresOn: string | null | undefined,
  asOf: Date,
  soonThresholdDays = 60
): ExpiryUiStatus {
  if (expiresOn == null || String(expiresOn).trim() === "") return "none";
  if (isCertificationExpired(expiresOn, asOf)) return "expired";
  const days = daysUntilExpiryCalendar(expiresOn, asOf);
  if (days !== null && days >= 0 && days <= soonThresholdDays) return "soon";
  return "ok";
}

export type CertificationInventoryItem = {
  name: string;
  expiresOn: string | null;
  daysUntilExpiry: number | null;
  expiryStatus: ExpiryUiStatus;
};

/** Every profile certification with expiry context (includes expired — not only “active” matches). */
export function buildProfileCertificationInventory(
  certifications: string[] | null | undefined,
  expirations: CertificationExpirationMap | null | undefined,
  asOf: Date = new Date()
): CertificationInventoryItem[] {
  const list = certifications ?? [];
  const exp = expirations ?? {};
  return list.map((name) => {
    const eo = exp[name] ?? null;
    return {
      name,
      expiresOn: eo,
      daysUntilExpiry: daysUntilExpiryCalendar(eo, asOf),
      expiryStatus: expiryUiStatus(eo, asOf),
    };
  });
}

export function normalizeCertificationExpirationsPayload(
  body: unknown,
  allowedNames: Set<string>
): CertificationExpirationMap {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {};
  }
  const out: CertificationExpirationMap = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    const name = k.trim();
    if (!allowedNames.has(name)) continue;
    if (v === null || v === "") continue;
    if (typeof v !== "string") continue;
    const d = v.trim();
    if (!DATE_ONLY.test(d)) continue;
    if (!parseIsoDateOnly(d)) continue;
    out[name] = d;
  }
  return out;
}
