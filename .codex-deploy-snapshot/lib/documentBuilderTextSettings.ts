import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_DOCUMENT_BUILDER_TEXT_CONFIG,
  normalizeDocumentBuilderTextConfig,
} from "@/lib/documentBuilderText";
import { getSupabaseServerUrl, getSupabaseServiceRoleKey } from "@/lib/supabaseAdmin";
import type { DocumentBuilderTextConfig } from "@/types/document-builder-text";

const DOCUMENT_BUILDER_TEXT_SETTINGS_KEY = "document_builder_text_config";

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

export async function getDocumentBuilderTextServiceRoleClient() {
  const supabaseUrl = getSupabaseServerUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service role configuration.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function getDocumentBuilderTextConfig(supabase?: SupabaseLikeClient) {
  const client = supabase ?? (await getDocumentBuilderTextServiceRoleClient());

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
    .eq("key", DOCUMENT_BUILDER_TEXT_SETTINGS_KEY)
    .maybeSingle();

  if (error) {
    if (isMissingPlatformSettingsError(error)) {
      return DEFAULT_DOCUMENT_BUILDER_TEXT_CONFIG;
    }

    throw new Error(error.message ?? "Failed to load document builder text settings.");
  }

  return normalizeDocumentBuilderTextConfig(
    (data as { value?: DocumentBuilderTextConfig } | null)?.value
  );
}

export async function saveDocumentBuilderTextConfig(params: {
  supabase: SupabaseLikeClient;
  actorUserId: string;
  config: DocumentBuilderTextConfig;
}) {
  const normalized = normalizeDocumentBuilderTextConfig(params.config);

  const result = await (
    params.supabase.from("platform_settings") as unknown as {
      upsert: (
        values: Record<string, unknown>,
        options?: Record<string, unknown>
      ) => PromiseLike<{ error: MessageError | null }>;
    }
  ).upsert(
    {
      key: DOCUMENT_BUILDER_TEXT_SETTINGS_KEY,
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
        "The platform_settings table is missing. Apply the platform settings migration before saving document builder text settings."
      ),
    };
  }

  return {
    data: normalized,
    error: result.error,
  };
}
