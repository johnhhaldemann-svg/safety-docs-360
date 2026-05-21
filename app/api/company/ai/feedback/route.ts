import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { authorizeRequest, isAdminRole, isCompanyRole, normalizeAppRole } from "@/lib/rbac";
import { checkFixedWindowRateLimit } from "@/lib/rateLimit";
import {
  recordAiEngineFeedback,
  sanitizeAiFeedbackSignalMetadata,
  type AiEngineFeedbackOutcome,
  type AiEngineReadableClient,
} from "@/lib/superadmin/aiEngineOperations";

export const runtime = "nodejs";

const OUTCOMES = new Set<AiEngineFeedbackOutcome>([
  "accepted",
  "edited",
  "rejected",
  "regenerated",
  "field-used",
]);

const ALLOWED_SURFACE_PREFIXES = [
  "safety-intelligence",
  "company-memory",
  "permit-copilot",
  "builder-document-review",
  "gc-review",
  "csep-review",
  "injury-weather",
  "training-records.photo-extract",
  "field-audits.ai-review",
  "jobsite.site-visual.generate",
  "jobsite.site-visual.render.generate",
];

const RAW_BODY_FIELDS = new Set([
  "prompt",
  "rawPrompt",
  "output",
  "rawOutput",
  "generatedText",
  "generated_text",
  "editedText",
  "edited_text",
  "fullText",
  "full_text",
  "rawText",
  "raw_text",
]);

function optionalText(value: unknown, max = 120) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function isAllowedSurface(surface: string) {
  const normalized = surface.toLowerCase();
  return ALLOWED_SURFACE_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}.`));
}

function hasRawTextFields(body: Record<string, unknown>) {
  for (const key of Object.keys(body)) {
    if (RAW_BODY_FIELDS.has(key)) return true;
  }
  const metadata = body.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  return Object.keys(metadata).some((key) => RAW_BODY_FIELDS.has(key) || key.toLowerCase().includes("text"));
}

function canWriteProductFeedback(role: string | null | undefined) {
  if (role === "marketing") return false;
  const normalized = normalizeAppRole(role);
  if (normalized === "sales_demo") return false;
  return isAdminRole(normalized) || isCompanyRole(normalized) || normalized === "employee";
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;

  if (!canWriteProductFeedback(auth.role)) {
    return NextResponse.json({ error: "You do not have access to AI feedback capture." }, { status: 403 });
  }

  const rl = checkFixedWindowRateLimit(`company-ai-feedback:${auth.user.id}`, {
    windowMs: 60_000,
    max: 60,
  });
  if (!rl.ok) {
    return NextResponse.json({ error: `Too many feedback signals. Retry in ${rl.retryAfterSec}s.` }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (hasRawTextFields(body)) {
    return NextResponse.json(
      { error: "Raw AI prompt, output, generated, or edited text is not accepted for product feedback." },
      { status: 400 }
    );
  }

  const surface = optionalText(body.surface);
  const sourceId = optionalText(body.sourceId) ?? optionalText(body.source_id);
  const outcome = optionalText(body.outcome, 40);
  if (!surface || !isAllowedSurface(surface)) {
    return NextResponse.json({ error: "A valid AI surface is required." }, { status: 400 });
  }
  if (!outcome || !OUTCOMES.has(outcome as AiEngineFeedbackOutcome)) {
    return NextResponse.json({ error: "A valid outcome is required." }, { status: 400 });
  }

  const rating = typeof body.rating === "number" && Number.isFinite(body.rating) ? body.rating : null;
  const reasonCode = optionalText(body.reasonCode, 80) ?? optionalText(body.reason_code, 80);
  const metadata =
    body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? (body.metadata as Record<string, unknown>)
      : {};
  const signalMetadata = sanitizeAiFeedbackSignalMetadata({
    ...metadata,
    ...(reasonCode ? { reasonCode } : {}),
    userRole: auth.role ?? null,
  });

  const adminClient = createSupabaseAdminClient() as unknown as AiEngineReadableClient | null;
  const result = await recordAiEngineFeedback(adminClient, {
    surface,
    sourceId,
    outcome: outcome as AiEngineFeedbackOutcome,
    rating,
    reason: reasonCode,
    signalMetadata,
    createdBy: auth.user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
