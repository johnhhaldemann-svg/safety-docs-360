import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { getCompanyScope, normalizeWorkspaceUuid } from "@/lib/companyScope";
import { appendDebugSessionLog } from "@/lib/debugSessionLog";

export const runtime = "nodejs";

type Params = { companyId: string; surface: string };

const SURFACES = new Set(["overview", "users", "jobsites", "documents", "analytics"]);

async function fetchFromSameOrigin(request: Request, path: string) {
  const origin = new URL(request.url).origin;
  const response = await fetch(`${origin}${path}`, {
    headers: request.headers,
  });
  const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: response.ok, status: response.status, json };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const auth = await authorizeRequest(request, {
    requireAnyPermission: [
      "can_view_all_company_data",
      "can_view_analytics",
      "can_view_dashboards",
      "can_manage_company_users",
      "can_create_documents",
    ],
  });
  if ("error" in auth) {
    // #region agent log
    appendDebugSessionLog({
      hypothesisId: "H-company-surface-auth",
      location: "api/companies/[companyId]/[surface]/GET",
      message: "authorizeRequest failed",
      data: {},
      runId: "file-log",
    });
    // #endregion
    return auth.error;
  }

  const { companyId, surface } = await params;
  if (!SURFACES.has(surface)) {
    return NextResponse.json({ error: "Unknown company surface." }, { status: 404 });
  }

  const scope = await getCompanyScope({
    supabase: auth.supabase,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });
  if (!scope.companyId) {
    // #region agent log
    appendDebugSessionLog({
      hypothesisId: "H-company-surface-scope",
      location: "api/companies/[companyId]/[surface]/GET",
      message: "no company scope",
      data: { surface },
      runId: "file-log",
    });
    // #endregion
    return NextResponse.json({ error: "No company scope found for user." }, { status: 400 });
  }
  const scopeMatchesRaw = scope.companyId === companyId;
  const scopeMatchesNorm =
    normalizeWorkspaceUuid(scope.companyId) === normalizeWorkspaceUuid(companyId);
  // #region agent log
  appendDebugSessionLog({
    hypothesisId: "H-company-scope-compare",
    location: "api/companies/[companyId]/[surface]/GET",
    message: "company id compare",
    data: { surface, scopeMatchesRaw, scopeMatchesNorm },
    runId: "file-log",
  });
  // #endregion
  if (!scopeMatchesNorm) {
    return NextResponse.json({ error: "Forbidden for requested company." }, { status: 403 });
  }

  if (surface === "users") {
    const users = await fetchFromSameOrigin(request, "/api/company/users");
    return NextResponse.json(users.json ?? {}, { status: users.status });
  }
  if (surface === "jobsites") {
    const jobsites = await fetchFromSameOrigin(request, "/api/company/jobsites");
    return NextResponse.json(jobsites.json ?? {}, { status: jobsites.status });
  }
  if (surface === "documents") {
    const documents = await fetchFromSameOrigin(request, "/api/workspace/documents");
    return NextResponse.json(documents.json ?? {}, { status: documents.status });
  }
  if (surface === "analytics") {
    const analytics = await fetchFromSameOrigin(request, "/api/company/analytics/summary");
    return NextResponse.json(analytics.json ?? {}, { status: analytics.status });
  }

  const [users, jobsites, documents, analytics] = await Promise.all([
    fetchFromSameOrigin(request, "/api/company/users"),
    fetchFromSameOrigin(request, "/api/company/jobsites"),
    fetchFromSameOrigin(request, "/api/workspace/documents"),
    fetchFromSameOrigin(request, "/api/company/analytics/summary"),
  ]);

  const usersList = (users.json?.users as unknown[] | undefined) ?? [];
  const jobsitesList = (jobsites.json?.jobsites as unknown[] | undefined) ?? [];
  const docsList = (documents.json?.documents as unknown[] | undefined) ?? [];
  const summary = (analytics.json?.summary as Record<string, unknown> | undefined) ?? {};
  const analyticsIssue = analytics.ok
    ? null
    : (typeof analytics.json?.error === "string" ? analytics.json.error.trim() : "") ||
      (typeof analytics.json?.warning === "string" ? analytics.json.warning.trim() : "") ||
      "Analytics summary could not be loaded.";

  return NextResponse.json(
    {
      companyId,
      overview: {
        users: usersList.length,
        jobsites: jobsitesList.length,
        documents: docsList.length,
        analyticsSummary: summary,
        ...(analyticsIssue ? { analyticsSummaryIssue: analyticsIssue } : {}),
      },
      links: {
        users: `/companies/${companyId}/users`,
        jobsites: `/companies/${companyId}/jobsites`,
        documents: `/companies/${companyId}/documents`,
        analytics: `/companies/${companyId}/analytics`,
      },
    },
    { status: 200 }
  );
}
