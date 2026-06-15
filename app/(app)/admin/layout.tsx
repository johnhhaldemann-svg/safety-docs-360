import { redirect } from "next/navigation";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { isCrossWorkspaceAdminRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseRouteHandlerClient();

  if (!supabase) {
    redirect("/login");
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const rawRole = (user.app_metadata?.role as string | undefined) ?? "";

  if (!isCrossWorkspaceAdminRole(rawRole)) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
