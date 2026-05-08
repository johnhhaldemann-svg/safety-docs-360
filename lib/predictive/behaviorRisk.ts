export type BehaviorRiskLevel = "Low" | "Moderate" | "Elevated" | "High" | "Critical";

export type BehaviorRiskDriverId =
  | "weak_jsa_language"
  | "missing_critical_control"
  | "permit_mismatch"
  | "training_gap"
  | "repeat_observation"
  | "open_corrective_action"
  | "missing_supervisor_verification"
  | "trade_overlap"
  | "schedule_pressure"
  | "control_dependency"
  | "prior_incident_pattern";

export type BehaviorRiskSourceType =
  | "jsa"
  | "permit"
  | "training"
  | "sor"
  | "corrective_action"
  | "incident"
  | "inspection"
  | "schedule"
  | "manual_review";

export type BehaviorRiskDriverSummary = {
  driver: BehaviorRiskDriverId;
  label: string;
  points: number;
  description: string;
};

export type BehaviorRiskSourceEvent = {
  id: string;
  projectId?: string | null;
  jobsiteId?: string | null;
  trade?: string | null;
  crewId?: string | null;
  supervisorId?: string | null;
  workArea?: string | null;
  taskName?: string | null;
  sourceType: BehaviorRiskSourceType;
  sourceId?: string | null;
  riskDriver: BehaviorRiskDriverId;
  riskPoints: number;
  severity?: string | null;
  description: string;
  recommendedAction: string;
  status?: string | null;
  createdAt?: string | null;
};

export type BehaviorRiskRollup = {
  id: string;
  label: string;
  behaviorRiskScore: number;
  riskLevel: BehaviorRiskLevel;
  points: number;
  topDrivers: BehaviorRiskDriverSummary[];
};

export type BehaviorRiskResult = {
  behaviorRiskScore: number;
  riskLevel: BehaviorRiskLevel;
  topDrivers: BehaviorRiskDriverSummary[];
  recommendedActions: string[];
  sourceEvents: BehaviorRiskSourceEvent[];
  byTrade: BehaviorRiskRollup[];
  bySupervisor: BehaviorRiskRollup[];
};

export type BehaviorRiskJsaActivityRow = {
  id?: string | null;
  jobsite_id?: string | null;
  work_date?: string | null;
  trade?: string | null;
  activity_name?: string | null;
  area?: string | null;
  crew_size?: number | null;
  hazard_category?: string | null;
  hazard_description?: string | null;
  mitigation?: string | null;
  permit_required?: boolean | null;
  permit_type?: string | null;
  planned_risk_level?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  crew_id?: string | null;
  supervisor_id?: string | null;
  supervisor_name?: string | null;
};

export type BehaviorRiskPermitRow = {
  id?: string | null;
  jobsite_id?: string | null;
  permit_type?: string | null;
  title?: string | null;
  status?: string | null;
  severity?: string | null;
  created_at?: string | null;
  due_at?: string | null;
};

export type BehaviorRiskCorrectiveActionRow = {
  id?: string | null;
  jobsite_id?: string | null;
  title?: string | null;
  category?: string | null;
  severity?: string | null;
  priority?: string | null;
  status?: string | null;
  due_at?: string | null;
  created_at?: string | null;
};

export type BehaviorRiskIncidentRow = {
  id?: string | null;
  jobsite_id?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  severity?: string | null;
  status?: string | null;
  created_at?: string | null;
  occurred_at?: string | null;
};

export type BehaviorRiskObservationRow = {
  id?: string | null;
  date?: string | null;
  jobsite_id?: string | null;
  location?: string | null;
  trade?: string | null;
  category?: string | null;
  hazard_category_code?: string | null;
  subcategory?: string | null;
  description?: string | null;
  severity?: string | null;
  status?: string | null;
  observation_type?: string | null;
  created_at?: string | null;
};

export type BehaviorRiskTrainingGapRow = {
  id?: string | null;
  worker_id?: string | null;
  worker_name?: string | null;
  jobsite_id?: string | null;
  trade?: string | null;
  task_name?: string | null;
  requirement?: string | null;
  status?: string | null;
  expires_at?: string | null;
};

