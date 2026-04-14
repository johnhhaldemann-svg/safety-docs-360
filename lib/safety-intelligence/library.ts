import type { SupabaseClient } from "@supabase/supabase-js";
import type { TradeLibraryEntry } from "@/types/safety-intelligence";

type LiteClient = SupabaseClient<any, "public", any>;

export async function loadMergedTradeLibrary(
  supabase: LiteClient,
  companyId: string
): Promise<TradeLibraryEntry[]> {
  const [{ data: platformTrades }, { data: platformTasks }, { data: companyTrades }] = await Promise.all([
    supabase.from("platform_trades").select("id, code, name, description, metadata"),
    supabase
      .from("platform_task_templates")
      .select("trade_id, code, name, equipment_used, work_conditions, hazard_families, required_controls, permit_triggers, training_requirements, weather_sensitivity, metadata"),
    supabase
      .from("company_trades")
      .select("id, code, name, description, hazard_families, required_controls, permit_triggers, training_requirements, metadata")
      .eq("company_id", companyId),
  ]);

  const platformById = new Map<string, TradeLibraryEntry>();
  for (const row of (platformTrades ?? []) as Array<Record<string, unknown>>) {
    platformById.set(String(row.id), {
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      description: String(row.description ?? "") || null,
      subTrades: [],
      taskTemplates: [],
      equipmentUsed: [],
      workConditions: [],
      hazardFamilies: [],
      requiredControls: [],
      permitTriggers: [],
      trainingRequirements: [],
      metadata: (row.metadata ?? {}) as TradeLibraryEntry["metadata"],
    });
  }

  for (const row of (platformTasks ?? []) as Array<Record<string, unknown>>) {
    const trade = platformById.get(String(row.trade_id ?? ""));
    if (!trade) continue;
    trade.taskTemplates.push({
      code: String(row.code),
      name: String(row.name),
      equipmentUsed: (row.equipment_used ?? []) as string[],
      workConditions: (row.work_conditions ?? []) as string[],
      hazardFamilies: (row.hazard_families ?? []) as TradeLibraryEntry["hazardFamilies"],
      requiredControls: (row.required_controls ?? []) as string[],
      permitTriggers: (row.permit_triggers ?? []) as TradeLibraryEntry["permitTriggers"],
      trainingRequirements: (row.training_requirements ?? []) as string[],
      weatherSensitivity: String(row.weather_sensitivity ?? "medium") as TradeLibraryEntry["taskTemplates"][number]["weatherSensitivity"],
      metadata: (row.metadata ?? {}) as TradeLibraryEntry["taskTemplates"][number]["metadata"],
    });
  }

  const merged = [...platformById.values()];
  for (const row of (companyTrades ?? []) as Array<Record<string, unknown>>) {
    merged.push({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      description: String(row.description ?? "") || null,
      subTrades: [],
      taskTemplates: [],
      equipmentUsed: [],
      workConditions: [],
      hazardFamilies: (row.hazard_families ?? []) as TradeLibraryEntry["hazardFamilies"],
      requiredControls: (row.required_controls ?? []) as string[],
      permitTriggers: (row.permit_triggers ?? []) as TradeLibraryEntry["permitTriggers"],
      trainingRequirements: (row.training_requirements ?? []) as string[],
      metadata: (row.metadata ?? {}) as TradeLibraryEntry["metadata"],
    });
  }

  return merged.sort((a, b) => a.name.localeCompare(b.name));
}

