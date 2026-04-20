import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_JURISDICTION_STANDARDS_CONFIG,
  mergeJurisdictionStandardsConfig,
  normalizeJurisdictionStandardsConfig,
} from "@/lib/jurisdictionStandards/catalog";
import { getSupabaseServerUrl, getSupabaseServiceRoleKey } from "@/lib/supabaseAdmin";
import type {
  JurisdictionCode,
  JurisdictionPlanType,
  JurisdictionStandardMappingType,
  JurisdictionStandardType,
  JurisdictionSurfaceScope,
  JurisdictionStandardOverride,
  JurisdictionStandardsConfig,
} from "@/types/jurisdiction-standards";

type MessageError = { message?: string | null };
type SupabaseLikeClient = {
  from: (table: string) => unknown;
};

function isMissingJurisdictionTablesError(error?: { message?: string | null } | null) {
  const message = (error?.message ?? "").toLowerCase();
  if (!message) return false;
  return (
    (message.includes("platform_jurisdictions") ||
      message.includes("platform_jurisdiction_standards") ||
      message.includes("platform_jurisdiction_standard_mappings") ||
      message.includes("platform_jurisdiction_standard_overrides")) &&
    (message.includes("does not exist") ||
      message.includes("schema cache") ||
      message.includes("relation") ||
      message.includes("column"))
  );
}

export async function getJurisdictionStandardsServiceRoleClient() {
  const supabaseUrl = getSupabaseServerUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service role configuration.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

async function loadTable(
  client: SupabaseLikeClient,
  table: string,
  columns: string,
  orderColumn: string
) {
  return (
    client.from(table) as {
      select: (query: string) => {
        order: (
          column: string,
          options?: Record<string, unknown>
        ) => PromiseLike<{ data: unknown; error: MessageError | null }>;
      };
    }
  )
    .select(columns)
    .order(orderColumn);
}

export async function getJurisdictionStandardsConfig(supabase?: SupabaseLikeClient) {
  const client = supabase ?? (await getJurisdictionStandardsServiceRoleClient());

  const [jurisdictionsResult, standardsResult, mappingsResult, overridesResult] = await Promise.all([
    loadTable(
      client,
      "platform_jurisdictions",
      "code, state_code, display_name, plan_type, covers_private_sector, source_url, source_title, source_authority, effective_date, last_reviewed_date, metadata",
      "display_name"
    ),
    loadTable(
      client,
      "platform_jurisdiction_standards",
      "id, jurisdiction_code, surface_scope, standard_type, title, summary, applicability, content, source_url, source_title, source_authority, effective_date, last_reviewed_date, metadata",
      "title"
    ),
    loadTable(
      client,
      "platform_jurisdiction_standard_mappings",
      "id, standard_id, mapping_type, mapping_key, metadata",
      "id"
    ),
    loadTable(
      client,
      "platform_jurisdiction_standard_overrides",
      "standard_id, title, summary, applicability, content, effective_date, last_reviewed_date, metadata",
      "standard_id"
    ),
  ]);

  const firstError =
    jurisdictionsResult.error ??
    standardsResult.error ??
    mappingsResult.error ??
    overridesResult.error;

  if (firstError) {
    if (isMissingJurisdictionTablesError(firstError)) {
      return DEFAULT_JURISDICTION_STANDARDS_CONFIG;
    }
    throw new Error(firstError.message ?? "Failed to load jurisdiction standards.");
  }

  const base = normalizeJurisdictionStandardsConfig({
    jurisdictions: ((jurisdictionsResult.data as Array<Record<string, unknown>> | null) ?? []).map(
      (row) => ({
        code: String(row.code ?? "").trim() as JurisdictionCode,
        stateCode:
          typeof row.state_code === "string" && row.state_code.trim()
            ? row.state_code.trim()
            : null,
        displayName: String(row.display_name ?? "").trim(),
        planType: String(row.plan_type ?? "").trim() as JurisdictionPlanType,
        coversPrivateSector: row.covers_private_sector !== false,
        sourceUrl: String(row.source_url ?? "").trim(),
        sourceTitle: String(row.source_title ?? "").trim(),
        sourceAuthority: String(row.source_authority ?? "").trim(),
        effectiveDate:
          typeof row.effective_date === "string" && row.effective_date.trim()
            ? row.effective_date
            : null,
        lastReviewedDate: String(row.last_reviewed_date ?? "").trim(),
        metadata:
          row.metadata && typeof row.metadata === "object"
            ? (row.metadata as Record<string, unknown>)
            : {},
      })
    ),
    standards: ((standardsResult.data as Array<Record<string, unknown>> | null) ?? []).map(
      (row) => ({
        id: String(row.id ?? "").trim(),
        jurisdictionCode: String(row.jurisdiction_code ?? "").trim() as JurisdictionCode,
        surfaceScope: String(row.surface_scope ?? "").trim() as JurisdictionSurfaceScope,
        standardType: String(row.standard_type ?? "").trim() as JurisdictionStandardType,
        title: String(row.title ?? "").trim(),
        summary: String(row.summary ?? "").trim(),
        applicability:
          row.applicability && typeof row.applicability === "object"
            ? (row.applicability as Record<string, unknown>)
            : {},
        content:
          row.content && typeof row.content === "object"
            ? (row.content as Record<string, unknown>)
            : {},
        sourceUrl: String(row.source_url ?? "").trim(),
        sourceTitle: String(row.source_title ?? "").trim(),
        sourceAuthority: String(row.source_authority ?? "").trim(),
        effectiveDate:
          typeof row.effective_date === "string" && row.effective_date.trim()
            ? row.effective_date
            : null,
        lastReviewedDate: String(row.last_reviewed_date ?? "").trim(),
        metadata:
          row.metadata && typeof row.metadata === "object"
            ? (row.metadata as Record<string, unknown>)
            : {},
      })
    ),
    mappings: ((mappingsResult.data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
      id: String(row.id ?? "").trim(),
      standardId: String(row.standard_id ?? "").trim(),
      mappingType: String(row.mapping_type ?? "").trim() as JurisdictionStandardMappingType,
      mappingKey: String(row.mapping_key ?? "").trim(),
      metadata:
        row.metadata && typeof row.metadata === "object"
          ? (row.metadata as Record<string, unknown>)
          : {},
    })),
  });

  const overrides = ((overridesResult.data as Array<Record<string, unknown>> | null) ?? []).map(
    (row) =>
      ({
        standardId: String(row.standard_id ?? "").trim(),
        title: typeof row.title === "string" ? row.title : null,
        summary: typeof row.summary === "string" ? row.summary : null,
        applicability:
          row.applicability && typeof row.applicability === "object"
            ? (row.applicability as Record<string, unknown>)
            : null,
        content:
          row.content && typeof row.content === "object"
            ? (row.content as Record<string, unknown>)
            : null,
        effectiveDate:
          typeof row.effective_date === "string" && row.effective_date.trim()
            ? row.effective_date
            : null,
        lastReviewedDate:
          typeof row.last_reviewed_date === "string" && row.last_reviewed_date.trim()
            ? row.last_reviewed_date
            : null,
        metadata:
          row.metadata && typeof row.metadata === "object"
            ? (row.metadata as Record<string, unknown>)
            : null,
      }) satisfies JurisdictionStandardOverride
  );

  return mergeJurisdictionStandardsConfig({ base, overrides });
}