export type BehaviorRiskInput = {
  projectId?: string | null;
  lookAheadDays?: number | null;
  includeResolved?: boolean | null;
  now?: Date;
  jsaActivities?: BehaviorRiskJsaActivityRow[];
  permits?: BehaviorRiskPermitRow[];
  correctiveActions?: BehaviorRiskCorrectiveActionRow[];
  incidents?: BehaviorRiskIncidentRow[];
  observations?: BehaviorRiskObservationRow[];
  trainingGaps?: BehaviorRiskTrainingGapRow[];
};

const WEAK_LANGUAGE = [
  "be careful",
  "stay aware",
  "watch surroundings",
  "watch your surroundings",
  "use ppe",
  "follow policy",
  "pay attention",
  "use caution",
];

const STRONG_CONTROL_TERMS = [
  "anchor",
  "barricade",
  "checklist",
  "competent person",
  "document",
  "engineered",
  "exclusion zone",
  "fire watch",
  "foreman",
  "guardrail",
  "inspect",
  "lockout",
  "loto",
  "permit",
  "rescue",
  "sign-off",
  "sign off",
  "spotter",
  "supervisor",
  "tag line",
  "tag-line",
  "test",
  "tie-off",
  "verify",
];

const PPE_ADMIN_TERMS = ["ppe", "policy", "procedure", "training", "reminder", "awareness", "administrative"];

const DRIVER_LABELS: Record<BehaviorRiskDriverId, string> = {
  weak_jsa_language: "Weak JSA language",
  missing_critical_control: "Missing critical control",
  permit_mismatch: "Permit mismatch",
  training_gap: "Training gap",
  repeat_observation: "Repeat observation",
  open_corrective_action: "Open corrective action",
  missing_supervisor_verification: "Missing supervisor verification",
  trade_overlap: "Trade overlap",
  schedule_pressure: "Schedule pressure",
  control_dependency: "Control dependency",
  prior_incident_pattern: "Prior incident pattern",
};

