import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { resolveDashboardRole } from "@/lib/dashboardRole";
import {
  areDashboardLayoutsEqual,
  getAvailableDashboardBlocks,
  getDashboardRoleDefaultLayout,
  isDashboardBlockId,
  normalizeDashboardLayout,
  pinDashboardBlockToLayout,
  validateDashboardLayout,
} from "@/lib/dashboardLayout";
import { getUserDashboardLayout, saveUserDashboardLayout } from "@/lib/dashboardLayoutSettings";
import type { DashboardBlockId } from "@/components/dashboard/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, {
    allowPending: true,
    allowSuspended: true,
  });

  if ("error" in auth) {
    return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = resolveDashboardRole(auth.role);
  const availableBlocks = getAvailableDashboardBlocks({
    role,
    permissionMap: auth.permissionMap,
  });
  const availableBlockIds = availableBlocks.map((b) => b.id);
  const defaultLayout = normalizeDashboardLayout({
    layout: getDashboardRoleDefaultLayout(role),
    defaultLayout: getDashboardRoleDefaultLayout(role),
    availableBlockIds,
  });

  const body = (await request.json().catch(() => null)) as { blockId?: unknown } | null;
  const raw = body?.blockId;
  if (!isDashboardBlockId(raw)) {
    return NextResponse.json({ error: "Request body must include a valid blockId." }, { status: 400 });
  }
  const blockId: DashboardBlockId = raw;

  const rowResult = await getUserDashboardLayout({
    supabase: auth.supabase,
    userId: auth.user.id,
  });

  if (rowResult.error) {
    return NextResponse.json(
      { error: rowResult.error.message || "Failed to load dashboard layout." },
      { status: 500 }
    );
  }

  const effectiveLayout = normalizeDashboardLayout({
    layout: rowResult.data?.layout,
    defaultLayout,
    availableBlockIds,
  });

  const pinResult = pinDashboardBlockToLayout({
    layout: effectiveLayout,
    blockId,
    availableBlockIds,
  });

  if (!pinResult.ok) {
    return NextResponse.json({ error: pinResult.error }, { status: 400 });
  }

  const validated = validateDashboardLayout({
    layout: pinResult.layout,
    availableBlockIds,
  });

  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const saveResult = await saveUserDashboardLayout({
    supabase: auth.supabase,
    userId: auth.user.id,
    layout: validated.layout,
  });

  if (saveResult.error) {
    return NextResponse.json(
      { error: saveResult.error.message || "Failed to save dashboard layout." },
      { status: 500 }
    );
  }

  const layoutChanged = !areDashboardLayoutsEqual(effectiveLayout, validated.layout);

  return NextResponse.json({
    savedLayout: validated.layout,
    defaultLayout,
    effectiveLayout: validated.layout,
    availableBlocks,
    layoutChanged,
    replacedBlockId: pinResult.replaced,
  });
}
