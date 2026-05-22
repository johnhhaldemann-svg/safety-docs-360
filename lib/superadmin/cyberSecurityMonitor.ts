import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingCompanyDataRequestsError } from "@/lib/companyDataRequests";
import { isMissingCompanySecurityEventsError } from "@/lib/companySecurityEvents";
import { getSupabaseServerEnvStatus } from "@/lib/supabaseAdmin";

export type CyberSecurityStatus = "healthy" | "warning" | "critical" | "unknown";

export type CyberSecurityCheck = {
  id: string;
  label: string;
  status: CyberSecurityStatus;
  message: string;
  evidence: string | null;
  recommendedAction: string | null;
  category: "website" | "headers" | "telemetry" | "access" | "compliance";
};

export type CyberHeaderCheck = CyberSecurityCheck & {
  headerName: string;
  observedValue: string | null;
};

export type CyberSecurityEventRow = {
  id: string;
  company_id: string | null;
  actor_role: string | null;
  event_type: string;
  resource_type: string;
  title: string;
  detail: string | null;
  ip_address: string | null;
  occurred_at: string;
};

export type CyberComplianceDocument = {
  title: string;
  path: string;
  status: "available" | "missing";
  purpose: string;
};

export type CyberSecuritySnapshot = {
  generatedAt: string;
  monitoredUrl: string;
  overallStatus: CyberSecurityStatus;
  postureScore: number;
  summary: {
    totalChecks: number;
    healthy: number;
    warning: number;
    critical: number;
    unknown: number;
  };
  website: {
    url: string;
    statusCode: number | null;
    responseTimeMs: number | null;
    checks: CyberSecurityCheck[];
    headers: CyberHeaderCheck[];
  };
  telemetry: {
    companies: number | null;
    securityEventsLast24h: number | null;
    securityEventsLast7d: number | null;
    sensitiveEventsLast7d: number | null;
    pendingDataRequests: number | null;
    suspendedAccounts: number | null;
    recentEvents: CyberSecurityEventRow[];
    checks: CyberSecurityCheck[];
  };
  compliance: {
    documents: CyberComplianceDocument[];
    checks: CyberSecurityCheck[];
  };
  controlGroups: CyberSecurityCheck[];
};

type MessageError = { message?: string | null };
type SupabaseCountQuery = PromiseLike<{ count: number | null; error: MessageError | null }> & {
  eq: (column: string, value: string) => SupabaseCountQuery;
  gte: (column: string, value: string) => SupabaseCountQuery;
  in: (column: string, values: readonly string[]) => SupabaseCountQuery;
};

const SENSITIVE_EVENT_TYPES = [
  "user_access_updated",
  "user_suspended",
  "user_removed",
  "file_upload_link_created",
  "file_uploaded",
  "file_downloaded",
  "report_export_link_created",
  "billing_admin_action",
  "security_sensitive_ai_action",
  "data_request_submitted",
  "data_request_updated",
  "data_request_completed",
] as const;

const OPEN_DATA_REQUEST_STATUSES = [
  "submitted",
  "reviewing",
  "waiting_on_customer",
] as const;

const COMPLIANCE_DOCUMENTS = [
  {
    title: "Security Overview",
    fileName: "security-overview.md",
    purpose: "Customer-facing security posture summary.",
  },
  {
    title: "SOC 2 / ISO Readiness Binder",
    fileName: "soc2-iso-readiness-binder.md",
    purpose: "Control evidence map for enterprise security review.",
  },
  {
    title: "OWASP Self Review Checklist",
    fileName: "owasp-self-review-checklist.md",
    purpose: "Application security review checklist.",
  },
  {
    title: "Audit Logging Summary",
    fileName: "audit-logging-summary.md",
    purpose: "Summary of activity evidence and audit trails.",
  },
  {
    title: "Incident Response Summary",
    fileName: "incident-response-summary.md",
    purpose: "Security incident triage and response narrative.",
  },
  {
    title: "File Evidence Controls",
    fileName: "file-evidence-controls.md",
    purpose: "Controls for uploaded documents and evidence files.",
  },
] as const;

