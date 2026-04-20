import type { SupabaseClient } from "@supabase/supabase-js";
import { loadMergedTradeLibrary } from "@/lib/safety-intelligence/library";
import type {
  RulesEvaluation,
  SafetyPlanGenerationContext,
  SafetyPlanTrainingProgram,
  SafetyPlanTrainingProgramRow,
  TaskTemplateDefinition,
  TradeLibraryEntry,
} from "@/types/safety-intelligence";

type LiteClient = SupabaseClient<any, "public", any>;

const GENERATED_SOURCE_TYPE = "csep_training_program";
const GENERATED_SORT_ORDER_BASE = 10000;

const TRAINING_CODE_LABELS: Record<string, { title: string; keywords?: string[] }> = {
  competent_person_excavation: {
    title: "Competent person excavation",
    keywords: ["Competent Person Excavation", "Competent Person", "Excavation competent person"],
  },
  qualified_electrical_worker: {
    title: "Qualified electrical worker",
    keywords: ["Qualified Electrical Worker", "Qualified Electrical Person"],
  },
  nfpa70e: {
    title: "NFPA 70E",
    keywords: ["NFPA 70E", "Arc Flash", "Electrical Safety"],
  },
  hot_work_training: {
    title: "Hot work training",
    keywords: ["Hot Work", "Hot Work Training", "Welding Hot Work"],
  },
  qualified_rigger: {
    title: "Qualified rigger",
    keywords: ["Qualified Rigger", "Rigging"],
  },
  signal_person_training: {
    title: "Signal person training",
    keywords: ["Signal Person", "Signal Person Training"],
  },
  scaffold_user_training: {
    title: "Scaffold user training",
    keywords: ["Scaffold User", "Scaffold Training"],
  },
  hazcom: {
    title: "Hazard communication",
    keywords: ["HazCom", "Hazard Communication"],
  },
  respiratory_protection: {
    title: "Respiratory protection",
    keywords: ["Respiratory Protection", "Respirator"],
  },
};

function dedupe(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeForMatch(value: string) {
  return value.trim().toLowerCase();
}

function humanizeCode(code: string) {
  const acronyms: Record<string, string> = {
    osha: "OSHA",
    nfpa: "NFPA",
    jsa: "JSA",
    ppe: "PPE",
    loto: "LOTO",
    hazcom: "HazCom",
  };

  return code
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .map((part) => {
      const normalized = part.toLowerCase();
      if (acronyms[normalized]) return acronyms[normalized];
      if (/^\d+[a-z]*$/i.test(part)) return part.toUpperCase();
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    })
    .join(" ");
}

function resolveTrainingPresentation(code: string) {
  const normalizedCode = slugify(code);
  const config = TRAINING_CODE_LABELS[normalizedCode];
  const title = config?.title ?? humanizeCode(code);
  const keywords = dedupe([title, ...(config?.keywords ?? []), humanizeCode(code)]);

  return {
    trainingCode: normalizedCode || slugify(title),
    trainingTitle: title,
    matchKeywords: keywords,
  };
}

function findMatchingTrade(
  library: TradeLibraryEntry[],
  operation: SafetyPlanGenerationContext["operations"][number]
) {
  const tradeCode = normalizeForMatch(operation.tradeCode ?? "");
  const tradeLabel = normalizeForMatch(operation.tradeLabel ?? "");

  return (
    library.find((trade) => normalizeForMatch(trade.code) === tradeCode) ??
    library.find((trade) => normalizeForMatch(trade.name) === tradeLabel) ??
    library.find((trade) => slugify(trade.name) === tradeCode)
  );
}

function scoreTaskTemplateMatch(
  taskTemplate: TaskTemplateDefinition,
  operation: SafetyPlanGenerationContext["operations"][number]
) {
  const taskCode = normalizeForMatch(operation.taskCode ?? "");
  const taskSlug = slugify(operation.taskTitle);
  const templateCode = normalizeForMatch(taskTemplate.code);
  const templateName = normalizeForMatch(taskTemplate.name);
  const templateSlug = slugify(taskTemplate.name);

  if (taskCode && templateCode === taskCode) return 100;
  if (taskCode && templateSlug === taskCode) return 95;
  if (templateCode === taskSlug) return 90;
  if (templateSlug === taskSlug) return 85;
  if (templateName === normalizeForMatch(operation.taskTitle)) return 80;
  if (templateName.includes(normalizeForMatch(operation.taskTitle))) return 60;
  if (normalizeForMatch(operation.taskTitle).includes(templateName)) return 55;
  return 0;
}

function findMatchingTaskTemplate(
  trade: TradeLibraryEntry | undefined,
  operation: SafetyPlanGenerationContext["operations"][number]
) {
  if (!trade) return null;

  let bestMatch: TaskTemplateDefinition | null = null;
  let bestScore = 0;

  for (const taskTemplate of trade.taskTemplates) {
    const score = scoreTaskTemplateMatch(taskTemplate, operation);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = taskTemplate;
    }
  }

  return bestScore > 0 ? bestMatch : null;
}

function buildTrainingRequirementTitle(row: SafetyPlanTrainingProgramRow) {
  const scopeParts = [
    row.tradeLabel?.trim() ?? "",
    row.subTradeLabel?.trim() ?? "",
    row.taskTitle.trim(),
  ].filter(Boolean);

  return scopeParts.length > 0
    ? `${row.trainingTitle} (${scopeParts.join(" / ")})`
    : row.trainingTitle;
}

