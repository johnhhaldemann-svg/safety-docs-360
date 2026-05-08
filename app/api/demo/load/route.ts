import { NextResponse } from "next/server";
import { seedDemoCompany } from "@/lib/demoCompanySeed";
import { authorizeRequest, isAdminRole, isCompanyRole } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function canLoadDemoEnvironment(role: string) {
  return (
    isAdminRole(role) ||
    isCompanyRole(role) ||
    ["company_admin", "manager", "safety_manager", "project_manager"].includes(role)
  );
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if ("error" in auth) return auth.error;

  if (!canLoadDemoEnvironment(auth.role)) {
    return NextResponse.json(
      { error: "Only company users and admins can load the demo environment." },
      { status: 403 }
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Demo loader requires SUPABASE_SERVICE_ROLE_KEY on the server." },
      { status: 500 }
    );
  }

  try {
    const result = await seedDemoCompany({
      supabase: admin,
      actorUserId: auth.user.id,
      actorEmail: auth.user.email,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load demo environment." },
      { status: 500 }
    );
  }
}