export async function saveJurisdictionStandardsOverride(params: {
  supabase: SupabaseLikeClient;
  actorUserId: string;
  overrides: JurisdictionStandardOverride[];
}) {
  const rows = params.overrides.map((override) => ({
    standard_id: override.standardId,
    title: override.title ?? null,
    summary: override.summary ?? null,
    applicability: override.applicability ?? {},
    content: override.content ?? {},
    effective_date: override.effectiveDate ?? null,
    last_reviewed_date: override.lastReviewedDate ?? null,
    metadata: override.metadata ?? {},
    updated_at: new Date().toISOString(),
    updated_by: params.actorUserId,
  }));

  const result = await (
    params.supabase.from("platform_jurisdiction_standard_overrides") as unknown as {
      upsert: (
        values: Record<string, unknown>[],
        options?: Record<string, unknown>
      ) => PromiseLike<{ error: MessageError | null }>;
    }
  ).upsert(rows, { onConflict: "standard_id" });

  if (isMissingJurisdictionTablesError(result.error)) {
    return {
      data: null,
      error: new Error(
        "The jurisdiction standards tables are missing. Apply the latest Supabase migrations before saving overrides."
      ),
    };
  }

  return {
    data: rows,
    error: result.error,
  };
}

export async function saveJurisdictionStandardsConfig(params: {
  supabase: SupabaseLikeClient;
  actorUserId: string;
  config: JurisdictionStandardsConfig;
}) {
  const normalized = normalizeJurisdictionStandardsConfig(params.config);
  const standardIds = normalized.standards.map((standard) => standard.id);

  if (standardIds.length > 0) {
    const deleteResult = await (
      params.supabase.from("platform_jurisdiction_standard_mappings") as unknown as {
        delete: () => {
          in: (
            column: string,
            values: string[]
          ) => PromiseLike<{ error: MessageError | null }>;
        };
      }
    )
      .delete()
      .in("standard_id", standardIds);

    if (isMissingJurisdictionTablesError(deleteResult.error)) {
      return {
        data: null,
        error: new Error(
          "The jurisdiction standards tables are missing. Apply the latest Supabase migrations before saving overrides."
        ),
      };
    }

    if (deleteResult.error) {
      return {
        data: null,
        error: new Error(
          deleteResult.error.message ?? "Failed to replace jurisdiction standard mappings."
        ),
      };
    }
  }

  const mappingRows = normalized.mappings.map((mapping) => ({
    id: mapping.id,
    standard_id: mapping.standardId,
    mapping_type: mapping.mappingType,
    mapping_key: mapping.mappingKey,
    metadata: mapping.metadata ?? {},
    updated_at: new Date().toISOString(),
    updated_by: params.actorUserId,
  }));

  if (mappingRows.length > 0) {
    const mappingResult = await (
      params.supabase.from("platform_jurisdiction_standard_mappings") as unknown as {
        insert: (
          values: Record<string, unknown>[]
        ) => PromiseLike<{ error: MessageError | null }>;
      }
    ).insert(mappingRows);

    if (isMissingJurisdictionTablesError(mappingResult.error)) {
      return {
        data: null,
        error: new Error(
          "The jurisdiction standards tables are missing. Apply the latest Supabase migrations before saving overrides."
        ),
      };
    }

    if (mappingResult.error) {
      return {
        data: null,
        error: new Error(
          mappingResult.error.message ?? "Failed to save jurisdiction standard mappings."
        ),
      };
    }
  }

  const overrideResult = await saveJurisdictionStandardsOverride({
    supabase: params.supabase,
    actorUserId: params.actorUserId,
    overrides: normalized.standards.map((standard) => ({
      standardId: standard.id,
      title: standard.title,
      summary: standard.summary,
      applicability: standard.applicability,
      content: standard.content,
      effectiveDate: standard.effectiveDate,
      lastReviewedDate: standard.lastReviewedDate,
      metadata: standard.metadata ?? {},
    })),
  });

  if (overrideResult.error) {
    return {
      data: null,
      error: overrideResult.error,
    };
  }

  return {
    data: normalized,
    error: null,
  };
}
