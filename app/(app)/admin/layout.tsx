import { redirect } from "next/navigation";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

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
  const role = rawRole.toLowerCase().replace(/[\s-]/g, "_");
  const isPlatformAdmin = role === "super_admin" || role === "platform_admin";

  if (!isPlatformAdmin) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
