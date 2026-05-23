import { buildRuleBasedScheduleHazardPrediction } from "@/lib/scheduleHazardPrediction";
import { assessSafetyRisk } from "@/lib/safety-ai/riskEngine";
import type {
  SafetyAiAssessment,
  SafetyAiSignal,
  SafetyControlType,
  SafetyRiskLevel,
} from "@/lib/safety-ai/types";
import type {
  BehaviorRiskObservationRow,
  BehaviorRiskTrainingGapRow,
} from "@/lib/predictive/behaviorRisk";
import type {
  PredictiveRiskCorrectiveActionRow,
  PredictiveRiskIncidentRow,
  PredictiveRiskJobsiteRow,
  PredictiveRiskJsaActivityRow,
  PredictiveRiskPermitRow,
  PredictiveRiskScheduleItemRow,
} from "@/lib/predictiveRisk";

export type PredictiveSafetyEvidenceRef = {
  id: string;
  sourceModule: string;
  sourceId: string;
  label: string;
  href: string | null;
  detail: string | null;
};

export type PredictiveSafetyReadinessBlockerType =
  | "permit"
  | "training"
  | "competent_person"
  | "corrective_action"
  | "weather"
  | "control"
  | "data";

export type PredictiveSafetyReadinessBlocker = {
  id: string;
  type: PredictiveSafetyReadinessBlockerType;
  severity: SafetyRiskLevel;
  label: string;
  detail: string;
  evidenceRefs: PredictiveSafetyEvidenceRef[];
};

export type PredictiveSafetyWorkTiming = "today" | "tomorrow" | "upcoming";

export type PredictiveSafetyWorkItem = {
  id: string;
  title: string;
  timing: PredictiveSafetyWorkTiming;
  jobsiteId: string | null;
  jobsiteName: string;
  date: string | null;
  trade: string | null;
  area: string | null;
  crewSize: number | null;
  riskLevel: SafetyRiskLevel;
  riskScore: number;
  actionTimeframe: SafetyAiAssessment["actionTimeframe"];
  blockers: PredictiveSafetyReadinessBlocker[];
  controlsToVerify: string[];
  drivers: string[];
  whyItMatters: string;
  evidenceRefs: PredictiveSafetyEvidenceRef[];
  assessment: SafetyAiAssessment;
};

export type PredictiveSafetyAttentionTarget = {
  id: string;
  kind: "crew" | "trade" | "area" | "jobsite";
  label: string;
  riskLevel: SafetyRiskLevel;
  riskScore: number;
  highRiskWorkCount: number;
  blockers: string[];
  evidenceRefs: PredictiveSafetyEvidenceRef[];
};

export type PredictiveSafetyControlVerification = {
  id: string;
  controlType: SafetyControlType;
  priority: "routine" | "before_work" | "urgent";
  text: string;
  whyItMatters: string;
  ownerRole: "field_supervisor" | "safety_manager" | "competent_person";
  sourceWorkItemIds: string[];
  evidenceRefs: PredictiveSafetyEvidenceRef[];
};

export type DailyRiskBriefing = {
  generatedAt: string;
  engineVersion: string;
  window: {
    today: string;
    tomorrow: string;
    days: number;
  };
  headline: string;
  highRiskWork: PredictiveSafetyWorkItem[];
  attentionTargets: PredictiveSafetyAttentionTarget[];
  readinessBlockers: PredictiveSafetyReadinessBlocker[];
  controlsToVerify: PredictiveSafetyControlVerification[];
  whyThisMatters: string[];
  missingData: string[];
  confidence: "low" | "medium" | "high";
  escalationRequired: boolean;
  stopWorkReviewRecommended: boolean;
  evidenceRefs: PredictiveSafetyEvidenceRef[];
};

export type PredictiveSafetyWeatherAlertRow = {
  id?: string | null;
  jobsite_id?: string | null;
  event_name?: string | null;
  headline?: string | null;
  severity?: string | null;
  urgency?: string | null;
  certainty?: string | null;
  effective_at?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
};

export type PredictiveSafetyMemoryItemRow = {
  id?: string | null;
  title?: string | null;
  content?: string | null;
  body?: string | null;
  summary?: string | null;
  source?: string | null;
  source_type?: string | null;
  created_at?: string | null;
};

