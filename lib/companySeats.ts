import type { SupabaseClient } from "@supabase/supabase-js";

export function normalizeCompanySubscriptionStatus(
  input: string | undefined | null
): "active" | "inactive" | "suspended" {
  const t = (input ?? "").trim().toLowerCase();
  if (t === "active") return "active";
  if (t === "suspended") return "suspended";
  return "inactive";
}

export async function getCompanySeatCounts(
  supabase: SupabaseClient,
  companyId: string
): Promise<{
  membershipSeats: number;
  pendingInvites: number;
  seatsUsed: number;
  error: string | null;
}> {
  const [memRes, invRes] = await Promise.all([
    supabase
      .from("company_memberships")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("status", ["active", "pending"]),
    supabase
      .from("company_invites")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .is("consumed_at", null),
  ]);

  if (memRes.error) {
    return {
      membershipSeats: 0,
      pendingInvites: 0,
      seatsUsed: 0,
      error: memRes.error.message ?? "Failed to count memberships.",
    };
  }
  if (invRes.error) {
    return {
      membershipSeats: 0,
      pendingInvites: 0,
      seatsUsed: 0,
      error: invRes.error.message ?? "Failed to count invites.",
    };
  }

  const membershipSeats = memRes.count ?? 0;
  const pendingInvites = invRes.count ?? 0;

  return {
    membershipSeats,
    pendingInvites,
    seatsUsed: membershipSeats + pendingInvites,
    error: null,
  };
}

/**
 * Blocks new invites when subscription is not active or seat cap would be exceeded.
 * Updating an existing pending invite for the same email is always allowed (no extra seat).
 */
export async function assertCompanyInviteAllowed(params: {
  supabase: SupabaseClient;
  companyId: string;
  inviteEmailLower: string;
}): Promise<
  | { ok: true }
  | {
      ok: false;
      status: number;
      error: string;
    }
> {
  const { supabase, companyId, inviteEmailLower } = params;

  const existingInvite = await supabase
    .from("company_invites")
    .select("id")
    .eq("company_id", companyId)
    .eq("email", inviteEmailLower)
    .is("consumed_at", null)
    .maybeSingle();

  if (existingInvite.error) {
    return {
      ok: false,
      status: 500,
      error: existingInvite.error.message ?? "Failed to check existing invite.",
    };
  }

  const hasExistingPendingInvite = Boolean(
    existingInvite.data && typeof existingInvite.data === "object"
  );

  const subResult = await supabase
    .from("company_subscriptions")
    .select("status, max_user_seats")
    .eq("company_id", companyId)
    .maybeSingle();

  if (subResult.error) {
    return {
      ok: false,
      status: 500,
      error: subResult.error.message ?? "Failed to load company subscription.",
    };
  }

  const sub = subResult.data as
    | { status?: string | null; max_user_seats?: number | null }
    | null;

  if (!hasExistingPendingInvite) {
    const subStatus = normalizeCompanySubscriptionStatus(sub?.status ?? null);
    if (subStatus !== "active") {
      return {
        ok: false,
        status: 403,
        error:
          "Company subscription is not active. Ask a platform administrator to activate the subscription before inviting users.",
      };
    }

    const maxSeats = sub?.max_user_seats;
    if (maxSeats != null && maxSeats >= 1) {
      const counts = await getCompanySeatCounts(supabase, companyId);
      if (counts.error) {
        return { ok: false, status: 500, error: counts.error };
      }
      if (counts.seatsUsed >= maxSeats) {
        return {
          ok: false,
          status: 403,
          error: `This company has reached its user limit (${maxSeats} seats). Ask a platform administrator to raise the seat limit or deactivate users before inviting more people.`,
        };
      }
    }
  } else {
    const subStatus = normalizeCompanySubscriptionStatus(sub?.status ?? null);
    if (subStatus !== "active") {
      return {
        ok: false,
        status: 403,
        error:
          "Company subscription is not active. Ask a platform administrator to activate the subscription before managing invites.",
      };
    }
  }

  return { ok: true };
}
