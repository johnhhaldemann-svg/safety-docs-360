import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCompanyScope } from "@/lib/companyScope";
import { canMutateCompanyTrainingRequirements } from "@/lib/companyTrainingAccess";
import { authorizeRequest, isCompanyRole, type PermissionMap } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { extractTrainingRecordFromPhoto } from "@/lib/trainingRecordPhotoExtraction";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

type RouteContext = { params: Promise<{ id: string }> };

type AuthorizedRequestContext = {
  supabase: SupabaseClient;
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> };
  role: string;
  team: string;
  permissionMap: PermissionMap;
};

type CompanyScopeContext = { companyId: string; companyName: string };

async function resolveCompany(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return { auth, response: auth.error } as const;

  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (isCompanyRole(auth.role) && !companyScope.companyId) {
    return {
      auth,
      response: NextResponse.json(
        { error: "This company account is not linked to a company workspace yet." },
        { status: 400 }
      ),
    } as const;
  }

  if (!companyScope.companyId) {
    return {
      auth,
      response: NextResponse.json({ error: "Company workspace is required." }, { status: 400 }),
    } as const;
  }

  return { auth, companyScope, response: null } as const;
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as File).arrayBuffer === "function" &&
    typeof (value as File).type === "string" &&
    typeof (value as File).size === "number"
  );
}

async function loadEmployee(
  db: SupabaseClient,
  companyId: string,
  employeeId: string
): Promise<{ id: string; full_name: string } | null> {
  const result = await db
    .from("company_employee_profiles")
    .select("id, full_name")
    .eq("company_id", companyId)
    .eq("id", employeeId)
    .maybeSingle();

  if (result.error || !result.data) return null;
  return result.data as { id: string; full_name: string };
}

export async function POST(request: Request, context: RouteContext) {
  const resolved = await resolveCompany(request);
  if (resolved.response) return resolved.response;
  if (!("companyScope" in resolved)) {
    return NextResponse.json({ error: "Company workspace is required." }, { status: 400 });
  }
  const auth = resolved.auth as AuthorizedRequestContext;
  const companyScope = resolved.companyScope as CompanyScopeContext;

  if (!canMutateCompanyTrainingRequirements(auth.role, auth.permissionMap)) {
    return NextResponse.json(
      { error: "Only company admins, managers, and safety managers can read training cards." },
      { status: 403 }
    );
  }
  if (auth.role === "sales_demo") {
    return NextResponse.json({ error: "Demo workspaces cannot read tracked employee training cards." }, { status: 403 });
  }

  const { id: rawId } = await context.params;
  const employeeId = rawId.trim();
  if (!employeeId) return NextResponse.json({ error: "Employee id is required." }, { status: 400 });

  const db = createSupabaseAdminClient() ?? auth.supabase;
  const employee = await loadEmployee(db, companyScope.companyId, employeeId);
  if (!employee) {
    return NextResponse.json({ error: "Tracked employee not found." }, { status: 404 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file") ?? null;
  if (!isUploadedFile(file)) {
    return NextResponse.json({ error: "Upload one training card image." }, { status: 400 });
  }

  const mimeType = file.type.trim().toLowerCase();
  if (!mimeType.startsWith("image/")) {
    return NextResponse.json({ error: "Training card upload must be an image." }, { status: 400 });
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: "Training card image is empty." }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Training card image must be 8 MB or smaller." }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${mimeType};base64,${bytes.toString("base64")}`;
  const extraction = await extractTrainingRecordFromPhoto({
    dataUrl,
    fileName: file.name,
    employeeName: employee.full_name,
  });

  if (!extraction.draft) {
    return NextResponse.json(
      {
        error: extraction.error || "AI could not read this training image.",
        meta: extraction.meta,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    draft: extraction.draft,
    meta: extraction.meta,
  });
}
