import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = Pick<SupabaseClient, "from">;
type DbError = { message?: string | null };
type QueryResult<T> = { data: T | null; error: DbError | null };

function envFlag(name: string) {
  return String(process.env[name] ?? "").trim().toLowerCase() === "true";
}

export function requireConcreteCompanyId(companyId: string | null | undefined) {
  const value = typeof companyId === "string" ? companyId.trim() : "";
  if (!value || value === "all") throw new Error("Select one company before changing AI Knowledge memory.");
  return value;
}

export function assertAiKnowledgeWritesEnabled(action: string) {
  if (envFlag("AI_KNOWLEDGE_WRITES_DISABLED")) {
    throw new Error(`${action} is disabled by the AI Knowledge write guardrail.`);
  }
}

export function isAiKnowledgeEmbeddingDisabled() {
  return envFlag("AI_KNOWLEDGE_EMBEDDINGS_DISABLED");
}

export function isAiKnowledgeSourceFetchDisabled() {
  return envFlag("AI_KNOWLEDGE_SOURCE_FETCH_DISABLED");
}

export function hasMeaningfulReviewReason(reason: string | null | undefined) {
  return typeof reason === "string" && reason.trim().replace(/\s+/g, " ").length >= 8;
}

export async function assertActiveKnowledgeCompany(client: DbClient, companyId: string) {
  const query = client
    .from("companies")
    .select("id,status,is_active")
    .eq("id", companyId)
    .limit(1);
  const result = typeof (query as { maybeSingle?: unknown }).maybeSingle === "function"
    ? await (query as unknown as { maybeSingle: () => Promise<QueryResult<Record<string, unknown>>> }).maybeSingle()
    : await query as QueryResult<Array<Record<string, unknown>>>;
  const error = result.error;
  if (error) throw new Error(error.message ?? "Could not validate company for AI Knowledge memory.");
  const data = result.data;
  const company = Array.isArray(data) ? data[0] : data;
  if (!company) throw new Error("Company was not found for AI Knowledge memory.");
  if (company.is_active === false) throw new Error("AI Knowledge memory cannot be changed for an inactive company.");
  const status = String(company.status ?? "active").toLowerCase();
  if (status && !["active", "approved"].includes(status)) throw new Error("AI Knowledge memory cannot be changed for an inactive or archived company.");
  return String(company.id ?? companyId);
}

export async function assertAiKnowledgeCooldown(
  client: DbClient,
  input: { companyId: string; eventType: string; cooldownMinutes: number; action: string },
) {
  if (envFlag("AI_KNOWLEDGE_COOLDOWN_DISABLED")) return;
  const { data, error } = (await client
    .from("ai_engine_events")
    .select("created_at,company_id,metadata")
    .eq("event_type", input.eventType)
    .order("created_at", { ascending: false })
    .limit(10)) as QueryResult<Array<Record<string, unknown>>>;
  if (error) return;
  const cutoff = Date.now() - input.cooldownMinutes * 60_000;
  const recent = (data ?? []).some((row) => {
    const rowCompany = typeof row.company_id === "string" ? row.company_id : typeof (row.metadata as Record<string, unknown> | undefined)?.companyId === "string" ? String((row.metadata as Record<string, unknown>).companyId) : null;
    const createdAt = Date.parse(String(row.created_at ?? ""));
    return rowCompany === input.companyId && Number.isFinite(createdAt) && createdAt >= cutoff;
  });
  if (recent) throw new Error(`${input.action} already ran recently. Wait ${input.cooldownMinutes} minutes or use a controlled manual review flow.`);
}
