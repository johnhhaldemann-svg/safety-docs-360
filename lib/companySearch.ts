import type {
  WorkspaceSearchFacets,
  WorkspaceSearchResult,
  WorkspaceSearchResultType,
} from "@/types/product-depth";

type SearchableField = {
  label: string;
  value: unknown;
};

export type SearchResultInput = {
  id: string;
  type: WorkspaceSearchResultType;
  title?: unknown;
  subtitle?: unknown;
  status?: unknown;
  updatedAt?: unknown;
  href: string;
  jobsiteId?: unknown;
  jobsiteName?: unknown;
  sourceTable: string;
  fields: SearchableField[];
};

export function normalizeSearchQuery(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function asText(value: unknown) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "object") return "";
  return String(value).trim();
}

function nullableText(value: unknown) {
  const text = asText(value);
  return text || null;
}

export function getMatchedFields(fields: SearchableField[], query: string) {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) {
    return [];
  }

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const labels = new Set<string>();

  for (const field of fields) {
    const haystack = asText(field.value).toLowerCase();
    if (!haystack) continue;
    if (tokens.every((token) => haystack.includes(token)) || haystack.includes(normalizedQuery)) {
      labels.add(field.label);
    }
  }

  return [...labels];
}

export function buildWorkspaceSearchResult(input: SearchResultInput, query: string): WorkspaceSearchResult {
  return {
    id: input.id,
    type: input.type,
    title: asText(input.title) || "Untitled",
    subtitle: nullableText(input.subtitle),
    status: nullableText(input.status),
    updatedAt: nullableText(input.updatedAt),
    href: input.href,
    jobsiteName: nullableText(input.jobsiteName),
    matchedFields: getMatchedFields(input.fields, query),
    sourceTable: input.sourceTable,
  };
}

export function resultMatchesQuery(input: SearchResultInput, query: string) {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return true;
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const haystack = [
    input.title,
    input.subtitle,
    input.status,
    input.jobsiteName,
    ...input.fields.map((field) => field.value),
  ]
    .map(asText)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return tokens.every((token) => haystack.includes(token));
}

export function filterSearchResults(params: {
  inputs: SearchResultInput[];
  query: string;
  types: Set<string>;
  limit: number;
}) {
  const results = params.inputs
    .filter((input) => params.types.size === 0 || params.types.has(input.type))
    .filter((input) => resultMatchesQuery(input, params.query))
    .map((input) => buildWorkspaceSearchResult(input, params.query))
    .sort((a, b) => {
      const left = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const right = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return right - left;
    });

  return results.slice(0, Math.max(1, Math.min(params.limit, 100)));
}

export function buildSearchFacets(results: WorkspaceSearchResult[], query: string): WorkspaceSearchFacets {
  const typeCounts = {} as WorkspaceSearchFacets["typeCounts"];
  const jobsiteCounts: Record<string, number> = {};

  for (const result of results) {
    typeCounts[result.type] = (typeCounts[result.type] ?? 0) + 1;
    if (result.jobsiteName) {
      jobsiteCounts[result.jobsiteName] = (jobsiteCounts[result.jobsiteName] ?? 0) + 1;
    }
  }

  return {
    typeCounts,
    jobsiteCounts,
    total: results.length,
    query: normalizeSearchQuery(query),
  };
}

