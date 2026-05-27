import { NextResponse } from "next/server";
import { authorizeRequest, normalizeAppRole } from "@/lib/rbac";

export async function authorizeSuperadminHealthRequest(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_access_internal_admin",
    allowPending: true,
    allowSuspended: true,
  });

  if ("error" in auth) return auth;

  if (normalizeAppRole(auth.role) !== "super_admin") {
    return {
      error: NextResponse.json({ error: "Super admin access required." }, { status: 403 }),
    };
  }

  return auth;
}
