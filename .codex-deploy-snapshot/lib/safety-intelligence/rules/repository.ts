import type { SupabaseClient } from "@supabase/supabase-js";
import type { RuleTemplateRecord } from "@/types/safety-intelligence";

type LiteClient = SupabaseClient<any, "public", any>;

function mapRuleRow(
  row: Record<string, unknown>,
  sourceType: RuleTemplateRecord["sourceType"]
): RuleTemplateRecord {
  return {
    id: String(row.id ?? ""),
    code: String(row.code ?? row.rule_code ?? "rule"),
    label: String(row.label ?? row.name ?? row.code ?? "Rule"),
    sourceType,
    sourceId: row.company_id ? String(row.company_id) : row.jobsite_id ? String(row.jobsite_id) : null,
    precedence: Number(row.precedence ?? 100),
    version: String(row.version ?? "v1"),
    mergeBehavior: String(row.merge_behavior ?? "extend") as RuleTemplateRecord["mergeBehavior"],
    selectors: (row.selectors ?? {}) as RuleTemplateRecord["selectors"],
    outputs: (row.outputs ?? {}) as RuleTemplateRecord["outputs"],
    metadata: (row.metadata ?? {}) as RuleTemplateRecord["metadata"],
  };
}

async function loadRuleRows(
  supabase: LiteClient,
  table: string,
  filters: Array<[string, string | null | undefined]>,
  sourceType: RuleTemplateRecord["sourceType"]
) {
  let query = supabase
    .from(table)
    .select("id, code, label, precedence, version, merge_behavior, selectors, outputs, metadata, company_id, jobsite_id")
    .eq("active", true);

  for (const [column, value] of filters) {
    if (value) {
      query = query.eq(column, value);
    }
  }

  const result = await query.order("precedence", { ascending: true });
  if (result.error) {
    return [];
  }

  return (result.data ?? []).map((row) => mapRuleRow(row as Record<string, unknown>, sourceType));
}

export async function loadDbRuleTemplates(params: {
  supabase: LiteClient;
  companyId: string;
  jobsiteId?: string | null;
}) {
  const [platformRules, companyRules, jobsiteRules] = await Promise.all([
    loadRuleRows(params.supabase, "platform_rule_templates", [], "platform"),
    loadRuleRows(params.supabase, "company_rule_overrides", [["company_id", params.companyId]], "company"),
    params.jobsiteId
      ? loadRuleRows(
          params.supabase,
          "jobsite_rule_overrides",
          [
            ["company_id", params.companyId],
            ["jobsite_id", params.jobsiteId],
          ],
          "jobsite"
        )
      : Promise.resolve([]),
  ]);

  return [...platformRules, ...companyRules, ...jobsiteRules];
}
