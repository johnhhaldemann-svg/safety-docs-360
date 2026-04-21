import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { resolveDashboardRole } from "@/lib/dashboardRole";
import {
  areDashboardLayoutsEqual,
  getAvailableDashboardBlocks,
  getAvailableDashboardBlockIds,
  getDashboardRoleDefaultLayout,
  normalizeDashboardLayout,
  validateDashboardLayout,
} from "@/lib/dashboardLayout";
import {
  deleteUserDashboardLayout,
  getUserDashboardLayout,
  saveUserDashboardLayout,
} from "@/lib/dashboardLayoutSettings";

export const runtime = "nodejs";

type AuthorizedRequest = Exclude<
  Awaited<ReturnType<typeof authorizeRequest>>,
  { error: NextResponse }
>;

type LayoutContext = {
  auth: AuthorizedRequest;
  role: ReturnType<typeof resolveDashboardRole>;
  availableBlocks: ReturnType<typeof getAvailableDashboardBlocks>;
  availableBlockIds: ReturnType<typeof getAvailableDashboardBlockIds>;
  defaultLayout: ReturnType<typeof normalizeDashboardLayout>;
};

async function getLayoutContext(request: Request): Promise<LayoutContext | NextResponse> {
  const auth = await authorizeRequest(request, {
    allowPending: true,
    allowSuspended: true,
  });

  if ("error" in auth) {
    return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authorized = auth as AuthorizedRequest;
  const role = resolveDashboardRole(authorized.role);
  const availableBlocks = getAvailableDashboardBlocks({
    role,
    permissionMap: authorized.permissionMap,
  });
  const availableBlockIds = availableBlocks.map((block) => block.id);
  const defaultLayout = normalizeDashboardLayout({
    layout: getDashboardRoleDefaultLayout(role),
    defaultLayout: getDashboardRoleDefaultLayout(role),
    availableBlockIds,
  });

  return {
    auth: authorized,
    role,
    availableBlocks,
    availableBlockIds,
    defaultLayout,
  };
}

export async function GET(request: Request) {
  const context = await getLayoutContext(request);
  if (context instanceof NextResponse) {
    return context;
  }

  const { auth, defaultLayout, availableBlocks, availableBlockIds } = context;
  const result = await getUserDashboardLayout({
    supabase: auth.supabase,
    userId: auth.user.id,
  });

  if (result.error) {
    return NextResponse.json(
      { error: result.error.message || "Failed to load dashboard layout." },
      { status: 500 }
    );
  }

  const row = result.data;
  const effectiveLayout = normalizeDashboardLayout({
    layout: row?.layout,
    defaultLayout,
    availableBlockIds,
  });
  const validatedSaved = row?.layout
    ? validateDashboardLayout({
        layout: row.layout,
        availableBlockIds,
      })
    : null;

  let savedLayout = validatedSaved?.ok ? validatedSaved.layout : null;

  if (row && (!savedLayout || !areDashboardLayoutsEqual(savedLayout, effectiveLayout))) {
    const saveResult = await saveUserDashboardLayout({
      supabase: auth.supabase,
      userId: auth.user.id,
      layout: effectiveLayout,
    });
    if (saveResult.error) {
      return NextResponse.json(
        { error: saveResult.error.message || "Failed to normalize dashboard layout." },
        { status: 500 }
      );
    }
    savedLayout = effectiveLayout;
  }

  return NextResponse.json({
    savedLayout,
    defaultLayout,
    effectiveLayout,
    availableBlocks,
  });
}

export async function PATCH(request: Request) {
  const context = await getLayoutContext(request);
  if (context instanceof NextResponse) {
    return context;
  }

  const body = (await request.json().catch(() => null)) as { layout?: unknown } | null;
  const validated = validateDashboardLayout({
    layout: body?.layout,
    availableBlockIds: context.availableBlockIds,
  });

  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const saveResult = await saveUserDashboardLayout({
    supabase: context.auth.supabase,
    userId: context.auth.user.id,
    layout: validated.layout,
  });

  if (saveResult.error) {
    return NextResponse.json(
      { error: saveResult.error.message || "Failed to save dashboard layout." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    savedLayout: validated.layout,
    defaultLayout: context.defaultLayout,
    effectiveLayout: validated.layout,
    availableBlocks: context.availableBlocks,
  });
}

export async function DELETE(request: Request) {
  const context = await getLayoutContext(request);
  if (context instanceof NextResponse) {
    return context;
  }

  const deleteResult = await deleteUserDashboardLayout({
    supabase: context.auth.supabase,
    userId: context.auth.user.id,
  });

  if (deleteResult.error) {
    return NextResponse.json(
      { error: deleteResult.error.message || "Failed to reset dashboard layout." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    savedLayout: null,
    defaultLayout: context.defaultLayout,
    effectiveLayout: context.defaultLayout,
    availableBlocks: context.availableBlocks,
  });
}