export async function deriveCsepTrainingProgram(params: {
  supabase: LiteClient;
  companyId: string;
  generationContext: SafetyPlanGenerationContext;
  rulesEvaluations: RulesEvaluation[];
}): Promise<SafetyPlanTrainingProgram> {
  if (params.generationContext.documentProfile.documentType !== "csep") {
    return { rows: [], summaryTrainingTitles: [] };
  }

  const library = await loadMergedTradeLibrary(params.supabase, params.companyId);
  const rowsByKey = new Map<string, SafetyPlanTrainingProgramRow>();

  for (const operation of params.generationContext.operations) {
    const trade = findMatchingTrade(library, operation);
    const taskTemplate = findMatchingTaskTemplate(trade ?? undefined, operation);
    const ruleEvaluation =
      params.rulesEvaluations.find((row) => row.operationId === operation.operationId) ?? null;

    const taskTemplateTraining = taskTemplate?.trainingRequirements ?? [];
    const tradeDefaultTraining =
      taskTemplateTraining.length === 0 ? trade?.trainingRequirements ?? [] : [];

    const sourceEntries: Array<{ code: string; sourceLabel: string }> = [
      ...taskTemplateTraining.map((code) => ({ code, sourceLabel: "Task template" })),
      ...tradeDefaultTraining.map((code) => ({ code, sourceLabel: "Trade default" })),
      ...(ruleEvaluation?.trainingRequirements ?? []).map((code) => ({
        code,
        sourceLabel: "Rule evaluation",
      })),
    ];

    const mergedByTrainingCode = new Map<
      string,
      { presentation: ReturnType<typeof resolveTrainingPresentation>; sourceLabels: string[] }
    >();

    for (const entry of sourceEntries) {
      const presentation = resolveTrainingPresentation(entry.code);
      const existing = mergedByTrainingCode.get(presentation.trainingCode);
      if (existing) {
        existing.sourceLabels = dedupe([...existing.sourceLabels, entry.sourceLabel]);
        continue;
      }
      mergedByTrainingCode.set(presentation.trainingCode, {
        presentation,
        sourceLabels: [entry.sourceLabel],
      });
    }

    for (const { presentation, sourceLabels } of mergedByTrainingCode.values()) {
      const rowKey = [
        operation.tradeCode ?? operation.tradeLabel ?? "",
        operation.subTradeCode ?? operation.subTradeLabel ?? "",
        operation.taskCode ?? slugify(operation.taskTitle),
        presentation.trainingCode,
      ].join("|");

      rowsByKey.set(rowKey, {
        operationId: operation.operationId,
        tradeCode: operation.tradeCode ?? null,
        tradeLabel: operation.tradeLabel ?? null,
        subTradeCode: operation.subTradeCode ?? null,
        subTradeLabel: operation.subTradeLabel ?? null,
        taskCode: operation.taskCode ?? slugify(operation.taskTitle),
        taskTitle: operation.taskTitle,
        trainingCode: presentation.trainingCode,
        trainingTitle: presentation.trainingTitle,
        matchKeywords: presentation.matchKeywords,
        sourceLabels,
        whySource: sourceLabels.join(", "),
      });
    }
  }

  const rows = [...rowsByKey.values()].sort((left, right) => {
    return (
      (left.tradeLabel ?? "").localeCompare(right.tradeLabel ?? "") ||
      (left.subTradeLabel ?? "").localeCompare(right.subTradeLabel ?? "") ||
      left.taskTitle.localeCompare(right.taskTitle) ||
      left.trainingTitle.localeCompare(right.trainingTitle)
    );
  });

  return {
    rows,
    summaryTrainingTitles: dedupe(rows.map((row) => row.trainingTitle)),
  };
}

export async function syncGeneratedTrainingRequirements(params: {
  supabase: LiteClient;
  companyId: string;
  sourceDocumentId: string;
  trainingProgram: SafetyPlanTrainingProgram;
  actorUserId: string;
}) {
  const deleteExisting = await params.supabase
    .from("company_training_requirements")
    .delete()
    .eq("company_id", params.companyId)
    .eq("is_generated", true)
    .eq("generated_source_type", GENERATED_SOURCE_TYPE)
    .eq("generated_source_document_id", params.sourceDocumentId);

  if (deleteExisting.error) {
    throw new Error(
      deleteExisting.error.message || "Failed to clear generated training requirements."
    );
  }

  if (params.trainingProgram.rows.length === 0) {
    return { insertedCount: 0 };
  }

  const nowIso = new Date().toISOString();
  const insertRows = params.trainingProgram.rows.map((row, index) => ({
    company_id: params.companyId,
    title: buildTrainingRequirementTitle(row),
    sort_order: GENERATED_SORT_ORDER_BASE + index,
    match_keywords: row.matchKeywords,
    match_fields: ["certifications"],
    apply_trades: row.tradeLabel ? [row.tradeLabel] : [],
    apply_positions: [],
    apply_sub_trades: row.subTradeLabel ? [row.subTradeLabel] : [],
    apply_task_codes: row.taskCode ? [row.taskCode] : [],
    renewal_months: null,
    is_generated: true,
    generated_source_type: GENERATED_SOURCE_TYPE,
    generated_source_document_id: params.sourceDocumentId,
    generated_source_operation_key: `${row.operationId}:${row.trainingCode}`,
    created_at: nowIso,
    updated_at: nowIso,
    created_by: params.actorUserId,
    updated_by: params.actorUserId,
  }));

  const insertResult = await params.supabase
    .from("company_training_requirements")
    .insert(insertRows)
    .select("id");

  if (insertResult.error) {
    throw new Error(
      insertResult.error.message || "Failed to sync generated training requirements."
    );
  }

  return { insertedCount: insertResult.data?.length ?? insertRows.length };
}
