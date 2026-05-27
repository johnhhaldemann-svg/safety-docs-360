import { NextResponse } from "next/server";
import { authorizeRequest, type AppPermission } from "@/lib/rbac";
import { getCompanyScope } from "@/lib/companyScope";
import { canManageCompanyIncidents } from "@/lib/companyFeatureAccess";
import { getJobsiteAccessScope, isJobsiteAllowed } from "@/lib/jobsiteAccess";
import { blockIfCsepOnlyCompany } from "@/lib/csepApiGuard";
import { checkFixedWindowRateLimit } from "@/lib/rateLimit";
import { serverLog } from "@/lib/serverLog";
import { buildOshaLogImportResponseSummary, OSHA_LOG_PARSER_VERSION, parseOshaLogBuffer } from "@/lib/oshaLogs";
import type { OshaLogCaseRow, OshaLogImportRow } from "@/lib/oshaLogs";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls", ".xlsm", ".pdf"];

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "osha-log";
}

function isAllowedFileName(fileName: string) {
  const lower = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function parseImportYear(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  const year = Number.parseInt(text, 10);
  const currentYear = new Date().getUTCFullYear() + 1;
  return Number.isFinite(year) && year >= 1970 && year <= currentYear ? year : null;
}

async function resolveCompany(request: Request, permissions: AppPermission[]) {
  const auth = await authorizeRequest(request, { requireAnyPermission: permissions });
  if ("error" in auth) return { auth, response: auth.error as NextResponse };
  const companyScope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!companyScope.companyId) {
    return {
      auth,
      response: NextResponse.json({ error: "This account is not linked to a company workspace yet." }, { status: 400 }),
    };
  }
  const csepBlock = await blockIfCsepOnlyCompany(auth.supabase, companyScope.companyId);
  if (csepBlock) return { auth, response: csepBlock };
  return { auth, companyScope };
}

