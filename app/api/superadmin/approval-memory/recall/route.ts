import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { recallApprovability } from "@/lib/aiApprovalRecall";
import { APPROVAL_MEMORY_SURFACES, type ApprovalMemorySurface } from "@/lib/aiApprovalMemory";

export const runtime = "nodejs";

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeSurface(value: unknown): ApprovalMemorySurface | null {
  const next = optionalText(value);
  return next && (APPROVAL_MEMORY_SURFACES as readonly string[]).includes(next)
    ? (next as ApprovalMemorySurface)
    : null;
}

/**
 * Scores how "approvable" a candidate item is, based on the AI Approval Memory Bank.
 * Read-only; reusable by review queues and agents. Superadmin / platform-admin only.
 */
export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: ["can_access_internal_admin", "can_review_documents"],
    allowPending: true,
    allowSuspended: true,
  });
  if ("error" in auth) return auth.error;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Service role client is required for approval recall." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const content = optionalText(body?.content);
  if (!content) {
    return NextResponse.json({ error: "content is required." }, { status: 400 });
  }

  const verdict = await recallApprovability(admin, {
    surface: normalizeSurface(body?.surface),
    sourceType: optionalText(body?.sourceType),
    category: optionalText(body?.category),
    content,
  });

  return NextResponse.json({ verdict });
}