const DRIVER_ACTIONS: Record<BehaviorRiskDriverId, string> = {
  weak_jsa_language: "Return JSA for revision with task-specific controls.",
  missing_critical_control: "Critical controls need confirmation before work starts.",
  permit_mismatch: "Link or create required permit before task approval.",
  training_gap: "Confirm assigned workers have current task-specific training.",
  repeat_observation: "Assign field observation to the safety manager for this crew/trade.",
  open_corrective_action: "Review overdue corrective actions before allowing repeated work.",
  missing_supervisor_verification: "Require supervisor field verification before work starts.",
  trade_overlap: "Coordinate overlapping trades before releasing the work area.",
  schedule_pressure: "Add this task to the daily safety briefing.",
  control_dependency: "Upgrade controls beyond PPE or reminders where practical.",
  prior_incident_pattern: "Supervisor coaching recommended before repeating this task.",
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function classifyBehaviorRisk(score: number): BehaviorRiskLevel {
  if (score >= 81) return "Critical";
  if (score >= 61) return "High";
  if (score >= 41) return "Elevated";
  if (score >= 21) return "Moderate";
  return "Low";
}

function norm(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function compact(value: unknown) {
  return String(value ?? "").trim();
}

function titleCase(raw: string) {
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isOpenStatus(status?: string | null) {
  const value = norm(status);
  return !["closed", "verified_closed", "complete", "completed", "resolved", "cancelled", "archived"].includes(value);
}

function isResolvedEvent(status?: string | null) {
  return !isOpenStatus(status);
}

function isWithinLookAhead(date: Date | null, now: Date, days: number) {
  if (!date) return false;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + days * 86400000);
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

function sameRecentWindow(date: Date | null, now: Date, days: number) {
  if (!date) return false;
  return date.getTime() >= now.getTime() - days * 86400000 && date.getTime() <= now.getTime() + 86400000;
}

function textForActivity(row: BehaviorRiskJsaActivityRow) {
  return [row.activity_name, row.hazard_category, row.hazard_description, row.mitigation, row.permit_type]
    .map(compact)
    .filter(Boolean)
    .join(" ");
}

function hasAny(text: string, terms: string[]) {
  const value = norm(text);
  return terms.some((term) => value.includes(term));
}

function weakLanguageTerms(text: string) {
  const value = norm(text);
  return WEAK_LANGUAGE.filter((term) => value.includes(term));
}

function hasSpecificControl(text: string) {
  return hasAny(text, STRONG_CONTROL_TERMS);
}

function isHighRiskActivity(row: BehaviorRiskJsaActivityRow) {
  const text = norm(textForActivity(row));
  const planned = norm(row.planned_risk_level);
  return (
    planned === "high" ||
    planned === "critical" ||
    /fall|height|roof|edge|lift|aerial|confined|excavat|trench|hot work|weld|cutting|electrical|loto|lockout|crane|rigging|steel|energized/.test(
      text
    )
  );
}

function expectedPermitType(row: BehaviorRiskJsaActivityRow) {
  if (row.permit_required && compact(row.permit_type)) return compact(row.permit_type);
  const text = norm(textForActivity(row));
  if (/hot work|weld|cutting|burn/.test(text)) return "hot work";
  if (/confined/.test(text)) return "confined space";
  if (/excavat|trench/.test(text)) return "excavation";
  if (/loto|lockout|energized|electrical/.test(text)) return "loto";
  return null;
}

function permitMatches(activity: BehaviorRiskJsaActivityRow, permit: BehaviorRiskPermitRow, expected: string) {
  if (activity.jobsite_id && permit.jobsite_id && activity.jobsite_id !== permit.jobsite_id) return false;
  if (norm(permit.status) !== "active") return false;
  const permitText = norm(`${permit.permit_type ?? ""} ${permit.title ?? ""}`);
  const expectedTokens = norm(expected).split(/[^a-z0-9]+/).filter(Boolean);
  return expectedTokens.some((token) => permitText.includes(token));
}

function missingCriticalControl(row: BehaviorRiskJsaActivityRow) {
  const text = norm(textForActivity(row));
  const mitigation = norm(row.mitigation);
  if (!isHighRiskActivity(row)) return false;
  if (!mitigation) return true;
  if (/fall|height|roof|edge|lift|aerial/.test(text)) {
    return !/(anchor|tie-off|tie off|guardrail|rescue|inspect|competent person)/.test(mitigation);
  }
  if (/hot work|weld|cutting|burn/.test(text)) {
    return !/(fire watch|extinguisher|hot work permit|spark|combustible|permit)/.test(mitigation);
  }
  if (/electrical|loto|lockout|energized/.test(text)) {
    return !/(lockout|loto|verify|test|qualified|de-energ)/.test(mitigation);
  }
  if (/confined/.test(text)) {
    return !/(air monitor|atmosphere|attendant|rescue|permit|ventilat)/.test(mitigation);
  }
  if (/excavat|trench/.test(text)) {
    return !/(competent person|bench|slope|shore|shield|ladder|access|egress)/.test(mitigation);
  }
  return !hasSpecificControl(mitigation);
}

function hazardKey(value?: string | null) {
  const key = norm(value).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return key || "general";
}

function activityHazardKeys(rows: BehaviorRiskJsaActivityRow[]) {
  return new Set(rows.flatMap((row) => [row.hazard_category, row.activity_name].map(hazardKey)));
}

function eventId(driver: BehaviorRiskDriverId, sourceType: BehaviorRiskSourceType, sourceId: string | null | undefined, suffix = "") {
  return [driver, sourceType, sourceId || "summary", suffix].filter(Boolean).join(":");
}

function eventFrom(params: Omit<BehaviorRiskSourceEvent, "id" | "recommendedAction" | "createdAt"> & { id?: string; createdAt?: string | null }) {
  return {
    ...params,
    id: params.id ?? eventId(params.riskDriver, params.sourceType, params.sourceId),
    recommendedAction: DRIVER_ACTIONS[params.riskDriver],
    createdAt: params.createdAt ?? null,
  };
}

function aggregateDrivers(events: BehaviorRiskSourceEvent[]): BehaviorRiskDriverSummary[] {
  const byDriver = new Map<BehaviorRiskDriverId, { points: number; descriptions: string[] }>();
  for (const event of events) {
    const existing = byDriver.get(event.riskDriver) ?? { points: 0, descriptions: [] };
    existing.points += event.riskPoints;
    if (!existing.descriptions.includes(event.description)) existing.descriptions.push(event.description);
    byDriver.set(event.riskDriver, existing);
  }
  return [...byDriver.entries()]
    .map(([driver, value]) => ({
      driver,
      label: DRIVER_LABELS[driver],
      points: value.points,
      description: value.descriptions[0] ?? DRIVER_LABELS[driver],
    }))
    .sort((a, b) => b.points - a.points || a.label.localeCompare(b.label))
    .slice(0, 10);
}

function aggregateRollup(events: BehaviorRiskSourceEvent[], field: "trade" | "supervisorId") {
  const groups = new Map<string, BehaviorRiskSourceEvent[]>();
  for (const event of events) {
    const raw = field === "trade" ? event.trade : event.supervisorId;
    const key = compact(raw);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return [...groups.entries()]
    .map(([id, rows]): BehaviorRiskRollup => {
      const points = rows.reduce((sum, row) => sum + row.riskPoints, 0);
      const score = clamp(points, 0, 100);
      return {
        id,
        label: field === "trade" ? titleCase(id) : id,
        behaviorRiskScore: score,
        riskLevel: classifyBehaviorRisk(score),
        points,
        topDrivers: aggregateDrivers(rows).slice(0, 3),
      };
    })
    .sort((a, b) => b.behaviorRiskScore - a.behaviorRiskScore || a.label.localeCompare(b.label))
    .slice(0, 6);
}

function recommendationList(drivers: BehaviorRiskDriverSummary[], score: number) {
  const actions = drivers.map((driver) => DRIVER_ACTIONS[driver.driver]);
  if (score >= 61) actions.unshift("Field verification required before risky work begins.");
  if (score >= 81) actions.unshift("Stop-work recommendation until safety manager review is complete.");
  return [...new Set(actions)].slice(0, 6);
}

export function calculateBehaviorRisk(input: BehaviorRiskInput): BehaviorRiskResult {
  const now = input.now ?? new Date();
  const lookAheadDays = clamp(Math.floor(input.lookAheadDays ?? 7), 1, 30);
  const projectId = input.projectId ?? null;
  const jsaActivities = input.jsaActivities ?? [];
  const permits = input.permits ?? [];
  const correctiveActions = input.correctiveActions ?? [];
  const incidents = input.incidents ?? [];
  const observations = input.observations ?? [];
  const trainingGaps = input.trainingGaps ?? [];
  const scheduled = jsaActivities.filter((row) => isWithinLookAhead(parseDate(row.work_date ?? row.created_at), now, lookAheadDays));
  const activeScheduled = scheduled.filter((row) => input.includeResolved || !isResolvedEvent(row.status));
  const highRiskScheduled = activeScheduled.filter(isHighRiskActivity);
  const events: BehaviorRiskSourceEvent[] = [];

  for (const row of highRiskScheduled) {
    events.push(
      eventFrom({
        projectId,
        jobsiteId: row.jobsite_id ?? null,
        trade: row.trade ?? null,
        crewId: row.crew_id ?? null,
        supervisorId: row.supervisor_id ?? row.supervisor_name ?? null,
        workArea: row.area ?? null,
        taskName: row.activity_name ?? null,
        sourceType: "schedule",
        sourceId: row.id ?? null,
        riskDriver: "schedule_pressure",
        riskPoints: 15,
        severity: row.planned_risk_level ?? null,
        status: row.status ?? null,
        description: `${row.activity_name ?? "High-risk work"} is scheduled within the look-ahead window.`,
        createdAt: row.created_at ?? null,
      })
    );
  }

  for (const row of activeScheduled) {
    const text = textForActivity(row);
    const weakTerms = weakLanguageTerms(text);
    if (weakTerms.length > 0 && !hasSpecificControl(row.mitigation ?? "")) {
      events.push(
        eventFrom({
          projectId,
          jobsiteId: row.jobsite_id ?? null,
          trade: row.trade ?? null,
          crewId: row.crew_id ?? null,
          supervisorId: row.supervisor_id ?? row.supervisor_name ?? null,
          workArea: row.area ?? null,
          taskName: row.activity_name ?? null,
          sourceType: "jsa",
          sourceId: row.id ?? null,
          riskDriver: "weak_jsa_language",
          riskPoints: 10,
          severity: row.planned_risk_level ?? null,
          status: row.status ?? null,
          description: `JSA uses non-specific control language such as "${weakTerms[0]}".`,
          createdAt: row.created_at ?? null,
        })
      );
    }

    if (missingCriticalControl(row)) {
      events.push(
        eventFrom({
          projectId,
          jobsiteId: row.jobsite_id ?? null,
          trade: row.trade ?? null,
          crewId: row.crew_id ?? null,
          supervisorId: row.supervisor_id ?? row.supervisor_name ?? null,
          workArea: row.area ?? null,
          taskName: row.activity_name ?? null,
          sourceType: "jsa",
          sourceId: row.id ?? null,
          riskDriver: "missing_critical_control",
          riskPoints: 10,
          severity: row.planned_risk_level ?? null,
          status: row.status ?? null,
          description: `${row.activity_name ?? "JSA activity"} lacks task-specific critical controls.`,
          createdAt: row.created_at ?? null,
        })
      );
    }

    const expectedPermit = expectedPermitType(row);
    if (expectedPermit && !permits.some((permit) => permitMatches(row, permit, expectedPermit))) {
      events.push(
        eventFrom({
          projectId,
          jobsiteId: row.jobsite_id ?? null,
          trade: row.trade ?? null,
          crewId: row.crew_id ?? null,
          supervisorId: row.supervisor_id ?? row.supervisor_name ?? null,
          workArea: row.area ?? null,
          taskName: row.activity_name ?? null,
          sourceType: "permit",
          sourceId: row.id ?? null,
          riskDriver: "permit_mismatch",
          riskPoints: 15,
          severity: row.planned_risk_level ?? null,
          status: row.status ?? null,
          description: `${titleCase(expectedPermit)} work is scheduled but no matching active permit is linked.`,
          createdAt: row.created_at ?? null,
        })
      );
    }

    if (isHighRiskActivity(row) && !hasAny(row.mitigation ?? "", ["supervisor", "foreman", "verify", "verified", "sign-off", "sign off", "competent person"])) {
      events.push(
        eventFrom({
          projectId,
          jobsiteId: row.jobsite_id ?? null,
          trade: row.trade ?? null,
          crewId: row.crew_id ?? null,
          supervisorId: row.supervisor_id ?? row.supervisor_name ?? null,
          workArea: row.area ?? null,
          taskName: row.activity_name ?? null,
          sourceType: "manual_review",
          sourceId: row.id ?? null,
          riskDriver: "missing_supervisor_verification",
          riskPoints: 10,
          severity: row.planned_risk_level ?? null,
          status: row.status ?? null,
          description: `${row.activity_name ?? "High-risk work"} does not show supervisor field verification.`,
          createdAt: row.created_at ?? null,
        })
      );
    }

    const mitigation = norm(row.mitigation);
    if (hasAny(mitigation, PPE_ADMIN_TERMS) && !hasSpecificControl(mitigation)) {
      events.push(
        eventFrom({
          projectId,
          jobsiteId: row.jobsite_id ?? null,
          trade: row.trade ?? null,
          crewId: row.crew_id ?? null,
          supervisorId: row.supervisor_id ?? row.supervisor_name ?? null,
          workArea: row.area ?? null,
          taskName: row.activity_name ?? null,
          sourceType: "jsa",
          sourceId: row.id ?? null,
          riskDriver: "control_dependency",
          riskPoints: 10,
          severity: row.planned_risk_level ?? null,
          status: row.status ?? null,
          description: "Controls rely heavily on PPE, policy, or reminders without a verified physical control.",
          createdAt: row.created_at ?? null,
        })
      );
    }
  }

  for (const gap of trainingGaps.filter((row) => input.includeResolved || !isResolvedEvent(row.status))) {
    events.push(
      eventFrom({
        projectId,
        jobsiteId: gap.jobsite_id ?? null,
        trade: gap.trade ?? null,
        taskName: gap.task_name ?? gap.requirement ?? null,
        sourceType: "training",
        sourceId: gap.id ?? gap.worker_id ?? null,
        riskDriver: "training_gap",
        riskPoints: 15,
        severity: gap.status ?? "gap",
        status: gap.status ?? null,
        description: `${gap.worker_name ?? "Worker"} has a missing or expired training requirement for assigned work.`,
        createdAt: gap.expires_at ?? null,
      })
    );
  }

  const scheduledHazards = activityHazardKeys(activeScheduled);
  for (const row of correctiveActions.filter((action) => input.includeResolved || isOpenStatus(action.status))) {
    const due = parseDate(row.due_at);
    const category = hazardKey(row.category ?? row.title);
    const relatedToScheduledWork = scheduledHazards.has(category) || scheduledHazards.size === 0;
    if (due && due.getTime() < now.getTime() && relatedToScheduledWork) {
      events.push(
        eventFrom({
          projectId,
          jobsiteId: row.jobsite_id ?? null,
          taskName: row.title ?? null,
          sourceType: "corrective_action",
          sourceId: row.id ?? null,
          riskDriver: "open_corrective_action",
          riskPoints: 10,
          severity: row.severity ?? row.priority ?? null,
          status: row.status ?? null,
          description: "Overdue corrective action remains open while related work may repeat.",
          createdAt: row.created_at ?? null,
        })
      );
    }
  }

  const recentObservationGroups = new Map<string, BehaviorRiskObservationRow[]>();
  for (const row of observations) {
    const date = parseDate(row.created_at ?? row.date);
    if (!sameRecentWindow(date, now, 14)) continue;
    const key = [row.jobsite_id ?? "all", hazardKey(row.hazard_category_code ?? row.category ?? row.subcategory)].join(":");
    recentObservationGroups.set(key, [...(recentObservationGroups.get(key) ?? []), row]);
  }
  for (const [key, rows] of recentObservationGroups) {
    if (rows.length < 2) continue;
    const first = rows[0]!;
    const hazard = key.split(":").at(-1) ?? "hazard";
    events.push(
      eventFrom({
        id: eventId("repeat_observation", "sor", first.id, hazard),
        projectId,
        jobsiteId: first.jobsite_id ?? null,
        trade: first.trade ?? null,
        workArea: first.location ?? null,
        sourceType: "sor",
        sourceId: first.id ?? null,
        riskDriver: "repeat_observation",
        riskPoints: 10,
        severity: first.severity ?? null,
        status: first.status ?? null,
        description: `${rows.length} repeated ${titleCase(hazard)} observation signals appeared in the last 14 days.`,
        createdAt: first.created_at ?? first.date ?? null,
      })
    );
  }

  const overlapGroups = new Map<string, BehaviorRiskJsaActivityRow[]>();
  for (const row of activeScheduled) {
    const area = hazardKey(row.area);
    const date = (row.work_date ?? "").slice(0, 10) || "unscheduled";
    if (area === "general" || !row.trade) continue;
    const key = [row.jobsite_id ?? "all", area, date].join(":");
    overlapGroups.set(key, [...(overlapGroups.get(key) ?? []), row]);
  }
  for (const rows of overlapGroups.values()) {
    const trades = new Set(rows.map((row) => norm(row.trade)).filter(Boolean));
    if (trades.size < 2) continue;
    const first = rows[0]!;
    events.push(
      eventFrom({
        id: eventId("trade_overlap", "schedule", first.id, first.area ?? ""),
        projectId,
        jobsiteId: first.jobsite_id ?? null,
        trade: [...trades].join(", "),
        workArea: first.area ?? null,
        taskName: first.activity_name ?? null,
        sourceType: "schedule",
        sourceId: first.id ?? null,
        riskDriver: "trade_overlap",
        riskPoints: 10,
        severity: "overlap",
        status: first.status ?? null,
        description: "Multiple trades are scheduled in the same work area.",
        createdAt: first.created_at ?? null,
      })
    );
  }

  const avgCrewSize =
    activeScheduled.length > 0
      ? activeScheduled.reduce((sum, row) => sum + Math.max(0, row.crew_size ?? 0), 0) / activeScheduled.length
      : 0;
  for (const row of activeScheduled) {
    const date = parseDate(row.work_date);
    const isWeekend = date ? date.getDay() === 0 || date.getDay() === 6 : false;
    const largeCrew = (row.crew_size ?? 0) >= 8 || (avgCrewSize > 0 && (row.crew_size ?? 0) > avgCrewSize * 1.5);
    if (largeCrew) {
      events.push(
        eventFrom({
          id: eventId("schedule_pressure", "schedule", row.id, "crew_size"),
          projectId,
          jobsiteId: row.jobsite_id ?? null,
          trade: row.trade ?? null,
          crewId: row.crew_id ?? null,
          supervisorId: row.supervisor_id ?? row.supervisor_name ?? null,
          workArea: row.area ?? null,
          taskName: row.activity_name ?? null,
          sourceType: "schedule",
          sourceId: row.id ?? null,
          riskDriver: "schedule_pressure",
          riskPoints: 5,
          severity: row.planned_risk_level ?? null,
          status: row.status ?? null,
          description: "Crew size or work volume is elevated for the scheduled activity.",
          createdAt: row.created_at ?? null,
        })
      );
    }
    if (isWeekend) {
      events.push(
        eventFrom({
          id: eventId("schedule_pressure", "schedule", row.id, "weekend"),
          projectId,
          jobsiteId: row.jobsite_id ?? null,
          trade: row.trade ?? null,
          crewId: row.crew_id ?? null,
          supervisorId: row.supervisor_id ?? row.supervisor_name ?? null,
          workArea: row.area ?? null,
          taskName: row.activity_name ?? null,
          sourceType: "schedule",
          sourceId: row.id ?? null,
          riskDriver: "schedule_pressure",
          riskPoints: 5,
          severity: row.planned_risk_level ?? null,
          status: row.status ?? null,
          description: "Scheduled work falls on a weekend or compressed schedule window.",
          createdAt: row.created_at ?? null,
        })
      );
    }
  }

  for (const incident of incidents) {
    const text = norm(`${incident.title ?? ""} ${incident.description ?? ""} ${incident.category ?? ""}`);
    const date = parseDate(incident.created_at ?? incident.occurred_at);
    if (!sameRecentWindow(date, now, 90)) continue;
    const matched = activeScheduled.find((activity) => {
      const activityText = norm(textForActivity(activity));
      const sameSite = !incident.jobsite_id || !activity.jobsite_id || incident.jobsite_id === activity.jobsite_id;
      return sameSite && (activityText.includes(hazardKey(incident.category)) || text.includes(hazardKey(activity.hazard_category)) || text.includes(norm(activity.trade)));
    });
    if (!matched) continue;
    events.push(
      eventFrom({
        projectId,
        jobsiteId: incident.jobsite_id ?? matched.jobsite_id ?? null,
        trade: matched.trade ?? null,
        crewId: matched.crew_id ?? null,
        supervisorId: matched.supervisor_id ?? matched.supervisor_name ?? null,
        workArea: matched.area ?? null,
        taskName: matched.activity_name ?? incident.title ?? null,
        sourceType: "incident",
        sourceId: incident.id ?? null,
        riskDriver: "prior_incident_pattern",
        riskPoints: 10,
        severity: incident.severity ?? null,
        status: incident.status ?? null,
        description: "Prior incident or near miss is linked to the same task, trade, or location.",
        createdAt: incident.created_at ?? incident.occurred_at ?? null,
      })
    );
  }

  const score = clamp(
    events.filter((event) => input.includeResolved || !isResolvedEvent(event.status)).reduce((sum, event) => sum + event.riskPoints, 0),
    0,
    100
  );
  const topDrivers = aggregateDrivers(events);
  return {
    behaviorRiskScore: score,
    riskLevel: classifyBehaviorRisk(score),
    topDrivers,
    recommendedActions: recommendationList(topDrivers, score),
    sourceEvents: events,
    byTrade: aggregateRollup(events, "trade"),
    bySupervisor: aggregateRollup(events, "supervisorId"),
  };
}