export async function GET(request: Request) {
  const resolved = await resolveCompany(request, [
    "can_create_documents",
    "can_view_all_company_data",
    "can_view_analytics",
    "can_view_dashboards",
  ]);
  if ("response" in resolved) return resolved.response;
  const { auth, companyScope } = resolved;

  const result = await auth.supabase
    .from("company_osha_log_imports")
    .select("id, company_id, jobsite_id, original_file_name, storage_path, file_mime_type, file_size_bytes, import_year, status, parser_version, parse_method, parsed_count, skipped_count, warnings, created_by, created_at")
    .eq("company_id", companyScope.companyId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (result.error) {
    return NextResponse.json({ imports: [], warning: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ imports: (result.data ?? []) as OshaLogImportRow[] });
}

export async function POST(request: Request) {
  const resolved = await resolveCompany(request, ["can_create_documents", "can_view_all_company_data"]);
  if ("response" in resolved) return resolved.response;
  const { auth, companyScope } = resolved;
  if (!canManageCompanyIncidents(auth.role, auth.permissionMap)) {
    return NextResponse.json({ error: "Only company admins and managers can upload OSHA logs." }, { status: 403 });
  }

  const rl = checkFixedWindowRateLimit(`osha-log-import:${auth.user.id}`, { windowMs: 60_000, max: 8 });
  if (!rl.ok) {
    return NextResponse.json({ error: `Too many OSHA log uploads. Retry in ${rl.retryAfterSec}s.` }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 15 MB)." }, { status: 400 });
  }
  const originalName = sanitizeFileName(file.name || "osha-log");
  if (!isAllowedFileName(originalName)) {
    return NextResponse.json({ error: "Upload CSV, XLSX, XLS, XLSM, or selectable-text PDF OSHA logs." }, { status: 400 });
  }

  const jobsiteId = typeof formData.get("jobsiteId") === "string" ? String(formData.get("jobsiteId")).trim() || null : null;
  const jobsiteScope = await getJobsiteAccessScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    companyId: companyScope.companyId,
    role: auth.role,
  });
  if (!isJobsiteAllowed(jobsiteId, jobsiteScope)) {
    return NextResponse.json({ error: "You can only upload OSHA logs for assigned jobsites." }, { status: 403 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseOshaLogBuffer(buffer, originalName, file.type || null);
  if (parsed.status === "failed") {
    return NextResponse.json({ error: parsed.warnings[0]?.message ?? "OSHA log could not be parsed.", warnings: parsed.warnings }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const storagePath = `companies/${companyScope.companyId}/osha-logs/${today}/${Date.now()}-${originalName}`;
  const upload = await auth.supabase.storage.from("documents").upload(storagePath, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (upload.error) {
    return NextResponse.json({ error: `Storage upload failed: ${upload.error.message}` }, { status: 500 });
  }

  const importInsert = await auth.supabase
    .from("company_osha_log_imports")
    .insert({
      company_id: companyScope.companyId,
      jobsite_id: jobsiteId,
      original_file_name: originalName,
      storage_path: storagePath,
      file_mime_type: file.type || null,
      file_size_bytes: file.size,
      import_year: parseImportYear(formData.get("year")),
      status: parsed.status,
      parser_version: OSHA_LOG_PARSER_VERSION,
      parse_method: parsed.method,
      parsed_count: parsed.parsedCount,
      skipped_count: parsed.skippedCount,
      warnings: parsed.warnings,
      created_by: auth.user.id,
    })
    .select("id")
    .single();

  if (importInsert.error || !importInsert.data?.id) {
    await auth.supabase.storage.from("documents").remove([storagePath]).catch(() => undefined);
    return NextResponse.json({ error: importInsert.error?.message ?? "Failed to save OSHA log import." }, { status: 500 });
  }

  const importId = String(importInsert.data.id);
  const cases: OshaLogCaseRow[] = parsed.cases.map((row) => ({
    company_id: companyScope.companyId,
    import_id: importId,
    jobsite_id: jobsiteId,
    case_number: row.caseNumber,
    occurred_on: row.occurredOn,
    department: row.department,
    location: row.location,
    injury_type: row.injuryType,
    body_part: row.bodyPart,
    exposure_event_type: row.exposureEventType,
    injury_source: row.injurySource,
    days_away_from_work: row.daysAwayFromWork,
    days_restricted: row.daysRestricted,
    job_transfer: row.jobTransfer,
    recordable: row.recordable,
    fatality: row.fatality,
    severity: row.severity,
    repeat_pattern_key: row.repeatPatternKey,
    deidentified_summary: row.deidentifiedSummary,
    source_row_number: row.sourceRowNumber,
    parser_confidence: row.parserConfidence,
  }));

  if (cases.length > 0) {
    const caseInsert = await auth.supabase.from("company_osha_log_cases").insert(cases);
    if (caseInsert.error) {
      await auth.supabase.from("company_osha_log_imports").delete().eq("id", importId).eq("company_id", companyScope.companyId);
      await auth.supabase.storage.from("documents").remove([storagePath]).catch(() => undefined);
      return NextResponse.json({ error: caseInsert.error.message || "Failed to save parsed OSHA log cases." }, { status: 500 });
    }
  }

  await auth.supabase.from("company_risk_events").insert({
    company_id: companyScope.companyId,
    module_name: "osha_logs",
    record_id: importId,
    event_type: "osha_log_imported",
    detail: "OSHA log imported as deidentified repeat-injury prevention signals.",
    event_payload: {
      status: parsed.status,
      parsedCount: parsed.parsedCount,
      skippedCount: parsed.skippedCount,
      parseMethod: parsed.method,
      jobsiteId,
    },
    created_by: auth.user.id,
  }).then((result) => {
    if (result.error) {
      serverLog("warn", "osha_log_risk_event_failed", {
        companyId: companyScope.companyId,
        importId,
        message: result.error.message.slice(0, 200),
      });
    }
  });

  return NextResponse.json({
    id: importId,
    status: parsed.status,
    parsedCount: parsed.parsedCount,
    skippedCount: parsed.skippedCount,
    warnings: parsed.warnings,
    topDrivers: buildOshaLogImportResponseSummary(parsed.cases),
  });
}

export async function DELETE(request: Request) {
  const resolved = await resolveCompany(request, ["can_edit_documents", "can_view_all_company_data"]);
  if ("response" in resolved) return resolved.response;
  const { auth, companyScope } = resolved;
  if (!canManageCompanyIncidents(auth.role, auth.permissionMap)) {
    return NextResponse.json({ error: "Only company admins and managers can delete OSHA log imports." }, { status: 403 });
  }
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const existing = await auth.supabase
    .from("company_osha_log_imports")
    .select("id, storage_path")
    .eq("id", id)
    .eq("company_id", companyScope.companyId)
    .maybeSingle();
  if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 500 });
  if (!existing.data) return NextResponse.json({ error: "OSHA log import not found." }, { status: 404 });

  const deleted = await auth.supabase
    .from("company_osha_log_imports")
    .delete()
    .eq("id", id)
    .eq("company_id", companyScope.companyId);
  if (deleted.error) return NextResponse.json({ error: deleted.error.message }, { status: 500 });

  const storagePath = String(existing.data.storage_path ?? "");
  if (storagePath) {
    await auth.supabase.storage.from("documents").remove([storagePath]).catch(() => undefined);
  }

  return NextResponse.json({ success: true });
}
