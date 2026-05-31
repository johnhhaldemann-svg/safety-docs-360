import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatTrustedKnowledgeGraphExcerpts,
  retrieveTrustedKnowledgeGraphMemory,
} from "@/lib/aiKnowledgeMap/trustedMemory";
import type {
  TrustedKnowledgeGraphMemoryItem,
  TrustedKnowledgeGraphMemoryMethod,
} from "@/lib/aiKnowledgeMap/types";
import { retrieveMemoryForQuery } from "@/lib/companyMemory/repository";
import type { CompanyMemoryItemRow } from "@/lib/companyMemory/types";
import { serverLog } from "@/lib/serverLog";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export type AiEngineBrainSurface =
  | "gus.verified_answer"
  | "smart_safety.review"
  | "permit.copilot"
  | "document_ai.builder_review"
  | "document_ai.gc_review"
  | "risk.recommendations"
  | "safety_action_queue.sync";

export type AiEngineBrainMethod =
  | TrustedKnowledgeGraphMemoryMethod
  | "approved_graph_with_legacy"
  | "approved_graph_with_fallback_and_legacy"
  | "legacy_only"
  | "none";

export type AiEngineBrainLegacyMemoryItem = {
  id: string;
  company_id: string;
  title: string;
  body: string;
  source: CompanyMemoryItemRow["source"];
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AiEngineBrainResult = {
  surface: AiEngineBrainSurface;
  method: AiEngineBrainMethod;
  items: TrustedKnowledgeGraphMemoryItem[];
  legacyItems: AiEngineBrainLegacyMemoryItem[];
  formattedPromptBlock: string | null;
  provenance: {
    surface: AiEngineBrainSurface;
    companyId: string;
    projectId: string | null;
    jobsiteId: string | null;
    graphMethod: TrustedKnowledgeGraphMemoryMethod;
    legacyMethod: "semantic" | "keyword" | "none" | "skipped";
    graphMemoryCount: number;
    fallbackMemoryCount: number;
    legacyMemoryCount: number;
    trustedOnly: boolean;
  };
  warnings: string[];
  graphMemoryCount: number;
  fallbackMemoryCount: number;
  legacyMemoryCount: number;
  trustedOnly: boolean;
};

type BrainClient = Pick<SupabaseClient, "from"> & Partial<Pick<SupabaseClient, "rpc">>;

function clean(value: unknown, max = 4_000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function isFallbackGraphItem(item: TrustedKnowledgeGraphMemoryItem) {
  return item.id.startsWith("fallback:") || !item.companyId;
}

function toLegacyItem(row: CompanyMemoryItemRow): AiEngineBrainLegacyMemoryItem {
  return {
    id: row.id,
    company_id: row.company_id,
    title: row.title,
    body: row.body,
    source: row.source,
    metadata: row.metadata,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function formatLegacyMemory(items: AiEngineBrainLegacyMemoryItem[], maxItems: number, maxExcerptLength: number) {
  if (items.length === 0) return null;
  return [
    "--- Legacy company memory support (company-scoped supporting context; approved graph memory outranks this; not regulatory proof) ---",
    ...items.slice(0, maxItems).map((item, index) => (
      `[L${index + 1}] (${item.source}) ${clean(item.title, 180)}\n${clean(item.body, maxExcerptLength)}`
    )),
  ].join("\n\n");
}

function resolveMethod(
  graphMethod: TrustedKnowledgeGraphMemoryMethod,
  graphItems: TrustedKnowledgeGraphMemoryItem[],
  legacyCount: number
): AiEngineBrainMethod {
  if (graphItems.length === 0 && legacyCount > 0) return "legacy_only";
  if (graphItems.length === 0) return "none";
  if (legacyCount === 0) return graphMethod;
  if (graphMethod === "approved_graph_with_fallback" || graphItems.some(isFallbackGraphItem)) {
    return "approved_graph_with_fallback_and_legacy";
  }
  return "approved_graph_with_legacy";
}

export async function retrieveAiEngineBrainContext(params: {
  surface: AiEngineBrainSurface;
  companyId: string;
  query: string;
  userClient?: SupabaseClient | null;
  adminClient?: BrainClient | null;
  projectId?: string | null;
  jobsiteId?: string | null;
  topK?: number;
  includeLegacyMemory?: boolean;
  legacyTopK?: number;
  legacyWhenGraphItemCountBelow?: number;
  maxPromptItems?: number;
  maxExcerptLength?: number;
}): Promise<AiEngineBrainResult> {
  const companyId = params.companyId.trim();
  const query = params.query.trim();
  const warnings: string[] = [];
  const topK = Math.min(Math.max(params.topK ?? 6, 1), 12);
  const maxPromptItems = Math.min(Math.max(params.maxPromptItems ?? 5, 1), 8);
  const maxExcerptLength = Math.min(Math.max(params.maxExcerptLength ?? 900, 240), 4_000);
  const graphClient = params.adminClient ?? createSupabaseAdminClient();

  let graph = {
    items: [] as TrustedKnowledgeGraphMemoryItem[],
    method: "none" as TrustedKnowledgeGraphMemoryMethod,
    warnings: [] as string[],
  };

  if (!companyId || !query) {
    warnings.push("AI Engine brain skipped because company or query context was missing.");
  } else if (!graphClient) {
    warnings.push("Approved AI Knowledge Graph unavailable because the server admin client is not configured.");
  } else {
    graph = await retrieveTrustedKnowledgeGraphMemory(graphClient, {
      companyId,
      projectId: params.projectId ?? null,
      jobsiteId: params.jobsiteId ?? null,
      query,
      topK,
    }).catch((error) => ({
      items: [],
      method: "none" as const,
      warnings: [error instanceof Error ? error.message : "Approved AI Knowledge Graph retrieval failed."],
    }));
    warnings.push(...graph.warnings);
  }

  const companySpecificGraphCount = graph.items.filter((item) => !isFallbackGraphItem(item)).length;
  const fallbackMemoryCount = graph.items.filter(isFallbackGraphItem).length;
  const legacyThreshold = Math.max(params.legacyWhenGraphItemCountBelow ?? 2, 0);
  const shouldUseLegacy =
    Boolean(params.includeLegacyMemory) &&
    Boolean(params.userClient) &&
    companySpecificGraphCount < legacyThreshold &&
    Boolean(companyId) &&
    Boolean(query);

  let legacyItems: AiEngineBrainLegacyMemoryItem[] = [];
  let legacyMethod: AiEngineBrainResult["provenance"]["legacyMethod"] = shouldUseLegacy ? "none" : "skipped";
  if (shouldUseLegacy && params.userClient) {
    const legacy = await retrieveMemoryForQuery(params.userClient, companyId, query, {
      topK: Math.min(Math.max(params.legacyTopK ?? 4, 1), 8),
    }).catch((error) => {
      warnings.push(error instanceof Error ? error.message : "Legacy company memory retrieval failed.");
      return { chunks: [] as CompanyMemoryItemRow[], method: "none" as const };
    });
    legacyItems = legacy.chunks.map(toLegacyItem);
    legacyMethod = legacy.method;
  }

  if (companySpecificGraphCount === 0 && fallbackMemoryCount > 0) {
    warnings.push("Only general approved fallback graph guidance matched; do not describe it as company-specific evidence.");
  }
  if (companySpecificGraphCount < legacyThreshold && legacyItems.length > 0) {
    warnings.push("Approved company graph memory is thin; legacy company memory was included as supporting context.");
  }

  const graphBlock = formatTrustedKnowledgeGraphExcerpts(graph.items, {
    maxItems: maxPromptItems,
    maxExcerptLength,
  });
  const legacyBlock = formatLegacyMemory(legacyItems, maxPromptItems, maxExcerptLength);
  const formattedPromptBlock = [graphBlock, legacyBlock].filter(Boolean).join("\n\n") || null;
  const method = resolveMethod(graph.method, graph.items, legacyItems.length);
  const result: AiEngineBrainResult = {
    surface: params.surface,
    method,
    items: graph.items,
    legacyItems,
    formattedPromptBlock,
    provenance: {
      surface: params.surface,
      companyId,
      projectId: params.projectId ?? null,
      jobsiteId: params.jobsiteId ?? null,
      graphMethod: graph.method,
      legacyMethod,
      graphMemoryCount: graph.items.length,
      fallbackMemoryCount,
      legacyMemoryCount: legacyItems.length,
      trustedOnly: true,
    },
    warnings,
    graphMemoryCount: graph.items.length,
    fallbackMemoryCount,
    legacyMemoryCount: legacyItems.length,
    trustedOnly: true,
  };

  serverLog("info", "ai_engine_brain_retrieval", {
    surface: result.surface,
    companyId,
    projectId: result.provenance.projectId,
    jobsiteId: result.provenance.jobsiteId,
    method: result.method,
    graphMemoryCount: result.graphMemoryCount,
    fallbackMemoryCount: result.fallbackMemoryCount,
    legacyMemoryCount: result.legacyMemoryCount,
    warningCount: result.warnings.length,
  });

  return result;
}
