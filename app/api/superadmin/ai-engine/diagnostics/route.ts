import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  runAiEngineDiagnostics,
  validateAiEngineToolNames,
  type AiEngineReadableClient,
} from "@/lib/superadmin/aiEngineOperations";
import { authorizeSuperadminAiEngineRequest } from "@/lib/superadmin/aiEngineAuth";

export const runtime = "nodejs";

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : null;
}

export async function POST(request: Request) {
  const auth = await authorizeSuperadminAiEngineRequest(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const tools = optionalStringArray(body?.tools);
  const validation = validateAiEngineToolNames(tools);
  if (!validation.ok) {
    return NextResponse.json({ error: `Invalid AI Engine tool(s): ${validation.invalid.join(", ")}` }, { status: 400 });
  }

  const adminClient = createSupabaseAdminClient() as unknown as AiEngineReadableClient | null;
  const result = await runAiEngineDiagnostics(adminClient, {
    surface: optionalString(body?.surface),
    windowDays: typeof body?.windowDays === "number" ? body.windowDays : null,
    limit: typeof body?.limit === "number" ? body.limit : null,
    status: optionalString(body?.status),
    errorType: optionalString(body?.errorType),
    traceId: optionalString(body?.traceId),
    tools: validation.tools,
    generatedBy: auth.user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result, { status: 200 });
}
