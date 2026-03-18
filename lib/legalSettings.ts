import { createClient } from "@supabase/supabase-js";
import {
  type AgreementConfig,
  type AgreementSection,
  getDefaultAgreementConfig,
} from "@/lib/legal";

const LEGAL_SETTINGS_KEY = "legal_agreement_config";

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

function normalizeSections(
  input: unknown,
  fallback: AgreementSection[]
): AgreementSection[] {
  if (!Array.isArray(input)) {
    return fallback;
  }

  const normalized = input
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const heading =
        typeof (item as { heading?: unknown }).heading === "string"
          ? (item as { heading: string }).heading.trim()
          : "";
      const body =
        typeof (item as { body?: unknown }).body === "string"
          ? (item as { body: string }).body.trim()
          : "";

      if (!heading || !body) {
        return null;
      }

      return { heading, body };
    })
    .filter((item): item is AgreementSection => Boolean(item));

  return normalized.length > 0 ? normalized : fallback;
}

export function normalizeAgreementConfig(input: unknown): AgreementConfig {
  const fallback = getDefaultAgreementConfig();

  if (!input || typeof input !== "object") {
    return fallback;
  }

  const raw = input as {
    version?: unknown;
    termsOfService?: { title?: unknown; sections?: unknown };
    liabilityWaiver?: { title?: unknown; sections?: unknown };
  };

  return {
    version:
      typeof raw.version === "string" && raw.version.trim()
        ? raw.version.trim()
        : fallback.version,
    termsOfService: {
      title:
        typeof raw.termsOfService?.title === "string" && raw.termsOfService.title.trim()
          ? raw.termsOfService.title.trim()
          : fallback.termsOfService.title,
      sections: normalizeSections(
        raw.termsOfService?.sections,
        fallback.termsOfService.sections
      ),
    },
    liabilityWaiver: {
      title:
        typeof raw.liabilityWaiver?.title === "string" && raw.liabilityWaiver.title.trim()
          ? raw.liabilityWaiver.title.trim()
          : fallback.liabilityWaiver.title,
      sections: normalizeSections(
        raw.liabilityWaiver?.sections,
        fallback.liabilityWaiver.sections
      ),
    },
  };
}

export async function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service role configuration.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function getAgreementConfig(supabase?: SupabaseLikeClient) {
  const client = supabase ?? (await getServiceRoleClient());
  const fallback = getDefaultAgreementConfig();

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
    .eq("key", LEGAL_SETTINGS_KEY)
    .maybeSingle();

  if (error) {
    if (isMissingPlatformSettingsError(error)) {
      return fallback;
    }

    throw new Error(error.message ?? "Failed to load agreement settings.");
  }

  return normalizeAgreementConfig((data as { value?: AgreementConfig } | null)?.value);
}

export async function saveAgreementConfig(params: {
  supabase: SupabaseLikeClient;
  actorUserId: string;
  config: AgreementConfig;
}) {
  const normalized = normalizeAgreementConfig(params.config);

  const result = await (
    params.supabase.from("platform_settings") as unknown as {
      upsert: (
        values: Record<string, unknown>,
        options?: Record<string, unknown>
      ) => PromiseLike<{ error: MessageError | null }>;
    }
  ).upsert(
    {
      key: LEGAL_SETTINGS_KEY,
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
        "The platform_settings table is missing. Apply the platform settings migration before saving agreement settings."
      ),
    };
  }

  return {
    data: normalized,
    error: result.error,
  };
}