export type PredictiveSafetyEngineInput = {
  days: number;
  jobsiteId?: string | null;
  jobsites: PredictiveRiskJobsiteRow[];
  correctiveActions: PredictiveRiskCorrectiveActionRow[];
  incidents: PredictiveRiskIncidentRow[];
  permits: PredictiveRiskPermitRow[];
  jsaActivities: PredictiveRiskJsaActivityRow[];
  scheduleItems?: PredictiveRiskScheduleItemRow[];
  observations?: BehaviorRiskObservationRow[];
  trainingGaps?: BehaviorRiskTrainingGapRow[];
  weatherAlerts?: PredictiveSafetyWeatherAlertRow[];
  memoryItems?: PredictiveSafetyMemoryItemRow[];
  safetyAiAssessment?: SafetyAiAssessment;
  now?: Date;
};

type WorkCandidate = {
  id: string;
  title: string;
  sourceModule: string;
  sourceId: string;
  date: string | null;
  jobsiteId: string | null;
  trade: string | null;
  area: string | null;
  crewSize: number | null;
  hazard: string | null;
  riskHint: string | null;
  highRisk: boolean;
  permitTriggers: string[];
  controls: string[];
  controlEvidence: string | null;
  missingCompetentPersonReview: boolean;
  fatalityOrCatastrophicPotential: boolean;
};

