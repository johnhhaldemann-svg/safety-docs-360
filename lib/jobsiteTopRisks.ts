export type JobsiteTopRiskLevel = "low" | "moderate" | "high" | "critical";

export type JobsiteTopRiskSourceType =
  | "incident"
  | "corrective_action"
  | "permit"
  | "scheduled_work"
  | "activity";

export type JobsiteTopRiskEvidenceRow = {
  source: JobsiteTopRiskSourceType;
  id?: string | null;
  title?: string | null;
  category?: string | null;
  severity?: string | null;
  priority?: string | null;
  status?: string | null;
  riskLevel?: string | null;
  isHighRisk?: boolean | null;
  sifPotential?: boolean | null;
  sifFlag?: boolean | null;
  stopWorkStatus?: string | null;
  escalationLevel?: string | null;
  hazardCategories?: string[] | string | null;
  permitTriggers?: string[] | string | null;
  permitType?: string | null;
  description?: string | null;
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type JobsiteTopRisk = {
  id: string;
  rank: number;
  title: string;
  riskLevel: JobsiteTopRiskLevel;
  score: number;
  evidenceCount: number;
  topDrivers: string[];
  nextAction: string;
  sources: Array<{ type: JobsiteTopRiskSourceType; count: number }>;
};

type RiskTaxonomyItem = {
  id: string;
  title: string;
  keywords: RegExp[];
  defaultAction: string;
};

type RiskAccumulator = {
  taxonomy: RiskTaxonomyItem;
  score: number;
  evidenceCount: number;
  maxEvidenceLevel: JobsiteTopRiskLevel;
  drivers: string[];
  sourceCounts: Map<JobsiteTopRiskSourceType, number>;
};

export const JOBSITE_TOP_RISK_TAXONOMY: RiskTaxonomyItem[] = [
  {
    id: "falls_from_elevation",
    title: "Falls from elevation",
    keywords: [/fall|height|elevat|roof|edge|aerial|lift|ladder|scaffold|platform|mewp/],
    defaultAction: "Verify fall protection, access, anchor points, rescue planning, and pre-task controls before elevated work starts.",
  },
  {
    id: "mobile_equipment_struck_by",
    title: "Mobile equipment / struck-by",
    keywords: [/mobile equipment|struck[\s-]?by|line of fire|equipment|vehicle|forklift|loader|telehandler|traffic|backing/],
    defaultAction: "Confirm equipment routes, spotters, exclusion zones, and pedestrian separation are understood in the field.",
  },
  {
    id: "electrical_exposure",
    title: "Electrical exposure",
    keywords: [/electrical|electric|energized|loto|lockout|tagout|power|arc flash|temporary power|panel/],
    defaultAction: "Verify de-energization, LOTO boundaries, qualified worker controls, and temporary power protection.",
  },
  {
    id: "excavation_trenching",
    title: "Excavation / trenching",
    keywords: [/excavat|trench|shoring|slope|bench|spoils|utility locate|underground/],
    defaultAction: "Confirm competent-person inspection, access/egress, protective system, spoil placement, and utility controls.",
  },
  {
    id: "hot_work_fire",
    title: "Hot work / fire risk",
    keywords: [/hot work|weld|cutting|torch|burn|fire|spark|grind|flame|combustible/],
    defaultAction: "Verify hot-work permit needs, fire watch, extinguisher placement, combustible clearance, and post-work monitoring.",
  },
  {
    id: "crane_rigging",
    title: "Crane and rigging",
    keywords: [/crane|rigging|critical lift|lift plan|hoist|signal person|suspended load|steel erection/],
    defaultAction: "Review lift plan, rigging condition, qualified roles, swing radius, ground conditions, and exclusion zones.",
  },
  {
    id: "housekeeping_access_egress",
    title: "Poor housekeeping / access-egress",
    keywords: [/housekeeping|access|egress|debris|trash|slip|trip|walkway|stair|corridor|material storage/],
    defaultAction: "Walk access routes, remove debris, protect openings, and keep exits, stairs, and laydown areas controlled.",
  },
  {
    id: "falling_objects_overhead",
    title: "Falling objects / overhead work",
    keywords: [/falling object|overhead|dropped object|toe board|tool tether|above|below work|overhead work/],
    defaultAction: "Confirm overhead work zones, barricades, tool/material restraint, and communication with crews below.",
  },
  {
    id: "chemical_hazcom_exposure",
    title: "Chemical / hazcom exposure",
    keywords: [/chemical|hazcom|sds|silica|solvent|paint|epoxy|adhesive|asbestos|lead|fume|dust|respirator/],
    defaultAction: "Verify SDS access, ventilation, exposure controls, PPE, storage, labeling, and worker briefing.",
  },
  {
    id: "confined_space_atmospheric",
    title: "Confined space / atmospheric exposure",
    keywords: [/confined|atmospher|oxygen|gas monitor|permit space|entrant|attendant|rescue|ventilation/],
    defaultAction: "Confirm permit-space classification, atmospheric testing, rescue readiness, attendant coverage, and ventilation.",
  },
];

const TAXONOMY_BY_ID = new Map(JOBSITE_TOP_RISK_TAXONOMY.map((item) => [item.id, item]));

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ");
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function riskLevelRank(level: JobsiteTopRiskLevel) {
  if (level === "critical") return 4;
  if (level === "high") return 3;
  if (level === "moderate") return 2;
  return 1;
}

function maxRiskLevel(a: JobsiteTopRiskLevel, b: JobsiteTopRiskLevel): JobsiteTopRiskLevel {
  return riskLevelRank(a) >= riskLevelRank(b) ? a : b;
}

function evidenceLevel(row: JobsiteTopRiskEvidenceRow): JobsiteTopRiskLevel {
  const severity = normalizeText(row.severity);
  const priority = normalizeText(row.priority);
  const riskLevel = normalizeText(row.riskLevel);
  const status = normalizeText(row.status);
  const stopWork = normalizeText(row.stopWorkStatus);
  const escalation = normalizeText(row.escalationLevel);

  if (
    row.sifPotential ||
    row.sifFlag ||
    severity === "critical" ||
    priority === "critical" ||
    riskLevel === "critical" ||
    status.includes("stop work") ||
    status === "stop_work" ||
    stopWork.includes("stop") ||
    escalation === "critical"
  ) {
    return "critical";
  }

  if (
    severity === "high" ||
    priority === "high" ||
    riskLevel === "high" ||
    row.isHighRisk ||
    status === "blocked" ||
    escalation === "high"
  ) {
    return "high";
  }

  if (severity === "medium" || severity === "moderate" || priority === "medium" || priority === "moderate" || riskLevel === "medium" || riskLevel === "moderate") {
    return "moderate";
  }

  return "low";
}

function baseEvidenceScore(level: JobsiteTopRiskLevel) {
  if (level === "critical") return 90;
  if (level === "high") return 48;
  if (level === "moderate") return 24;
  return 10;
}

function recencyScore(row: JobsiteTopRiskEvidenceRow, now: Date) {
  const rawDate = row.updatedAt || row.createdAt;
  if (!rawDate) return 0;
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return 0;
  const ageDays = Math.max(0, (now.getTime() - date.getTime()) / 86_400_000);
  if (ageDays <= 7) return 15;
  if (ageDays <= 30) return 8;
  if (ageDays <= 90) return 3;
  return 0;
}

function rowText(row: JobsiteTopRiskEvidenceRow) {
  return [
    row.title,
    row.category,
    row.permitType,
    row.description,
    row.notes,
    row.status,
    row.riskLevel,
    ...stringList(row.hazardCategories),
    ...stringList(row.permitTriggers),
  ]
    .filter(Boolean)
    .join(" ");
}

function matchedTaxonomyIds(row: JobsiteTopRiskEvidenceRow): string[] {
  const text = normalizeText(rowText(row));
  if (!text) return [];
  const ids: string[] = [];
  for (const item of JOBSITE_TOP_RISK_TAXONOMY) {
    if (item.keywords.some((keyword) => keyword.test(text))) ids.push(item.id);
  }
  return ids;
}

function driverForRow(row: JobsiteTopRiskEvidenceRow, level: JobsiteTopRiskLevel) {
  const sourceLabel =
    row.source === "corrective_action"
      ? "Corrective action"
      : row.source === "scheduled_work"
        ? "Scheduled work"
        : row.source === "activity"
          ? "Daily activity"
          : row.source.charAt(0).toUpperCase() + row.source.slice(1);
  const title = String(row.title ?? row.category ?? row.permitType ?? "field signal").trim();
  if (level === "critical") return `${sourceLabel}: ${title} needs immediate review.`;
  if (level === "high") return `${sourceLabel}: ${title} is a high-risk signal.`;
  return `${sourceLabel}: ${title} contributes to this risk.`;
}

function levelFromScore(score: number, maxEvidenceLevel: JobsiteTopRiskLevel, evidenceCount: number): JobsiteTopRiskLevel {
  if (maxEvidenceLevel === "critical" || score >= 95) return "critical";
  if (maxEvidenceLevel === "high" || score >= 52) return "high";
  if (evidenceCount > 0 || score >= 22) return "moderate";
  return "low";
}

function nextActionForRisk(item: RiskTaxonomyItem, level: JobsiteTopRiskLevel, evidenceCount: number) {
  if (level === "critical") return `Immediate review needed. ${item.defaultAction}`;
  if (level === "high") return `Review before work proceeds. ${item.defaultAction}`;
  if (evidenceCount === 0) return "No active signal yet. Keep this risk in the pre-task review and verify controls if the work scope changes.";
  return item.defaultAction;
}

function initializeAccumulators() {
  const out = new Map<string, RiskAccumulator>();
  for (const taxonomy of JOBSITE_TOP_RISK_TAXONOMY) {
    out.set(taxonomy.id, {
      taxonomy,
      score: 0,
      evidenceCount: 0,
      maxEvidenceLevel: "low",
      drivers: [],
      sourceCounts: new Map(),
    });
  }
  return out;
}

export function buildTopJobsiteRisks(
  rows: JobsiteTopRiskEvidenceRow[],
  options: { now?: Date } = {}
): JobsiteTopRisk[] {
  const now = options.now ?? new Date();
  const accumulators = initializeAccumulators();

  for (const row of rows) {
    const matches = matchedTaxonomyIds(row);
    if (matches.length === 0) continue;

    const level = evidenceLevel(row);
    const score =
      baseEvidenceScore(level) +
      recencyScore(row, now) +
      (row.sifPotential || row.sifFlag ? 30 : 0) +
      (normalizeText(row.stopWorkStatus).includes("stop") || normalizeText(row.status).includes("stop") ? 35 : 0) +
      (stringList(row.hazardCategories).length > 0 ? 8 : 0) +
      (stringList(row.permitTriggers).length > 0 ? 10 : 0);
    const perMatchScore = Math.max(1, Math.round(score / matches.length));

    for (const id of matches) {
      const acc = accumulators.get(id);
      if (!acc) continue;
      acc.score += perMatchScore;
      acc.evidenceCount += 1;
      acc.maxEvidenceLevel = maxRiskLevel(acc.maxEvidenceLevel, level);
      acc.sourceCounts.set(row.source, (acc.sourceCounts.get(row.source) ?? 0) + 1);
      const driver = driverForRow(row, level);
      if (!acc.drivers.includes(driver)) acc.drivers.push(driver);
    }
  }

  return Array.from(accumulators.values())
    .map((acc) => {
      const score = Math.round(acc.score);
      const riskLevel = levelFromScore(score, acc.maxEvidenceLevel, acc.evidenceCount);
      return {
        id: acc.taxonomy.id,
        title: acc.taxonomy.title,
        riskLevel,
        score,
        evidenceCount: acc.evidenceCount,
        topDrivers:
          acc.drivers.length > 0
            ? acc.drivers.slice(0, 3)
            : ["No active signal yet."],
        nextAction: nextActionForRisk(acc.taxonomy, riskLevel, acc.evidenceCount),
        sources: Array.from(acc.sourceCounts.entries())
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type)),
      } satisfies Omit<JobsiteTopRisk, "rank">;
    })
    .sort((a, b) => {
      const riskDiff = riskLevelRank(b.riskLevel) - riskLevelRank(a.riskLevel);
      if (riskDiff) return riskDiff;
      if (b.score !== a.score) return b.score - a.score;
      if (b.evidenceCount !== a.evidenceCount) return b.evidenceCount - a.evidenceCount;
      const aIndex = JOBSITE_TOP_RISK_TAXONOMY.findIndex((item) => item.id === a.id);
      const bIndex = JOBSITE_TOP_RISK_TAXONOMY.findIndex((item) => item.id === b.id);
      return aIndex - bIndex;
    })
    .slice(0, 10)
    .map((risk, index) => ({ ...risk, rank: index + 1 }));
}

export function jobsiteTopRiskFromId(id: string) {
  return TAXONOMY_BY_ID.get(id) ?? null;
}
