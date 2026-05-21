import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { checkFixedWindowRateLimit } from "@/lib/rateLimit";
import { runStructuredAiJsonTask } from "@/lib/ai/responses";
import { resolveCompanyAiDefaultModel } from "@/lib/ai/defaultModel";
import {
  buildRuleBasedScheduleHazardPrediction,
  mergeScheduleHazardPrediction,
  stableSchedulePredictionInputKey,
  type ScheduleHazardPrediction,
  type ScheduleHazardPredictionInput,
} from "@/lib/scheduleHazardPrediction";

export const runtime = "nodejs";

type CacheRow = {
  status: "ok" | "fallback" | string | null;
  ai_payload: Partial<ScheduleHazardPrediction> | null;
  ai_meta: Record<string, unknown> | null;
};

function dateOnly(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

function inputFingerprint(input: ScheduleHazardPredictionInput) {
  return createHash("sha256").update(stableSchedulePredictionInputKey(input)).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function scheduleInputFromBody(body: Record<string, unknown> | null): ScheduleHazardPredictionInput {
  return {
    title: typeof body?.title === "string" ? body.title : "",
    trade: typeof body?.trade === "string" ? body.trade : "",
    taskType: typeof body?.taskType === "string" ? body.taskType : "",
    workArea: typeof body?.workArea === "string" ? body.workArea : "",
    crewSize: typeof body?.crewSize === "string" || typeof body?.crewSize === "number" ? body.crewSize : null,
    shiftStartTime: typeof body?.shiftStartTime === "string" ? body.shiftStartTime : null,
    shiftEndTime: typeof body?.shiftEndTime === "string" ? body.shiftEndTime : null,
    notes: typeof body?.notes === "string" ? body.notes : "",
  };
}

function hasMinimumPredictionInput(input: ScheduleHazardPredictionInput) {
  return Boolean(String(input.trade ?? "").trim() && String(input.taskType ?? "").trim() && String(input.workArea ?? "").trim());
}

function buildAiPrompt(input: ScheduleHazardPredictionInput, rules: ScheduleHazardPrediction) {
  return JSON.stringify(
    {
      instruction:
        "Enrich the deterministic construction schedule hazard prediction. Stay within the supplied facts. Return JSON only with riskLevel, hazardCategories, permitTriggers, requiredControls, rationale, confidence, and matchedSignals.",
      input,
      deterministicRules: rules,
      allowedRiskLevels: ["low", "medium", "high", "critical"],
      style:
        "Use concise field-ready language. Do not invent dates, owners, legal conclusions, or guarantees. Prefer practical hazards and controls.",
    },
    null,
    2
  );
}

function jsonResponseForRules(
  rules: ScheduleHazardPrediction,
  source: "rules" | "rules_fallback",
  fingerprint: string,
  aiMeta?: Record<string, unknown> | null
) {
  return NextResponse.json({
    ...rules,
    source,
    aiMeta: aiMeta ?? null,
    inputFingerprint: fingerprint,
  });
}

async function resolveCompanyScope(auth: {
  supabase: Parameters<typeof getCompanyScope>[0]["supabase"];
  user: { id: string };
  team?: string | null;
}) {
  return getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobsiteId: string }> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_view_analytics",
      "can_view_dashboards",
      "can_manage_company_users",
    ],
  });
  if ("error" in auth) return auth.error;

  const rl = checkFixedWindowRateLimit(`schedule-predict:${auth.user.id}`, {
    windowMs: 60_000,
    max: 30,
  });
  if (!rl.ok) {
    return NextResponse.json({ error: `Too many schedule predictions. Retry in ${rl.retryAfterSec}s.` }, { status: 429 });
  }

  const { jobsiteId } = await params;
  const companyScope = await resolveCompanyScope(auth);
  if (!companyScope.companyId) {
    return NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 });
  }

  const jobsiteResult = await auth.supabase
    .from("company_jobsites")
    .select("id, company_id")
    .eq("company_id", companyScope.companyId)
    .eq("id", jobsiteId)
    .maybeSingle();

  if (jobsiteResult.error) {
    return NextResponse.json({ error: jobsiteResult.error.message || "Failed to load jobsite." }, { status: 500 });
  }
  if (!jobsiteResult.data) return NextResponse.json({ error: "Jobsite not found." }, { status: 404 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!isRecord(body)) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const input = scheduleInputFromBody(body);
  if (!hasMinimumPredictionInput(input)) {
    return NextResponse.json({ error: "Trade, task type, and work area are required for prediction." }, { status: 400 });
  }

  const rules = buildRuleBasedScheduleHazardPrediction(input);
  const fingerprint = inputFingerprint(input);
  const predictionDate = dateOnly();

  const cacheResult = await auth.supabase
    .from("company_schedule_prediction_cache")
    .select("status, ai_payload, ai_meta")
    .eq("company_id", companyScope.companyId)
    .eq("jobsite_id", jobsiteId)
    .eq("input_fingerprint", fingerprint)
    .eq("prediction_date", predictionDate)
    .maybeSingle();

  if (!cacheResult.error && cacheResult.data) {
    const cached = cacheResult.data as CacheRow;
    if (cached.status === "ok" && cached.ai_payload) {
      return NextResponse.json({
        ...mergeScheduleHazardPrediction(rules, cached.ai_payload),
        source: "ai_cached",
        aiMeta: cached.ai_meta ?? null,
        inputFingerprint: fingerprint,
      });
    }
    return jsonResponseForRules(rules, "rules_fallback", fingerprint, cached.ai_meta ?? null);
  }

  const ai = await runStructuredAiJsonTask<Partial<ScheduleHazardPrediction>>({
    modelEnv: process.env.SCHEDULE_HAZARD_AI_MODEL?.trim() || process.env.COMPANY_AI_MODEL?.trim(),
    fallbackModel: resolveCompanyAiDefaultModel("gpt-4o-mini"),
    system:
      "You are a construction safety planning assistant. Return strict JSON only. Keep recommendations practical, concise, and grounded in the supplied deterministic rule output.",
    user: buildAiPrompt(input, rules),
    fallback: {},
    surface: "schedule.hazard-prediction",
    maxAttempts: 2,
  });

  const aiMeta = {
    model: ai.meta.model,
    provider: ai.meta.provider,
    promptHash: ai.meta.promptHash,
    fallbackUsed: ai.meta.fallbackUsed,
    fallbackReason: ai.meta.fallbackReason,
    attempts: ai.meta.attempts,
    latencyMs: ai.meta.latencyMs,
    usage: ai.meta.usage,
    surface: ai.meta.surface,
  };

  const hasAiPayload = !ai.meta.fallbackUsed && isRecord(ai.parsed) && Object.keys(ai.parsed).length > 0;
  const payload = hasAiPayload ? mergeScheduleHazardPrediction(rules, ai.parsed) : rules;

  await auth.supabase
    .from("company_schedule_prediction_cache")
    .upsert(
      {
        company_id: companyScope.companyId,
        jobsite_id: jobsiteId,
        input_fingerprint: fingerprint,
        prediction_date: predictionDate,
        status: hasAiPayload ? "ok" : "fallback",
        ai_payload: hasAiPayload ? ai.parsed : null,
        ai_meta: aiMeta,
        created_by: auth.user.id,
      },
      { onConflict: "company_id,jobsite_id,input_fingerprint,prediction_date" }
    );

  if (!hasAiPayload) return jsonResponseForRules(rules, "rules_fallback", fingerprint, aiMeta);

  return NextResponse.json({
    ...payload,
    source: "ai_updated_today",
    aiMeta,
    inputFingerprint: fingerprint,
  });
}