const RISK_RANK: Record<SafetyRiskLevel, number> = {
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function clean(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function normalizeText(value: string | null | undefined) {
  return clean(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseLabel(value: string | null | undefined, fallback: string) {
  const raw = clean(value) || fallback;
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function unique(values: Array<string | null | undefined>, limit = 12) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const item = clean(value);
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.slice(0, limit);
}

function riskFromText(value: string | null | undefined, fallback: SafetyRiskLevel = "moderate"): SafetyRiskLevel {
  const text = normalizeText(value);
  if (/fatal|catastrophic|critical|urgent/.test(text)) return "critical";
  if (/high|sif|serious injury/.test(text)) return "high";
  if (/moderate|medium|elevated/.test(text)) return "moderate";
  if (/low|minor/.test(text)) return "low";
  return fallback;
}

function timingFor(date: string | null, today: string, tomorrow: string): PredictiveSafetyWorkTiming {
  if (date === today) return "today";
  if (date === tomorrow) return "tomorrow";
  return "upcoming";
}

function isOpenStatus(raw: string | null | undefined) {
  const status = normalizeText(raw);
  return !["closed", "verified closed", "complete", "completed", "resolved", "cancelled", "archived"].includes(status);
}

function isActivePermit(row: PredictiveRiskPermitRow) {
  return ["active", "approved", "issued", "open"].includes(normalizeText(row.status));
}

function permitMatches(row: PredictiveRiskPermitRow, requiredPermit: string, jobsiteId?: string | null) {
  if (!isActivePermit(row)) return false;
  if (jobsiteId && row.jobsite_id && row.jobsite_id !== jobsiteId) return false;
  const permitText = normalizeText(`${row.permit_type ?? ""} ${row.title ?? ""} ${row.category ?? ""}`);
  const tokens = normalizeText(requiredPermit).split(/\s+/).filter((token) => token.length >= 3);
  return tokens.length > 0 && tokens.every((token) => permitText.includes(token));
}

function hasActivePermit(permits: PredictiveRiskPermitRow[], requirements: string[], jobsiteId?: string | null) {
  return requirements.length > 0 && requirements.some((requirement) => permits.some((permit) => permitMatches(permit, requirement, jobsiteId)));
}

function evidenceRef(input: {
  sourceModule: string;
  sourceId?: string | null;
  label: string;
  href?: string | null;
  detail?: string | null;
}): PredictiveSafetyEvidenceRef {
  const sourceId = clean(input.sourceId) || input.label;
  return {
    id: `${input.sourceModule}-${sourceId}`,
    sourceModule: input.sourceModule,
    sourceId,
    label: input.label,
    href: input.href ?? null,
    detail: input.detail ?? null,
  };
}

function jobsiteLookup(jobsites: PredictiveRiskJobsiteRow[]) {
  return new Map(jobsites.map((jobsite) => [jobsite.id, jobsite]));
}

function jobsiteName(map: Map<string, PredictiveRiskJobsiteRow>, id: string | null) {
  if (!id) return "Unassigned jobsite";
  return clean(map.get(id)?.name) || "Unnamed jobsite";
}

function sourceHref(sourceModule: string, jobsiteId: string | null) {
  if (sourceModule === "company_jobsite_schedule_items") return jobsiteId ? `/jobsites/${jobsiteId}/schedule` : "/jobsites";
  if (sourceModule === "company_jsa_activities") return "/jsa";
  if (sourceModule === "company_permits") return "/permits";
  if (sourceModule === "company_corrective_actions") return "/field-id-exchange";
  if (sourceModule === "company_incidents") return "/incidents";
  return "/analytics";
}

function isFatalPotential(...values: Array<string | null | undefined>) {
  return /fatal|catastrophic|sif|serious injury|life[- ]?threat|critical/i.test(values.join(" "));
}

function isWeakControlText(value: string | null | undefined) {
  return /use ppe|be careful|watch your surroundings|use caution|stay aware|pay attention/i.test(value ?? "");
}

function buildScheduleCandidate(row: PredictiveRiskScheduleItemRow): WorkCandidate {
  const prediction = buildRuleBasedScheduleHazardPrediction({
    title: row.title,
    trade: row.trade,
    workArea: row.work_area,
    crewSize: row.crew_size,
    shiftStartTime: row.shift_start_time,
    shiftEndTime: row.shift_end_time,
    notes: row.notes,
  });
  const permitTriggers = unique([...(row.permit_triggers ?? []), ...prediction.permitTriggers]);
  const controls = unique([...(row.required_controls ?? []), ...prediction.requiredControls]);
  const hazards = unique([...(row.hazard_categories ?? []), ...prediction.hazardCategories]);

  return {
    id: `schedule-${row.id ?? row.title ?? row.work_start_date ?? "work"}`,
    title: clean(row.title) || "Scheduled work",
    sourceModule: "company_jobsite_schedule_items",
    sourceId: clean(row.id) || clean(row.title) || "scheduled-work",
    date: row.work_start_date ?? null,
    jobsiteId: row.jobsite_id ?? null,
    trade: row.trade ?? null,
    area: row.work_area ?? null,
    crewSize: row.crew_size ?? null,
    hazard: hazards[0] ?? null,
    riskHint: row.risk_level ?? prediction.riskLevel,
    highRisk: Boolean(row.is_high_risk || prediction.isHighRisk || riskFromText(row.risk_level, "low") === "high"),
    permitTriggers,
    controls,
    controlEvidence: controls.join(", ") || null,
    missingCompetentPersonReview: !clean(row.supervisor_name),
    fatalityOrCatastrophicPotential: isFatalPotential(row.title, row.risk_level, ...(row.hazard_categories ?? [])),
  };
}

function buildJsaCandidate(row: PredictiveRiskJsaActivityRow): WorkCandidate {
  const prediction = buildRuleBasedScheduleHazardPrediction({
    title: row.activity_name,
    trade: row.trade,
    taskType: row.hazard_category,
    workArea: row.area,
    crewSize: row.crew_size,
    notes: `${row.hazard_description ?? ""} ${row.mitigation ?? ""}`,
  });
  const permitTriggers = unique([row.permit_required ? row.permit_type || `${row.hazard_category ?? "work"} permit` : null, ...prediction.permitTriggers]);
  const controls = unique([row.mitigation, ...prediction.requiredControls]);

  return {
    id: `jsa-${row.id ?? row.activity_name ?? row.work_date ?? "activity"}`,
    title: clean(row.activity_name) || clean(row.hazard_category) || "JSA activity",
    sourceModule: "company_jsa_activities",
    sourceId: clean(row.id) || clean(row.activity_name) || "jsa-activity",
    date: row.work_date ?? row.created_at?.slice(0, 10) ?? null,
    jobsiteId: row.jobsite_id ?? null,
    trade: row.trade ?? null,
    area: row.area ?? null,
    crewSize: row.crew_size ?? null,
    hazard: row.hazard_category ?? prediction.hazardCategories[0] ?? null,
    riskHint: row.planned_risk_level ?? prediction.riskLevel,
    highRisk: riskFromText(row.planned_risk_level, prediction.riskLevel === "critical" ? "critical" : "moderate") !== "low" || prediction.isHighRisk,
    permitTriggers,
    controls,
    controlEvidence: row.mitigation ?? null,
    missingCompetentPersonReview: !/competent person|supervisor|verify|verified|foreman|sign[- ]?off/i.test(row.mitigation ?? ""),
    fatalityOrCatastrophicPotential: isFatalPotential(row.activity_name, row.hazard_category, row.hazard_description, row.planned_risk_level),
  };
}

function weatherAppliesToWork(alert: PredictiveSafetyWeatherAlertRow, work: WorkCandidate) {
  if (alert.jobsite_id && work.jobsiteId && alert.jobsite_id !== work.jobsiteId) return false;
  const alertText = normalizeText(`${alert.event_name ?? ""} ${alert.headline ?? ""}`);
  const workText = normalizeText(`${work.title} ${work.hazard ?? ""} ${work.controls.join(" ")}`);
  if (!alertText) return false;
  if (/lightning|thunderstorm|wind|gust|tornado|hail/.test(alertText) && /crane|rigging|lift|height|fall|roof|scaffold|steel|elevated/.test(workText)) {
    return true;
  }
  if (/heat|excessive heat|humid/.test(alertText) && (work.crewSize ?? 0) >= 4) return true;
  if (/flood|rain|storm/.test(alertText) && /excavat|trench|electrical|traffic|crane|lift|height|roof/.test(workText)) return true;
  return /severe|extreme|warning/.test(normalizeText(`${alert.severity ?? ""} ${alert.urgency ?? ""}`)) && work.highRisk;
}

function memoryControlText(item: PredictiveSafetyMemoryItemRow) {
  const text = `${item.title ?? ""} ${item.summary ?? ""} ${item.content ?? ""} ${item.body ?? ""}`;
  const required = /required|must|shall|site rule|jobsite rule|company rule|policy/i.test(text);
  const control = /(fall protection|rescue plan|lift plan|hot work|fire watch|confined space|excavation|competent person|loto|lockout|traffic control|guardrail|training)/i.exec(text)?.[0];
  if (!required || !control) return null;
  return `Verify uploaded rule requirement: ${titleCaseLabel(control, "Required control")}.`;
}

function blocker(input: {
  type: PredictiveSafetyReadinessBlockerType;
  severity: SafetyRiskLevel;
  label: string;
  detail: string;
  evidenceRefs: PredictiveSafetyEvidenceRef[];
}): PredictiveSafetyReadinessBlocker {
  return {
    id: `${input.type}-${normalizeText(input.label).replace(/\s+/g, "-") || "blocker"}-${input.evidenceRefs[0]?.sourceId ?? "evidence"}`,
    type: input.type,
    severity: input.severity,
    label: input.label,
    detail: input.detail,
    evidenceRefs: input.evidenceRefs,
  };
}

function workSignals(work: WorkCandidate, blockers: PredictiveSafetyReadinessBlocker[], weatherAlerts: PredictiveSafetyWeatherAlertRow[]): SafetyAiSignal[] {
  const risk = riskFromText(work.riskHint, work.highRisk ? "high" : "moderate");
  return [
    {
      id: work.id,
      type: "high_risk_work",
      label: work.title,
      hazard: work.hazard,
      severity: risk,
      createdAt: work.date,
      jobsiteId: work.jobsiteId,
      trade: work.trade,
      task: work.title,
      crewSize: work.crewSize,
      highRisk: work.highRisk,
      fatalityOrCatastrophicPotential: work.fatalityOrCatastrophicPotential,
      missingRequiredPermit: blockers.some((item) => item.type === "permit"),
      missingRequiredTraining: blockers.some((item) => item.type === "training"),
      missingCompetentPersonReview: blockers.some((item) => item.type === "competent_person"),
      controlGap: blockers.some((item) => item.type === "control") ? 5 : undefined,
      controls: work.controls,
      controlEvidence: work.controlEvidence,
    },
    ...blockers
      .filter((item) => item.type === "corrective_action")
      .map((item): SafetyAiSignal => ({
        id: item.id,
        type: "corrective_action",
        label: item.label,
        hazard: work.hazard,
        severity: item.severity,
        status: "open",
        jobsiteId: work.jobsiteId,
        overdueCorrectiveAction: true,
      })),
    ...weatherAlerts
      .filter((alert) => weatherAppliesToWork(alert, work))
      .map((alert): SafetyAiSignal => ({
        id: alert.id,
        type: "environment",
        label: alert.headline ?? alert.event_name ?? "Weather alert",
        hazard: alert.event_name ?? "weather",
        severity: riskFromText(alert.severity ?? alert.urgency, "high"),
        createdAt: alert.effective_at ?? alert.created_at ?? null,
        jobsiteId: alert.jobsite_id ?? work.jobsiteId,
        highRisk: true,
      })),
  ];
}

function buildWorkItem(params: {
  work: WorkCandidate;
  today: string;
  tomorrow: string;
  jobsites: Map<string, PredictiveRiskJobsiteRow>;
  permits: PredictiveRiskPermitRow[];
  trainingGaps: BehaviorRiskTrainingGapRow[];
  correctiveActions: PredictiveRiskCorrectiveActionRow[];
  weatherAlerts: PredictiveSafetyWeatherAlertRow[];
  memoryItems: PredictiveSafetyMemoryItemRow[];
}): PredictiveSafetyWorkItem | null {
  const workEvidence = evidenceRef({
    sourceModule: params.work.sourceModule,
    sourceId: params.work.sourceId,
    label: params.work.title,
    href: sourceHref(params.work.sourceModule, params.work.jobsiteId),
    detail: `${titleCaseLabel(params.work.riskHint, "Risk")} work${params.work.date ? ` on ${params.work.date}` : ""}`,
  });
  const blockers: PredictiveSafetyReadinessBlocker[] = [];

  if (params.work.permitTriggers.length > 0 && !hasActivePermit(params.permits, params.work.permitTriggers, params.work.jobsiteId)) {
    blockers.push(
      blocker({
        type: "permit",
        severity: riskFromText(params.work.riskHint, "high"),
        label: "Missing active permit or authorization",
        detail: `Verify ${params.work.permitTriggers.map((permit) => titleCaseLabel(permit, permit)).join(", ")} before this work starts.`,
        evidenceRefs: [workEvidence],
      })
    );
  }

  if (params.work.missingCompetentPersonReview) {
    blockers.push(
      blocker({
        type: "competent_person",
        severity: params.work.highRisk ? "high" : "moderate",
        label: "Competent-person or supervisor review not evident",
        detail: "Assign a qualified reviewer and document verification before releasing the task.",
        evidenceRefs: [workEvidence],
      })
    );
  }

  if (params.work.highRisk && (params.work.controls.length === 0 || isWeakControlText(params.work.controlEvidence))) {
    blockers.push(
      blocker({
        type: "control",
        severity: "high",
        label: "Critical controls are missing or too generic",
        detail: "Replace generic PPE-only wording with specific elimination, engineering, administrative, rescue, and verification controls.",
        evidenceRefs: [workEvidence],
      })
    );
  }

  const matchingTrainingGaps = params.trainingGaps.filter((gap) => {
    if (gap.jobsite_id && params.work.jobsiteId && gap.jobsite_id !== params.work.jobsiteId) return false;
    const text = normalizeText(`${gap.trade ?? ""} ${gap.task_name ?? ""} ${gap.requirement ?? ""}`);
    const workText = normalizeText(`${params.work.trade ?? ""} ${params.work.title} ${params.work.hazard ?? ""}`);
    return !text || text.split(/\s+/).some((token) => token.length > 4 && workText.includes(token));
  });

  for (const gap of matchingTrainingGaps.slice(0, 3)) {
    blockers.push(
      blocker({
        type: "training",
        severity: "high",
        label: "Training readiness gap",
        detail: `${gap.worker_name ?? "Worker"} needs ${gap.requirement ?? gap.task_name ?? "required training"} verified before assignment.`,
        evidenceRefs: [
          evidenceRef({
            sourceModule: "training_matrix",
            sourceId: gap.id ?? gap.worker_id ?? "training-gap",
            label: gap.requirement ?? gap.task_name ?? "Training gap",
            href: "/training/matrix",
            detail: gap.status ?? "Not ready",
          }),
        ],
      })
    );
  }

  const matchingOpenActions = params.correctiveActions.filter((action) => {
    if (!isOpenStatus(action.status)) return false;
    if (action.jobsite_id && params.work.jobsiteId && action.jobsite_id !== params.work.jobsiteId) return false;
    const actionText = normalizeText(`${action.title ?? ""} ${action.category ?? ""}`);
    const workText = normalizeText(`${params.work.title} ${params.work.hazard ?? ""} ${params.work.area ?? ""}`);
    return action.sif_potential || actionText.split(/\s+/).some((token) => token.length > 4 && workText.includes(token));
  });

  for (const action of matchingOpenActions.slice(0, 2)) {
    blockers.push(
      blocker({
        type: "corrective_action",
        severity: riskFromText(action.severity ?? action.priority, action.sif_potential ? "critical" : "moderate"),
        label: "Open corrective action in same risk family",
        detail: `${action.title ?? "Corrective action"} remains open and should be reviewed before related work begins.`,
        evidenceRefs: [
          evidenceRef({
            sourceModule: "company_corrective_actions",
            sourceId: action.id ?? action.title ?? "corrective-action",
            label: action.title ?? "Corrective action",
            href: "/field-id-exchange",
            detail: action.status ?? null,
          }),
        ],
      })
    );
  }

  for (const alert of params.weatherAlerts.filter((weather) => weatherAppliesToWork(weather, params.work)).slice(0, 2)) {
    blockers.push(
      blocker({
        type: "weather",
        severity: riskFromText(alert.severity ?? alert.urgency, "high"),
        label: "Weather affects planned high-risk work",
        detail: `${alert.headline ?? alert.event_name ?? "Weather alert"} should be reviewed against task controls before work starts.`,
        evidenceRefs: [
          evidenceRef({
            sourceModule: "weather_alert_events",
            sourceId: alert.id ?? alert.event_name ?? "weather-alert",
            label: alert.headline ?? alert.event_name ?? "Weather alert",
            href: "/analytics?tab=weather",
            detail: alert.severity ?? alert.urgency ?? null,
          }),
        ],
      })
    );
  }

  const memoryControls = unique(params.memoryItems.map(memoryControlText), 4);
  const controlsToVerify = unique([...params.work.controls, ...memoryControls]);
  const signals = workSignals(params.work, blockers, params.weatherAlerts);
  const assessment = assessSafetyRisk({
    jobsiteId: params.work.jobsiteId,
    jobsiteName: jobsiteName(params.jobsites, params.work.jobsiteId),
    taskType: params.work.hazard ?? params.work.title,
    trade: params.work.trade,
    crewExposure: params.work.crewSize,
    highRiskWorkCategories: unique([params.work.hazard, params.work.title, ...params.work.permitTriggers]),
    observedControls: controlsToVerify,
    controlEffectiveness: blockers.some((item) => item.type === "control")
      ? "missing"
      : blockers.length > 0
        ? "partial"
        : params.work.controls.length > 0
          ? "effective"
          : "unknown",
    dataCompleteness: Math.min(1, Math.max(0.2, new Set(signals.map((signal) => signal.type)).size / 5)),
    signals,
    missingData: [
      ...(params.trainingGaps.length === 0 ? ["training readiness"] : []),
      ...(params.permits.length === 0 && params.work.permitTriggers.length > 0 ? ["active permits"] : []),
    ],
    imminentDanger: blockers.some((item) => item.severity === "critical" && (item.type === "weather" || item.type === "permit")),
    fatalityOrCatastrophicPotential: params.work.fatalityOrCatastrophicPotential || blockers.some((item) => item.severity === "critical"),
    missingRequiredPermit: blockers.some((item) => item.type === "permit"),
    missingRequiredTraining: blockers.some((item) => item.type === "training"),
    missingCompetentPersonReview: blockers.some((item) => item.type === "competent_person"),
    overdueCorrectiveActionForHazard: blockers.some((item) => item.type === "corrective_action"),
  });

  if (assessment.level === "low" && blockers.length === 0 && !params.work.highRisk) return null;

  const why = assessment.topDrivers[0]?.explanation ?? "This work has enough risk signal to warrant a pre-task readiness check.";
  return {
    id: params.work.id,
    title: params.work.title,
    timing: timingFor(params.work.date, params.today, params.tomorrow),
    jobsiteId: params.work.jobsiteId,
    jobsiteName: jobsiteName(params.jobsites, params.work.jobsiteId),
    date: params.work.date,
    trade: params.work.trade,
    area: params.work.area,
    crewSize: params.work.crewSize,
    riskLevel: assessment.level,
    riskScore: assessment.score,
    actionTimeframe: assessment.actionTimeframe,
    blockers,
    controlsToVerify,
    drivers: assessment.topDrivers.slice(0, 4).map((driver) => driver.label),
    whyItMatters: why,
    evidenceRefs: [workEvidence, ...blockers.flatMap((item) => item.evidenceRefs)].slice(0, 8),
    assessment,
  };
}

function riskMax(a: SafetyRiskLevel, b: SafetyRiskLevel): SafetyRiskLevel {
  return RISK_RANK[b] > RISK_RANK[a] ? b : a;
}

function buildAttentionTargets(workItems: PredictiveSafetyWorkItem[]): PredictiveSafetyAttentionTarget[] {
  const groups = new Map<string, PredictiveSafetyAttentionTarget>();
  const add = (kind: PredictiveSafetyAttentionTarget["kind"], label: string | null, work: PredictiveSafetyWorkItem) => {
    const cleanLabel = clean(label);
    if (!cleanLabel) return;
    const id = `${kind}-${normalizeText(cleanLabel).replace(/\s+/g, "-")}`;
    const existing = groups.get(id) ?? {
      id,
      kind,
      label: cleanLabel,
      riskLevel: "low" as SafetyRiskLevel,
      riskScore: 0,
      highRiskWorkCount: 0,
      blockers: [],
      evidenceRefs: [],
    };
    existing.riskLevel = riskMax(existing.riskLevel, work.riskLevel);
    existing.riskScore = Math.max(existing.riskScore, work.riskScore);
    existing.highRiskWorkCount += 1;
    existing.blockers = unique([...existing.blockers, ...work.blockers.map((item) => item.label)], 6);
    existing.evidenceRefs = [...existing.evidenceRefs, ...work.evidenceRefs].slice(0, 6);
    groups.set(id, existing);
  };

  for (const work of workItems) {
    add("jobsite", work.jobsiteName, work);
    add("trade", work.trade, work);
    add("area", work.area, work);
  }

  return [...groups.values()]
    .sort((a, b) => RISK_RANK[b.riskLevel] - RISK_RANK[a.riskLevel] || b.riskScore - a.riskScore)
    .slice(0, 8);
}

function controlTypeFor(text: string): SafetyControlType {
  const normalized = normalizeText(text);
  if (/eliminat|remove|avoid/.test(normalized)) return "elimination";
  if (/substitut|alternate/.test(normalized)) return "substitution";
  if (/guardrail|exclusion|barrier|ventilation|isolation|protective system|engineering/.test(normalized)) return "engineering";
  if (/competent|qualified|supervisor|inspection|permit|plan|brief|watch|communication|verify/.test(normalized)) return "administrative";
  return "ppe";
}

function buildControls(workItems: PredictiveSafetyWorkItem[]): PredictiveSafetyControlVerification[] {
  const byText = new Map<string, PredictiveSafetyControlVerification>();
  for (const work of workItems) {
    for (const control of work.controlsToVerify.slice(0, 8)) {
      const key = normalizeText(control);
      if (!key) continue;
      const existing = byText.get(key) ?? {
        id: `control-${key.replace(/\s+/g, "-").slice(0, 48)}`,
        controlType: controlTypeFor(control),
        priority: work.riskLevel === "critical" ? "urgent" : work.riskLevel === "high" ? "before_work" : "routine",
        text: control,
        whyItMatters: `Linked to ${work.title}; verify before work starts when risk is ${work.riskLevel}.`,
        ownerRole: controlTypeFor(control) === "competent_person_review" ? "competent_person" : "field_supervisor",
        sourceWorkItemIds: [],
        evidenceRefs: [],
      } satisfies PredictiveSafetyControlVerification;
      if (!existing.sourceWorkItemIds.includes(work.id)) existing.sourceWorkItemIds.push(work.id);
      existing.evidenceRefs = [...existing.evidenceRefs, ...work.evidenceRefs].slice(0, 6);
      if (work.riskLevel === "critical") existing.priority = "urgent";
      else if (work.riskLevel === "high" && existing.priority === "routine") existing.priority = "before_work";
      byText.set(key, existing);
    }
  }
  return [...byText.values()]
    .sort((a, b) => {
      const rank = { routine: 1, before_work: 2, urgent: 3 };
      return rank[b.priority] - rank[a.priority] || b.sourceWorkItemIds.length - a.sourceWorkItemIds.length;
    })
    .slice(0, 10);
}

function confidenceFromCoverage(input: PredictiveSafetyEngineInput, workItems: PredictiveSafetyWorkItem[]) {
  const covered = [
    input.scheduleItems != null,
    input.jsaActivities != null,
    input.permits != null,
    input.trainingGaps != null,
    input.observations != null,
    input.incidents != null,
    input.correctiveActions != null,
    input.weatherAlerts != null,
    input.memoryItems != null,
  ].filter(Boolean).length;
  if (workItems.length === 0 || covered <= 4) return "low";
  if (covered <= 7 || workItems.some((item) => item.assessment.confidence === "low")) return "medium";
  return "high";
}

function missingData(input: PredictiveSafetyEngineInput, workItems: PredictiveSafetyWorkItem[]) {
  return unique([
    ...(input.scheduleItems == null || input.scheduleItems.length === 0 ? ["No upcoming jobsite schedule rows were available."] : []),
    ...(input.jsaActivities.length === 0 ? ["No JSA activity rows were available for the selected window."] : []),
    ...(input.permits.length === 0 ? ["No active or recent permit rows were available."] : []),
    ...(input.trainingGaps == null ? ["Training readiness data was not loaded for this briefing."] : []),
    ...(input.observations == null ? ["Observation/SOR data was not loaded for this briefing."] : []),
    ...(input.weatherAlerts == null ? ["Weather alert data was not loaded for this briefing."] : []),
    ...(input.memoryItems == null ? ["Uploaded safety document memory was not loaded for this briefing."] : []),
    ...(workItems.length === 0 ? ["Sparse data: do not interpret this as low risk by default."] : []),
  ], 10);
}

export function buildPredictiveSafetyEngineBriefing(input: PredictiveSafetyEngineInput): DailyRiskBriefing {
  const now = input.now ?? new Date();
  const today = dateKey(now);
  const tomorrow = dateKey(addDays(now, 1));
  const jobsites = jobsiteLookup(input.jobsites);
  const workCandidates = [
    ...(input.scheduleItems ?? []).map(buildScheduleCandidate),
    ...input.jsaActivities.map(buildJsaCandidate),
  ].filter((work) => {
    if (input.jobsiteId && work.jobsiteId && work.jobsiteId !== input.jobsiteId) return false;
    if (!work.date) return true;
    const end = dateKey(addDays(now, Math.max(1, input.days)));
    return work.date >= today && work.date <= end;
  });

  const workItems = workCandidates
    .map((work) =>
      buildWorkItem({
        work,
        today,
        tomorrow,
        jobsites,
        permits: input.permits,
        trainingGaps: input.trainingGaps ?? [],
        correctiveActions: input.correctiveActions,
        weatherAlerts: input.weatherAlerts ?? [],
        memoryItems: input.memoryItems ?? [],
      })
    )
    .filter((item): item is PredictiveSafetyWorkItem => Boolean(item))
    .sort((a, b) => {
      const timingRank: Record<PredictiveSafetyWorkTiming, number> = { today: 3, tomorrow: 2, upcoming: 1 };
      return RISK_RANK[b.riskLevel] - RISK_RANK[a.riskLevel] || b.riskScore - a.riskScore || timingRank[b.timing] - timingRank[a.timing];
    })
    .slice(0, 12);

  const readinessBlockers = workItems
    .flatMap((work) => work.blockers)
    .sort((a, b) => RISK_RANK[b.severity] - RISK_RANK[a.severity])
    .slice(0, 16);
  const controlsToVerify = buildControls(workItems);
  const attentionTargets = buildAttentionTargets(workItems);
  const missing = missingData(input, workItems);
  const confidence = confidenceFromCoverage(input, workItems);
  const topWork = workItems[0];
  const escalationRequired =
    Boolean(input.safetyAiAssessment?.escalationRequired) ||
    workItems.some((work) => work.assessment.escalationRequired || work.riskLevel === "critical");
  const stopWorkReviewRecommended =
    Boolean(input.safetyAiAssessment?.stopWorkReviewRecommended) ||
    workItems.some((work) => work.assessment.stopWorkReviewRecommended || work.blockers.some((item) => item.severity === "critical"));

  return {
    generatedAt: now.toISOString(),
    engineVersion: "predictive-safety-engine-mvp-rules-v1",
    window: {
      today,
      tomorrow,
      days: Math.max(1, Math.floor(input.days)),
    },
    headline: topWork
      ? `${titleCaseLabel(topWork.riskLevel, topWork.riskLevel)} risk: ${topWork.title} at ${topWork.jobsiteName}.`
      : "No high-risk work was ranked from the loaded data; review missing data before treating the day as low risk.",
    highRiskWork: workItems,
    attentionTargets,
    readinessBlockers,
    controlsToVerify,
    whyThisMatters: unique(
      [
        ...workItems.slice(0, 4).map((work) => `${work.title}: ${work.whyItMatters}`),
        ...(stopWorkReviewRecommended
          ? ["Critical or high-consequence signals require human review and possible stop-work evaluation before work proceeds."]
          : []),
        ...(missing.length > 0 ? ["The engine is conservative when source data is incomplete; missing records reduce confidence instead of proving low risk."] : []),
      ],
      6
    ),
    missingData: missing,
    confidence,
    escalationRequired,
    stopWorkReviewRecommended,
    evidenceRefs: workItems.flatMap((work) => work.evidenceRefs).slice(0, 12),
  };
}