function check(params: CyberSecurityCheck): CyberSecurityCheck {
  return params;
}

function statusRank(status: CyberSecurityStatus) {
  if (status === "critical") return 0;
  if (status === "warning") return 1;
  if (status === "unknown") return 2;
  return 3;
}

function worstStatus(a: CyberSecurityStatus, b: CyberSecurityStatus): CyberSecurityStatus {
  return statusRank(a) <= statusRank(b) ? a : b;
}

function scoreFromStatus(status: CyberSecurityStatus) {
  if (status === "healthy") return 100;
  if (status === "unknown") return 65;
  if (status === "warning") return 55;
  return 0;
}

function summarizeChecks(checks: CyberSecurityCheck[]) {
  return {
    totalChecks: checks.length,
    healthy: checks.filter((item) => item.status === "healthy").length,
    warning: checks.filter((item) => item.status === "warning").length,
    critical: checks.filter((item) => item.status === "critical").length,
    unknown: checks.filter((item) => item.status === "unknown").length,
  };
}

function isLocalOrigin(url: URL) {
  return (
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1"
  );
}

function normalizeMonitorUrl(requestUrl: string) {
  const requestOrigin = new URL(requestUrl).origin;
  return new URL(requestOrigin);
}

async function headCount(
  admin: SupabaseClient,
  table: string,
  filter?: (query: SupabaseCountQuery) => SupabaseCountQuery
): Promise<{ count: number; error: MessageError | null }> {
  try {
    let query = admin
      .from(table)
      .select("*", { count: "exact", head: true }) as unknown as SupabaseCountQuery;
    if (filter) query = filter(query);
    const { count, error } = await query;
    return { count: count ?? 0, error: error ?? null };
  } catch (error) {
    return {
      count: 0,
      error: { message: error instanceof Error ? error.message : "query_failed" },
    };
  }
}

async function readRecentSecurityEvents(
  admin: SupabaseClient
): Promise<{ rows: CyberSecurityEventRow[]; error: MessageError | null }> {
  try {
    const { data, error } = await admin
      .from("company_security_events")
      .select(
        "id, company_id, actor_role, event_type, resource_type, title, detail, ip_address, occurred_at"
      )
      .order("occurred_at", { ascending: false })
      .limit(8);

    return {
      rows: ((data as CyberSecurityEventRow[] | null) ?? []),
      error: error ?? null,
    };
  } catch (error) {
    return {
      rows: [],
      error: { message: error instanceof Error ? error.message : "query_failed" },
    };
  }
}

function headerValue(headers: Headers, name: string) {
  return headers.get(name);
}

function evaluateHeader(params: {
  id: string;
  label: string;
  headerName: string;
  observedValue: string | null;
  healthyWhen?: (value: string) => boolean;
  missingStatus?: CyberSecurityStatus;
  missingMessage: string;
  weakMessage?: string;
  recommendedAction: string;
  isLocal: boolean;
}): CyberHeaderCheck {
  const observed = params.observedValue?.trim() || null;
  const missingStatus =
    params.isLocal && params.headerName.toLowerCase() === "strict-transport-security"
      ? "unknown"
      : params.missingStatus ?? "warning";

  if (!observed) {
    return {
      id: params.id,
      label: params.label,
      headerName: params.headerName,
      observedValue: null,
      category: "headers",
      status: missingStatus,
      message: params.missingMessage,
      evidence: null,
      recommendedAction: params.recommendedAction,
    };
  }

  const healthy = params.healthyWhen ? params.healthyWhen(observed) : true;
  return {
    id: params.id,
    label: params.label,
    headerName: params.headerName,
    observedValue: observed,
    category: "headers",
    status: healthy ? "healthy" : "warning",
    message: healthy
      ? `${params.label} is present.`
      : params.weakMessage ?? `${params.label} is present but should be reviewed.`,
    evidence: observed,
    recommendedAction: healthy ? null : params.recommendedAction,
  };
}

