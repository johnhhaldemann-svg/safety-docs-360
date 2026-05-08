const safePredictToWorkspaceRouteMap: Record<string, string> = {
  "/safe-predict": "/dashboard",
  "/safe-predict/jobsites": "/jobsites",
  "/safe-predict/predictive-risk": "/analytics/predictive-model",
  "/safe-predict/risk-mitigation": "/field-id-exchange",
  "/safe-predict/incidents": "/incidents",
  "/safe-predict/observations": "/safety-submit",
  "/safe-predict/corrective-actions": "/field-id-exchange",
  "/safe-predict/inspections": "/field-audits",
  "/safe-predict/hazards": "/safety-intelligence",
  "/safe-predict/workforce": "/company-users",
  "/safe-predict/training": "/training-matrix",
  "/safe-predict/permits": "/permits",
  "/safe-predict/analytics": "/analytics",
  "/safe-predict/reports": "/reports",
  "/safe-predict/platform-actions": "/command-center",
  "/safe-predict/settings": "/settings/risk-memory",
};

function splitHref(href: string) {
  const [pathAndQuery, hash = ""] = href.split("#");
  const [path, query = ""] = pathAndQuery.split("?");
  return { path: path || "/", query, hash };
}

function appendContext(route: string, query: string, hash: string) {
  const params = new URLSearchParams(query);
  const context = params.get("jobsiteId") || params.get("siteId");
  const nextQuery = context ? `?jobsiteId=${encodeURIComponent(context)}` : "";
  const nextHash = hash ? `#${hash}` : "";
  return `${route}${nextQuery}${nextHash}`;
}

export function mapSafePredictOperationHref(href: string) {
  const { path, query, hash } = splitHref(href);

  const jobsiteMatch = path.match(/^\/safe-predict\/jobsites\/([^/]+)/);
  if (jobsiteMatch?.[1]) {
    return appendContext(`/jobsites/${encodeURIComponent(decodeURIComponent(jobsiteMatch[1]))}/overview`, query, hash);
  }

  const direct = safePredictToWorkspaceRouteMap[path];
  if (direct) {
    return appendContext(direct, query, hash);
  }

  return href;
}

export function isLegacyOperationHref(href: string) {
  return mapSafePredictOperationHref(href) !== href;
}
