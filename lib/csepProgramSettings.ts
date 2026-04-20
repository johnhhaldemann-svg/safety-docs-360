import { createClient } from "@supabase/supabase-js";
import {
  getDefaultProgramDefinitions,
  normalizeCsepProgramConfig,
} from "@/lib/csepPrograms";
import { getSupabaseServerUrl, getSupabaseServiceRoleKey } from "@/lib/supabaseAdmin";
import type { CSEPProgramConfig } from "@/types/csep-programs";

const CSEP_PROGRAM_SETTINGS_KEY = "csep_program_config";

type MessageError = { message?: string | null };
type SupabaseLikeClient = {
  from: (table: string) => unknown;
};

function isMissingPlatformSettingsError(error?: { message?: string | null } | null) {
  const message = (error?.message ?? "").toLowerCase();

  return (
    message.includes("platform_settings") &&
    (message.includes("schema cache") || message.includes("does not exist"))
  );
}

export async function getProgramSettingsServiceRoleClient() {
  const supabaseUrl = getSupabaseServerUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service role configuration.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function getCsepProgramConfig(supabase?: SupabaseLikeClient) {
  const client = supabase ?? (await getProgramSettingsServiceRoleClient());
  const fallback: CSEPProgramConfig = {
    definitions: getDefaultProgramDefinitions(),
  };

  const { data, error } = await (
    client.from("platform_settings") as {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => PromiseLike<{ data: unknown; error: MessageError | null }>;
        };
      };
    }
  )
    .select("value")
    .eq("key", CSEP_PROGRAM_SETTINGS_KEY)
    .maybeSingle();

  if (error) {
    if (isMissingPlatformSettingsError(error)) {
      return fallback;
    }

    throw new Error(error.message ?? "Failed to load CSEP program settings.");
  }

  return normalizeCsepProgramConfig((data as { value?: unknown } | null)?.value ?? fallback);
}

export async function saveCsepProgramConfig(params: {
  supabase: SupabaseLikeClient;
  actorUserId: string;
  config: CSEPProgramConfig;
}) {
  const normalized = normalizeCsepProgramConfig(params.config);

  const result = await (
    params.supabase.from("platform_settings") as unknown as {
      upsert: (
        values: Record<string, unknown>,
        options?: Record<string, unknown>
      ) => PromiseLike<{ error: MessageError | null }>;
    }
  ).upsert(
    {
      key: CSEP_PROGRAM_SETTINGS_KEY,
      value: normalized,
      updated_at: new Date().toISOString(),
      updated_by: params.actorUserId,
    },
    {
      onConflict: "key",
    }
  );

  if (isMissingPlatformSettingsError(result.error)) {
    return {
      data: null,
      error: new Error(
        "The platform_settings table is missing. Apply the platform settings migration before saving CSEP program settings."
      ),
    };
  }

  return {
    data: normalized,
    error: result.error,
  };
}