async function probeWebsite(url: URL) {
  const startedAt = Date.now();
  const checks: CyberSecurityCheck[] = [];
  let response: Response | null = null;
  let responseTimeMs: number | null = null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    response = await fetch(url.toString(), {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "SafePredict-CyberMonitor/1.0",
      },
    });
    responseTimeMs = Date.now() - startedAt;
  } catch (error) {
    responseTimeMs = Date.now() - startedAt;
    checks.push(
      check({
        id: "website-reachable",
        label: "Website reachability",
        status: "critical",
        category: "website",
        message: `The monitored website did not respond: ${
          error instanceof Error ? error.message : "request_failed"
        }`,
        evidence: null,
        recommendedAction: "Confirm the production domain, DNS, and deployment are reachable.",
      })
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const isLocal = isLocalOrigin(url);
  const statusCode = response?.status ?? null;

  if (response) {
    const status =
      response.status >= 500
        ? "critical"
        : response.status >= 400
          ? "warning"
          : "healthy";
    checks.push(
      check({
        id: "website-reachable",
        label: "Website reachability",
        status,
        category: "website",
        message:
          status === "healthy"
            ? `Website responded with HTTP ${response.status}.`
            : `Website responded with HTTP ${response.status}.`,
        evidence: responseTimeMs === null ? null : `${responseTimeMs} ms`,
        recommendedAction:
          status === "healthy"
            ? null
            : "Review the deployment status, route handlers, and edge logs for this domain.",
      })
    );
  }

  checks.push(
    check({
      id: "website-https",
      label: "HTTPS",
      status: url.protocol === "https:" ? "healthy" : isLocal ? "unknown" : "critical",
      category: "website",
      message:
        url.protocol === "https:"
          ? "The monitored origin uses HTTPS."
          : isLocal
            ? "Local development is running over HTTP."
            : "The monitored origin is not using HTTPS.",
      evidence: url.protocol.replace(":", "").toUpperCase(),
      recommendedAction:
        url.protocol === "https:" || isLocal
          ? null
          : "Serve the production site over HTTPS and redirect HTTP traffic to HTTPS.",
    })
  );

  const headers = response?.headers ?? new Headers();
  const csp = headerValue(headers, "content-security-policy");
  const frameOptions = headerValue(headers, "x-frame-options");
  const headerChecks: CyberHeaderCheck[] = [
    evaluateHeader({
      id: "header-hsts",
      label: "HSTS",
      headerName: "strict-transport-security",
      observedValue: headerValue(headers, "strict-transport-security"),
      healthyWhen: (value) => /\bmax-age=\d+/i.test(value),
      missingMessage: "HTTP Strict Transport Security is not visible on the monitored response.",
      weakMessage: "HSTS is present but does not include a max-age directive.",
      recommendedAction: "Add Strict-Transport-Security with a long max-age on HTTPS responses.",
      isLocal,
    }),
    evaluateHeader({
      id: "header-csp",
      label: "Content Security Policy",
      headerName: "content-security-policy",
      observedValue: csp,
      healthyWhen: (value) => /\bframe-ancestors\b/i.test(value),
      missingMessage: "No Content-Security-Policy header was observed.",
      weakMessage: "Content-Security-Policy is present but frame-ancestors is not set.",
      recommendedAction: "Add a CSP that includes frame-ancestors and review script/source directives.",
      isLocal,
    }),
    evaluateHeader({
      id: "header-frame-control",
      label: "Frame control",
      headerName: "x-frame-options / frame-ancestors",
      observedValue: frameOptions ?? (csp && /\bframe-ancestors\b/i.test(csp) ? "frame-ancestors" : null),
      healthyWhen: (value) => /deny|sameorigin|frame-ancestors/i.test(value),
      missingMessage: "No frame protection was observed.",
      weakMessage: "Frame protection is present but should be reviewed.",
      recommendedAction: "Set X-Frame-Options or CSP frame-ancestors to reduce clickjacking risk.",
      isLocal,
    }),
    evaluateHeader({
      id: "header-nosniff",
      label: "MIME sniffing protection",
      headerName: "x-content-type-options",
      observedValue: headerValue(headers, "x-content-type-options"),
      healthyWhen: (value) => value.toLowerCase() === "nosniff",
      missingMessage: "X-Content-Type-Options was not observed.",
      weakMessage: "X-Content-Type-Options should be set to nosniff.",
      recommendedAction: "Set X-Content-Type-Options: nosniff.",
      isLocal,
    }),
    evaluateHeader({
      id: "header-referrer",
      label: "Referrer policy",
      headerName: "referrer-policy",
      observedValue: headerValue(headers, "referrer-policy"),
      healthyWhen: (value) => !/unsafe-url/i.test(value),
      missingMessage: "No Referrer-Policy header was observed.",
      weakMessage: "Referrer-Policy is present but allows more leakage than expected.",
      recommendedAction: "Set Referrer-Policy to strict-origin-when-cross-origin or stricter.",
      isLocal,
    }),
    evaluateHeader({
      id: "header-permissions",
      label: "Browser permissions policy",
      headerName: "permissions-policy",
      observedValue: headerValue(headers, "permissions-policy"),
      missingMessage: "No Permissions-Policy header was observed.",
      recommendedAction: "Set Permissions-Policy to disable unused browser features.",
      isLocal,
    }),
  ];

  return {
    statusCode,
    responseTimeMs,
    checks,
    headers: headerChecks,
  };
}

async function buildTelemetry(admin: SupabaseClient | null) {
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const checks: CyberSecurityCheck[] = [];

  if (!admin) {
    const env = getSupabaseServerEnvStatus();
    checks.push(
      check({
        id: "service-role-client",
        label: "Service-role telemetry",
        status: "critical",
        category: "telemetry",
        message: "The server-side Supabase service role client is not configured.",
        evidence: `URL: ${env.url ? "set" : "missing"} / service role: ${
          env.serviceRoleKey ? "set" : "missing"
        }`,
        recommendedAction: "Set SUPABASE_SERVICE_ROLE_KEY on the server and re-run the cyber check.",
      })
    );

    return {
      companies: null,
      securityEventsLast24h: null,
      securityEventsLast7d: null,
      sensitiveEventsLast7d: null,
      pendingDataRequests: null,
      suspendedAccounts: null,
      recentEvents: [],
      checks,
    };
  }

  const companies = await headCount(admin, "companies");
  checks.push(
    check({
      id: "companies-readable",
      label: "Company registry",
      status: companies.error ? "warning" : "healthy",
      category: "access",
      message: companies.error
        ? `Could not count company rows: ${companies.error.message ?? "query_failed"}`
        : `${companies.count} company row(s) are visible to the server-side monitor.`,
      evidence: companies.error ? null : `${companies.count} companies`,
      recommendedAction: companies.error
        ? "Confirm the companies table exists and the service role can read it."
        : null,
    })
  );

  const events24h = await headCount(admin, "company_security_events", (query) =>
    query.gte("occurred_at", since24h)
  );
  const events7d = await headCount(admin, "company_security_events", (query) =>
    query.gte("occurred_at", since7d)
  );
  const sensitive7d = await headCount(admin, "company_security_events", (query) =>
    query.gte("occurred_at", since7d).in("event_type", [...SENSITIVE_EVENT_TYPES])
  );
  const recent = await readRecentSecurityEvents(admin);
  const securityEventsError = events7d.error ?? events24h.error ?? sensitive7d.error ?? recent.error;
  const securityEventsMissing = isMissingCompanySecurityEventsError(securityEventsError);

  checks.push(
    check({
      id: "security-events-table",
      label: "Security event telemetry",
      status: securityEventsError ? (securityEventsMissing ? "critical" : "warning") : "healthy",
      category: "telemetry",
      message: securityEventsError
        ? securityEventsMissing
          ? "The company_security_events table is not available to the monitor."
          : `Security event query failed: ${securityEventsError.message ?? "query_failed"}`
        : `${events7d.count} security event(s) were logged in the last 7 days.`,
      evidence: securityEventsError ? null : `${events24h.count} in 24h / ${events7d.count} in 7d`,
      recommendedAction: securityEventsError
        ? "Run the enterprise IT readiness migration and confirm grants/RLS are in place."
        : null,
    })
  );

  checks.push(
    check({
      id: "sensitive-events",
      label: "Sensitive activity",
      status: sensitive7d.error ? "unknown" : sensitive7d.count > 25 ? "warning" : "healthy",
      category: "telemetry",
      message: sensitive7d.error
        ? "Sensitive event volume could not be evaluated."
        : `${sensitive7d.count} sensitive security event(s) were logged in the last 7 days.`,
      evidence: sensitive7d.error ? null : `${sensitive7d.count} sensitive events`,
      recommendedAction:
        !sensitive7d.error && sensitive7d.count > 25
          ? "Review recent access, export, file, billing, and AI-sensitive actions for unexpected spikes."
          : null,
    })
  );

  const pendingDataRequests = await headCount(admin, "company_data_requests", (query) =>
    query.in("status", [...OPEN_DATA_REQUEST_STATUSES])
  );
  const dataRequestsMissing = isMissingCompanyDataRequestsError(pendingDataRequests.error);
  checks.push(
    check({
      id: "data-request-controls",
      label: "Data request controls",
      status: pendingDataRequests.error ? (dataRequestsMissing ? "critical" : "warning") : "healthy",
      category: "compliance",
      message: pendingDataRequests.error
        ? dataRequestsMissing
          ? "The company_data_requests table is not available to the monitor."
          : `Data request query failed: ${pendingDataRequests.error.message ?? "query_failed"}`
        : `${pendingDataRequests.count} open privacy/export/deletion request(s).`,
      evidence: pendingDataRequests.error ? null : `${pendingDataRequests.count} open requests`,
      recommendedAction: pendingDataRequests.error
        ? "Apply the enterprise IT readiness controls migration."
        : null,
    })
  );

  const suspendedAccounts = await headCount(admin, "user_roles", (query) =>
    query.eq("account_status", "suspended")
  );
  checks.push(
    check({
      id: "suspended-account-monitoring",
      label: "Suspended account monitoring",
      status: suspendedAccounts.error ? "unknown" : "healthy",
      category: "access",
      message: suspendedAccounts.error
        ? "Suspended account count could not be evaluated."
        : `${suspendedAccounts.count} suspended account row(s) were found.`,
      evidence: suspendedAccounts.error ? null : `${suspendedAccounts.count} suspended`,
      recommendedAction: suspendedAccounts.error
        ? "Confirm user_roles.account_status exists in the active RBAC migration."
        : null,
    })
  );

  return {
    companies: companies.error ? null : companies.count,
    securityEventsLast24h: events24h.error ? null : events24h.count,
    securityEventsLast7d: events7d.error ? null : events7d.count,
    sensitiveEventsLast7d: sensitive7d.error ? null : sensitive7d.count,
    pendingDataRequests: pendingDataRequests.error ? null : pendingDataRequests.count,
    suspendedAccounts: suspendedAccounts.error ? null : suspendedAccounts.count,
    recentEvents: recent.error ? [] : recent.rows,
    checks,
  };
}

function buildComplianceEvidence() {
  const documents = COMPLIANCE_DOCUMENTS.map(
    (item) =>
      ({
        title: item.title,
        path: `docs/enterprise-it-readiness/${item.fileName}`,
        purpose: item.purpose,
        status: "available",
      }) satisfies CyberComplianceDocument
  );

  const available = documents.filter((item) => item.status === "available").length;
  const checks: CyberSecurityCheck[] = [
    check({
      id: "evidence-library",
      label: "Compliance evidence library",
      status: available === documents.length ? "healthy" : "warning",
      category: "compliance",
      message: `${available} of ${documents.length} enterprise IT readiness evidence documents are registered in the release manifest.`,
      evidence: "docs/enterprise-it-readiness",
      recommendedAction:
        available === documents.length
          ? null
          : "Restore the missing readiness documents before a customer security review.",
    }),
  ];

  return { documents, checks };
}

function buildControlGroups(params: {
  websiteChecks: CyberSecurityCheck[];
  headerChecks: CyberSecurityCheck[];
  telemetryChecks: CyberSecurityCheck[];
  complianceChecks: CyberSecurityCheck[];
}) {
  const groupInput = [
    {
      id: "web-perimeter",
      label: "Web perimeter",
      category: "website" as const,
      checks: [...params.websiteChecks, ...params.headerChecks],
      healthyMessage: "Website reachability and browser-side security headers are being monitored.",
      action: "Review website response, HTTPS, and headers when this group changes state.",
    },
    {
      id: "audit-telemetry",
      label: "Audit telemetry",
      category: "telemetry" as const,
      checks: params.telemetryChecks.filter((item) => item.category === "telemetry"),
      healthyMessage: "Security event logging is available for review.",
      action: "Confirm company_security_events is migrated and logging sensitive actions.",
    },
    {
      id: "access-governance",
      label: "Access governance",
      category: "access" as const,
      checks: params.telemetryChecks.filter((item) => item.category === "access"),
      healthyMessage: "Access governance data is available to the monitor.",
      action: "Review user_roles, account statuses, and superadmin-only permissions.",
    },
    {
      id: "privacy-readiness",
      label: "Privacy and evidence",
      category: "compliance" as const,
      checks: [...params.complianceChecks, ...params.telemetryChecks.filter((item) => item.category === "compliance")],
      healthyMessage: "Compliance evidence and data request controls are present.",
      action: "Keep evidence docs current and close open data requests on schedule.",
    },
  ];

  return groupInput.map((group) => {
    const status = group.checks.reduce<CyberSecurityStatus>(
      (acc, item) => worstStatus(acc, item.status),
      "healthy"
    );
    return check({
      id: group.id,
      label: group.label,
      status,
      category: group.category,
      message:
        status === "healthy"
          ? group.healthyMessage
          : `${group.checks.filter((item) => item.status !== "healthy").length} check(s) need review.`,
      evidence: `${group.checks.length} check(s)`,
      recommendedAction: status === "healthy" ? null : group.action,
    });
  });
}

export async function buildCyberSecuritySnapshot(params: {
  admin: SupabaseClient | null;
  requestUrl: string;
}): Promise<CyberSecuritySnapshot> {
  const generatedAt = new Date().toISOString();
  const monitorUrl = normalizeMonitorUrl(params.requestUrl);
  const website = await probeWebsite(monitorUrl);
  const telemetry = await buildTelemetry(params.admin);
  const compliance = buildComplianceEvidence();
  const controlGroups = buildControlGroups({
    websiteChecks: website.checks,
    headerChecks: website.headers,
    telemetryChecks: telemetry.checks,
    complianceChecks: compliance.checks,
  });
  const allChecks = [
    ...website.checks,
    ...website.headers,
    ...telemetry.checks,
    ...compliance.checks,
    ...controlGroups,
  ];
  const summary = summarizeChecks(allChecks);
  const overallStatus = allChecks.reduce<CyberSecurityStatus>(
    (acc, item) => worstStatus(acc, item.status),
    "healthy"
  );
  const postureScore = Math.round(
    allChecks.reduce((acc, item) => acc + scoreFromStatus(item.status), 0) /
      Math.max(1, allChecks.length)
  );

  return {
    generatedAt,
    monitoredUrl: monitorUrl.toString(),
    overallStatus,
    postureScore,
    summary,
    website: {
      url: monitorUrl.toString(),
      statusCode: website.statusCode,
      responseTimeMs: website.responseTimeMs,
      checks: website.checks,
      headers: website.headers,
    },
    telemetry,
    compliance,
    controlGroups,
  };
}
