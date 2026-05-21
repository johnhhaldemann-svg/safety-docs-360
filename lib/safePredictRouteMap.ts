const nativeOperationRouteMap: Record<string, string> = {
  "/command-center": "/safe-predict",
  "/jobsites": "/safe-predict/jobsites",
  "/audit-customers": "/safe-predict/jobsites",
  "/field-id-exchange": "/safe-predict/corrective-actions",
  "/field-audits": "/safe-predict/inspections",
  "/safety-submit": "/safe-predict/observations",
  "/safety-intelligence": "/safe-predict/hazards",
  "/analytics": "/safe-predict/analytics",
  "/analytics/predictive-model": "/safe-predict/predictive-risk",
  "/analytics/safety-intelligence": "/safe-predict/analytics",
  "/incidents": "/safe-predict/incidents",
  "/documents": "/safe-predict/documents",
  "/reports": "/safe-predict/reports",
  "/csep": "/safe-predict/csep",
  "/peshep": "/safe-predict/peshep",
  "/training": "/safe-predict/training",
  "/company-inductions": "/safe-predict/training",
  "/company-safety-forms": "/safe-predict/inspections",
  "/permits": "/safe-predict/permits",
  "/jsa": "/safe-predict/permits",
  "/search": "/safe-predict/reports",
  "/submit": "/safe-predict/reports",
  "/upload": "/safe-predict/reports",
  "/marketplace-preview-approvals": "/safe-predict/reports",
  "/settings/risk-memory": "/safe-predict/settings",
};

const nativeSurfaceRouteMap: Record<string, string> = {
  "/company-integrations": "/safe-predict/apps-integrations",
  "/company-users": "/safe-predict/team-access",
  "/permits": "/safe-predict/permit-center",
};

const nativeJobsiteWorkspaceSegments = new Set<string>();

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

function appendQueryAndHash(route: string, query: string, hash: string) {
  const nextQuery = query ? `?${query}` : "";
  const nextHash = hash ? `#${hash}` : "";
  return `${route}${nextQuery}${nextHash}`;
}

function mapLegacyDocumentLibrary(query: string, hash: string) {
  const params = new URLSearchParams(query);
  const tab = params.get("tab")?.trim().toLowerCase() ?? "";

  if (!tab || tab === "documents") {
    params.delete("tab");
  } else if (tab === "templates" || tab === "marketplace") {
    params.set("tab", tab);
  } else {
    params.delete("tab");
  }

  return appendQueryAndHash("/safe-predict/documents", params.toString(), hash);
}

export function mapSafePredictOperationHref(href: string) {
  const { path, query, hash } = splitHref(href);

  if (path === "/safe-predict" || path.startsWith("/safe-predict/")) {
    return href;
  }

  if (path === "/library") {
    const mappedLibraryHref = mapLegacyDocumentLibrary(query, hash);
    if (mappedLibraryHref) {
      return mappedLibraryHref;
    }
  }

  const direct = nativeOperationRouteMap[path];
  if (direct) {
    return appendContext(direct, query, hash);
  }

  const nativeJobsiteWorkspaceMatch = path.match(/^\/jobsites\/[^/]+\/([^/]+)/);
  if (nativeJobsiteWorkspaceMatch?.[1] && nativeJobsiteWorkspaceSegments.has(nativeJobsiteWorkspaceMatch[1])) {
    return href;
  }

  const jobsiteMatch = path.match(/^\/jobsites\/([^/]+)/);
  if (jobsiteMatch?.[1]) {
    return appendContext(`/safe-predict/jobsites/${encodeURIComponent(decodeURIComponent(jobsiteMatch[1]))}`, query, hash);
  }

  return href;
}

export function mapSafePredictSurfaceHref(href: string) {
  const { path, query, hash } = splitHref(href);
  const direct = nativeSurfaceRouteMap[path];
  if (direct) {
    return appendQueryAndHash(direct, query, hash);
  }

  const operationHref = mapSafePredictOperationHref(href);
  if (operationHref !== href) {
    return operationHref;
  }

  return href;
}

export function isLegacyOperationHref(href: string) {
  return mapSafePredictOperationHref(href) !== href;
}
