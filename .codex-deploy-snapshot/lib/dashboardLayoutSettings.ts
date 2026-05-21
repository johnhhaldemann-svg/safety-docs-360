import type { DashboardBlockId } from "@/components/dashboard/types";

type MessageError = { message?: string | null };
type SupabaseLikeClient = {
  from: (table: string) => unknown;
};

export async function getUserDashboardLayout(params: {
  supabase: SupabaseLikeClient;
  userId: string;
}) {
  const { data, error } = await (
    params.supabase.from("user_dashboard_layouts") as {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => PromiseLike<{
            data: { user_id: string; layout: unknown; updated_at: string | null } | null;
            error: MessageError | null;
          }>;
        };
      };
    }
  )
    .select("user_id, layout, updated_at")
    .eq("user_id", params.userId)
    .maybeSingle();

  return {
    data: data ?? null,
    error,
  };
}

export async function saveUserDashboardLayout(params: {
  supabase: SupabaseLikeClient;
  userId: string;
  layout: DashboardBlockId[];
}) {
  const { error } = await (
    params.supabase.from("user_dashboard_layouts") as {
      upsert: (
        values: Record<string, unknown>,
        options?: Record<string, unknown>
      ) => PromiseLike<{ error: MessageError | null }>;
    }
  ).upsert(
    {
      user_id: params.userId,
      layout: params.layout,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  return { error };
}

export async function deleteUserDashboardLayout(params: {
  supabase: SupabaseLikeClient;
  userId: string;
}) {
  const { error } = await (
    params.supabase.from("user_dashboard_layouts") as {
      delete: () => {
        eq: (column: string, value: string) => PromiseLike<{ error: MessageError | null }>;
      };
    }
  )
    .delete()
    .eq("user_id", params.userId);

  return { error };
}
