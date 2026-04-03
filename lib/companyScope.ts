type SupabaseLikeClient = {
  from: (table: string) => unknown;
};

type AuthUserLike = {
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

function normalizeTeamName(team?: string | null) {
  return team?.trim() || "General";
}

/** UUIDs are case-insensitive; normalize for comparisons with URL params. */
export function normalizeWorkspaceUuid(value: string) {
  return value.trim().toLowerCase();
}

/** When DB rows lag JWT (e.g. super-admin assigned company_id in metadata only). */
function companyIdFromJwtMetadata(authUser?: AuthUserLike | null): string | null {
  if (!authUser) return null;
  const fromApp = authUser.app_metadata?.company_id;
  const fromUser = authUser.user_metadata?.company_id;
  const raw = typeof fromApp === "string" ? fromApp : typeof fromUser === "string" ? fromUser : "";
  const trimmed = raw.trim();
  return trimmed || null;
}

export async function getCompanyScope(params: {
  supabase: SupabaseLikeClient;
  userId: string;
  fallbackTeam?: string | null;
  /** If set, used when membership / user_roles lack company_id but JWT has company_id. */
  authUser?: AuthUserLike | null;
}) {
  const { supabase, userId, fallbackTeam, authUser } = params;
  const safeTeam = normalizeTeamName(fallbackTeam);

  const membershipResult = await (
    supabase.from("company_memberships") as {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          limit: (n: number) => {
            maybeSingle: () => PromiseLike<{ data: unknown; error: { message?: string | null } | null }>;
          };
        };
      };
    }
  )
    .select("company_id, status, companies(id, name)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (
    !membershipResult.error &&
    membershipResult.data &&
    typeof membershipResult.data === "object"
  ) {
    const row = membershipResult.data as {
      company_id?: string | null;
      companies?: { id?: string | null; name?: string | null } | null;
    };

    const companyId = row.company_id ?? row.companies?.id ?? null;
    const companyName = row.companies?.name?.trim() || safeTeam;

    if (companyId) {
      return {
        companyId,
        companyName,
        source: "membership" as const,
      };
    }
  }

  const roleRowResult = await (
    supabase.from("user_roles") as {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => PromiseLike<{ data: unknown; error: { message?: string | null } | null }>;
        };
      };
    }
  )
    .select("company_id, team")
    .eq("user_id", userId)
    .maybeSingle();

  if (
    !roleRowResult.error &&
    roleRowResult.data &&
    typeof roleRowResult.data === "object"
  ) {
    const row = roleRowResult.data as {
      company_id?: string | null;
      team?: string | null;
    };

    if (row.company_id) {
      const companyLookup = await (
        supabase.from("companies") as {
          select: (columns: string) => {
            eq: (column: string, value: string) => {
              maybeSingle: () => PromiseLike<{ data: unknown; error: { message?: string | null } | null }>;
            };
          };
        }
      )
        .select("id, name")
        .eq("id", row.company_id)
        .maybeSingle();

      const companyData = (companyLookup.data ?? null) as { name?: string | null } | null;

      return {
        companyId: row.company_id,
        companyName: companyData?.name?.trim() || normalizeTeamName(row.team) || safeTeam,
        source: "role_row" as const,
      };
    }
  }

  const jwtCompanyId = companyIdFromJwtMetadata(authUser);
  if (jwtCompanyId) {
    const jwtCompanyLookup = await (
      supabase.from("companies") as {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            maybeSingle: () => PromiseLike<{ data: unknown; error: { message?: string | null } | null }>;
          };
        };
      }
    )
      .select("id, name")
      .eq("id", jwtCompanyId)
      .maybeSingle();

    if (
      !jwtCompanyLookup.error &&
      jwtCompanyLookup.data &&
      typeof jwtCompanyLookup.data === "object"
    ) {
      const c = jwtCompanyLookup.data as { id?: string | null; name?: string | null };
      if (c.id) {
        return {
          companyId: jwtCompanyId,
          companyName: c.name?.trim() || safeTeam,
          source: "jwt_metadata" as const,
        };
      }
    }
  }

  return {
    companyId: null,
    companyName: safeTeam,
    source: "team_fallback" as const,
  };
}

export async function ensureCompanyScope(params: {
  supabase: SupabaseLikeClient;
  userId: string;
  fallbackTeam?: string | null;
  role?: string | null;
  actorUserId?: string | null;
}) {
  const { supabase, userId, fallbackTeam, role, actorUserId } = params;
  const safeTeam = normalizeTeamName(fallbackTeam);

  const existing = await getCompanyScope({
    supabase,
    userId,
    fallbackTeam: safeTeam,
  });

  if (existing.companyId) {
    return existing;
  }

  const upsertCompany = await (
    supabase.from("companies") as {
      upsert: (
        values: Record<string, unknown>,
        options?: Record<string, unknown>
      ) => {
        select: (columns: string) => {
          single: () => PromiseLike<{ data: unknown; error: { message?: string | null } | null }>;
        };
      };
    }
  ).upsert(
    {
      name: safeTeam,
      team_key: safeTeam,
      created_by: actorUserId ?? userId,
      updated_by: actorUserId ?? userId,
    },
    {
      onConflict: "team_key",
      ignoreDuplicates: false,
    }
  )
    .select("id, name")
    .single();

  if (upsertCompany.error || !upsertCompany.data || typeof upsertCompany.data !== "object") {
    return existing;
  }

  const company = upsertCompany.data as { id?: string | null; name?: string | null };

  if (!company.id) {
    return existing;
  }

  await (
    supabase.from("company_memberships") as {
      upsert: (
        values: Record<string, unknown>,
        options?: Record<string, unknown>
      ) => PromiseLike<{ error: { message?: string | null } | null }>;
    }
  ).upsert(
    {
      user_id: userId,
      company_id: company.id,
      role: role ?? "company_user",
      status: "active",
      created_by: actorUserId ?? userId,
      updated_by: actorUserId ?? userId,
    },
    {
      onConflict: "user_id,company_id",
    }
  );

  await (
    supabase.from("user_roles") as {
      update: (values: Record<string, unknown>) => {
        eq: (column: string, value: string) => PromiseLike<{ error: { message?: string | null } | null }>;
      };
    }
  )
    .update({
      company_id: company.id,
      team: safeTeam,
      updated_by: actorUserId ?? userId,
    })
    .eq("user_id", userId);

  return {
    companyId: company.id,
    companyName: company.name?.trim() || safeTeam,
    source: "team_fallback" as const,
  };
}
