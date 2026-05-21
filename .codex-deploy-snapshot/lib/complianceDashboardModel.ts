export type ComplianceCellState = "match" | "gap" | "na";

export type ComplianceRowInput = {
  userId: string;
  name: string;
  email: string;
  cells: Record<string, ComplianceCellState | string>;
  cellDetails?: Record<
    string,
    { expiryStatus?: "none" | "ok" | "soon" | "expired" }
  >;
  certificationInventory?: Array<{
    name: string;
    expiresOn: string | null;
    daysUntilExpiry: number | null;
    expiryStatus: string;
  }>;
  profileFields: { tradeSpecialty: string; jobTitle: string };
};

export type ComplianceRequirementInput = { id: string; title: string };

export type ComplianceDashboardModel = {
  totalPeople: number;
  totalRequirements: number;
  met: number;
  gap: number;
  na: number;
  scoped: number;
  compliancePct: number;
  fullyCompliantPeople: number;
  metExpiringSoon: number;
  expiredCreds: number;
  soonCreds: number;
  requirementBars: Array<{ name: string; gaps: number; fullTitle: string }>;
  tradeBars: Array<{
    name: string;
    fullTrade: string;
    pct: number;
    met: number;
    scoped: number;
  }>;
};

function cellState(row: ComplianceRowInput, reqId: string): ComplianceCellState {
  const s = row.cells[reqId] ?? "gap";
  if (s === "match" || s === "gap" || s === "na") return s;
  return "gap";
}

export function buildComplianceDashboardModel(
  rows: ComplianceRowInput[],
  requirements: ComplianceRequirementInput[]
): ComplianceDashboardModel | null {
  if (!requirements.length) return null;

  let met = 0;
  let gap = 0;
  let na = 0;
  let metExpiringSoon = 0;
  let expiredCreds = 0;
  let soonCreds = 0;

  const reqGaps: Record<string, { title: string; gaps: number }> = {};
  for (const r of requirements) {
    reqGaps[r.id] = { title: r.title, gaps: 0 };
  }

  for (const row of rows) {
    for (const r of requirements) {
      const s = cellState(row, r.id);
      if (s === "match") {
        met++;
        const d = row.cellDetails?.[r.id];
        if (d?.expiryStatus === "soon") metExpiringSoon++;
      } else if (s === "na") na++;
      else {
        gap++;
        reqGaps[r.id].gaps++;
      }
    }
    for (const c of row.certificationInventory ?? []) {
      if (c.expiryStatus === "expired") expiredCreds++;
      else if (c.expiryStatus === "soon") soonCreds++;
    }
  }

  const scoped = met + gap;
  const compliancePct = scoped > 0 ? Math.round((met / scoped) * 1000) / 10 : 0;

  let fullyCompliantPeople = 0;
  const tradeMap = new Map<string, { met: number; scoped: number }>();

  for (const row of rows) {
    let rowGaps = 0;
    let rowScoped = 0;
    for (const r of requirements) {
      const s = cellState(row, r.id);
      if (s === "na") continue;
      rowScoped++;
      if (s === "gap") rowGaps++;
    }
    if (rowScoped > 0 && rowGaps === 0) fullyCompliantPeople++;

    const trade = row.profileFields.tradeSpecialty?.trim() || "Unspecified trade";
    const t = tradeMap.get(trade) ?? { met: 0, scoped: 0 };
    for (const r of requirements) {
      const s = cellState(row, r.id);
      if (s === "na") continue;
      t.scoped++;
      if (s === "match") t.met++;
    }
    tradeMap.set(trade, t);
  }

  const requirementBars = requirements
    .map((r) => {
      const title = r.title;
      const short = title.length > 30 ? `${title.slice(0, 28)}…` : title;
      return { name: short, gaps: reqGaps[r.id].gaps, fullTitle: title };
    })
    .sort((a, b) => b.gaps - a.gaps)
    .slice(0, 12);

  const tradeBars = [...tradeMap.entries()]
    .map(([trade, v]) => ({
      name: trade.length > 22 ? `${trade.slice(0, 20)}…` : trade,
      fullTrade: trade,
      pct: v.scoped > 0 ? Math.round((v.met / v.scoped) * 1000) / 10 : 0,
      met: v.met,
      scoped: v.scoped,
    }))
    .filter((x) => x.scoped > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 10);

  return {
    totalPeople: rows.length,
    totalRequirements: requirements.length,
    met,
    gap,
    na,
    scoped,
    compliancePct,
    fullyCompliantPeople,
    metExpiringSoon,
    expiredCreds,
    soonCreds,
    requirementBars,
    tradeBars,
  };
}

export type FlatCredentialRow = {
  person: string;
  userId: string;
  email: string;
  cert: string;
  expiresOn: string | null;
  status: string;
  statusKey: string;
};

export function flattenCredentialLedger(
  rows: Array<{
    name: string;
    userId: string;
    email: string;
    certificationInventory?: Array<{
      name: string;
      expiresOn: string | null;
      expiryStatus: string;
      daysUntilExpiry: number | null;
    }>;
  }>
): FlatCredentialRow[] {
  const out: FlatCredentialRow[] = [];
  for (const row of rows) {
    for (const c of row.certificationInventory ?? []) {
      let status = "Current";
      if (c.expiryStatus === "expired") status = "Expired";
      else if (c.expiryStatus === "soon") status = "Expiring soon";
      else if (c.expiryStatus === "none") status = "No date on file";
      else if (c.expiryStatus === "ok") status = "Good";
      out.push({
        person: row.name,
        userId: row.userId,
        email: row.email,
        cert: c.name,
        expiresOn: c.expiresOn,
        status,
        statusKey: c.expiryStatus,
      });
    }
  }
  return out.sort(
    (a, b) => a.person.localeCompare(b.person) || a.cert.localeCompare(b.cert)
  );
}
