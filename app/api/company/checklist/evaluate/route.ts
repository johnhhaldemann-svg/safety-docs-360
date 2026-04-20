import { NextResponse } from "next/server";
import { authorizeRequest, isCompanyRole } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { mapChecklistEvidence } from "@/lib/compliance/checklistMapping";
import { buildChecklistMatrixRows, summarizeChecklistRows } from "@/lib/compliance/checklistScoring";
import { buildChecklistSourcePolicyNote } from "@/lib/compliance/checklistSourcePolicy";
import { buildJurisdictionChecklistEvidence } from "@/lib/jurisdictionStandards/apply";
import { getJurisdictionStandardsConfig } from "@/lib/jurisdictionStandards/settings";
import { resolveBuilderJurisdiction } from "@/lib/jurisdictionStandards/catalog";
import { checkFixedWindowRateLimit } from "@/lib/rateLimit";
import { serverLog } from "@/lib/serverLog";
import type { ChecklistSurface } from "@/lib/compliance/types";

export const runtime = "nodejs";
const MAX_CONTENT_LENGTH_BYTES = 250_000;
const MAX_FORM_DEPTH = 8;
const MAX_FORM_NODES = 2_500;
const MAX_STRING_LENGTH = 20_000;

function isChecklistSurface(value: unknown): value is ChecklistSurface {
  return value === "csep" || value === "peshep";
}

function validateFormDataShape(input: unknown): string | null {
  const stack: Array<{ value: unknown; depth: number }> = [{ value: input, depth: 0 }];
  let nodeCount = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    const { value, depth } = current;
    nodeCount += 1;
    if (nodeCount > MAX_FORM_NODES) {
      return `formData exceeds maximum node count (${MAX_FORM_NODES}).`;
    }
    if (depth > MAX_FORM_DEPTH) {
      return `formData exceeds maximum depth (${MAX_FORM_DEPTH}).`;
    }

    if (value === null || value === undefined) continue;
    if (typeof value === "string") {
      if (value.length > MAX_STRING_LENGTH) {
        return `formData includes a string longer than ${MAX_STRING_LENGTH} characters.`;
      }
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") continue;

    if (Array.isArray(value)) {
      for (const entry of value) {
        stack.push({ value: entry, depth: depth + 1 });
      }
      continue;
    }

    if (typeof value === "object") {
      for (const entry of Object.values(value as Record<string, unknown>)) {
        stack.push({ value: entry, depth: depth + 1 });
      }
      continue;
    }

    return "formData contains unsupported value types.";
  }

  return null;
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) {
    return auth.error;
  }

  const rl = checkFixedWindowRateLimit(`checklist-evaluate:${auth.user.id}`, {
    windowMs: 60_000,
    max: 40,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many checklist evaluations. Retry in ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const contentLengthRaw = request.headers.get("content-length");
  const contentLength = contentLengthRaw ? Number.parseInt(contentLengthRaw, 10) : null;
  if (contentLength && Number.isFinite(contentLength) && contentLength > MAX_CONTENT_LENGTH_BYTES) {
    return NextResponse.json(
      { error: `Payload too large. Maximum ${MAX_CONTENT_LENGTH_BYTES} bytes.` },
      { status: 413 }
    );
  }

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (isCompanyRole(auth.role) && !companyScope.companyId) {
    return NextResponse.json(
      { error: "This account is not linked to a company workspace yet." },
      { status: 400 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isChecklistSurface(body.surface)) {
    return NextResponse.json({ error: "surface must be csep or peshep." }, { status: 400 });
  }

  if (!body.formData || typeof body.formData !== "object" || Array.isArray(body.formData)) {
    return NextResponse.json({ error: "formData must be an object." }, { status: 400 });
  }
  const formShapeError = validateFormDataShape(body.formData);
  if (formShapeError) {
    return NextResponse.json({ error: formShapeError }, { status: 400 });
  }

  try {
    const formData = body.formData as Record<string, unknown>;
    const baseEvidenceRows = mapChecklistEvidence(body.surface, formData);
    const jurisdictionConfig = await getJurisdictionStandardsConfig(auth.supabase).catch(() => null);
    const jurisdictionProfile = resolveBuilderJurisdiction({
      governingState:
        typeof formData.governing_state === "string"
          ? formData.governing_state
          : typeof formData.governingState === "string"
            ? formData.governingState
            : null,
      companyState:
        typeof formData.company_state_region === "string"
          ? formData.company_state_region
          : typeof formData.companyStateRegion === "string"
            ? formData.companyStateRegion
            : null,
      config: jurisdictionConfig ?? undefined,
    });
    const jurisdictionEvidenceRows = buildJurisdictionChecklistEvidence({
      surface: body.surface,
      formData,
      profile: jurisdictionProfile,
      config: jurisdictionConfig ?? undefined,
    });
    const evidenceRows = [...baseEvidenceRows, ...jurisdictionEvidenceRows];
    const rows = buildChecklistMatrixRows(evidenceRows);
    const summary = summarizeChecklistRows(rows);

    return NextResponse.json({
      surface: body.surface,
      sourcePolicy: buildChecklistSourcePolicyNote(),
      rows,
      summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown checklist evaluation error";
    serverLog("error", "company_checklist_evaluate_error", {
      userId: auth.user.id,
      companyId: companyScope.companyId,
      message: message.slice(0, 200),
    });
    return NextResponse.json({ error: "Checklist evaluation failed." }, { status: 500 });
  }
}
