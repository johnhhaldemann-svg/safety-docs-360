import { NextResponse } from "next/server";
import { createSupabaseAdminClient, getSupabaseServerEnvStatus } from "@/lib/supabaseAdmin";
import { authorizeRequest, formatAccountStatus, formatAppRole } from "@/lib/rbac";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type CompanyRow = {
  id: string;
  name: string | null;
  team_key: string | null;
  industry: string | null;
  phone: string | null;
  website: string | null;
  address_line_1: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  status: string | null;
  created_at: string | null;
  archived_at?: string | null;
  archived_by_email?: string | null;
  restored_at?: string | null;
  restored_by_email?: string | null;
};

type CompanyMembershipRow = {
  user_id: string;
  role: string | null;
  status: string | null;
  created_at?: string | null;
};

type CompanyInviteRow = {
  id: string;
  email: string;
  role: string;
  account_status: string;
  created_at?: string | null;
};

type CompanyDocumentRow = {
  id: string;
  project_name: string | null;
  document_title: string | null;
  document_type: string | null;
  status: string | null;
  final_file_path: string | null;
  created_at: string | null;
  updated_at: string | null;
  user_id: string | null;
};

type FallbackUserRoleRow = {
  user_id: string;
  role: string;
  team: string | null;
  company_id?: string | null;
  account_status: string | null;
  created_at?: string | null;
};

type RpcCompanyUserRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  team: string | null;
  status: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
};

function getDisplayName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const metadataName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : "";

  if (metadataName.trim()) {
    return metadataName.trim();
  }

  if (user.email) {
    return user.email.split("@")[0];
  }

  return "Unnamed User";
}

function getAuthStatus(user: {
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
}) {
  if (!user.email_confirmed_at) {
    return "Pending";
  }

  if (!user.last_sign_in_at) {
    return "Active";
  }

  const lastSeenMs = new Date(user.last_sign_in_at).getTime();
  const daysSinceSeen = (Date.now() - lastSeenMs) / (1000 * 60 * 60 * 24);

  return daysSinceSeen > 30 ? "Inactive" : "Active";
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_view_all_company_data",
  });

  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const companyId = id.trim();

  if (!companyId) {
    return NextResponse.json({ error: "Company id is required." }, { status: 400 });
  }

  const adminClient = createSupabaseAdminClient();
  const supabase = adminClient ?? auth.supabase;
  const envStatus = getSupabaseServerEnvStatus();

  const [companyResult, membershipsResult, invitesResult, documentsResult] = await Promise.all([
    supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .maybeSingle(),
    supabase
      .from("company_memberships")
      .select("user_id, role, status, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("company_invites")
      .select("id, email, role, account_status, created_at")
      .eq("company_id", companyId)
      .is("consumed_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("documents")
      .select(
        "id, project_name, document_title, document_type, status, final_file_path, created_at, updated_at, user_id"
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
  ]);

  if (companyResult.error) {
    return NextResponse.json(
      { error: companyResult.error.message || "Failed to load company workspace." },
      { status: 500 }
    );
  }

  const company = (companyResult.data as CompanyRow | null) ?? null;

  if (!company?.id) {
    return NextResponse.json({ error: "Company workspace not found." }, { status: 404 });
  }

  const memberships = (membershipsResult.data as CompanyMembershipRow[] | null) ?? [];
  const invites = (invitesResult.data as CompanyInviteRow[] | null) ?? [];
  const documents = (documentsResult.data as CompanyDocumentRow[] | null) ?? [];

  const membershipMap = new Map<string, CompanyMembershipRow>();
  for (const membership of memberships) {
    membershipMap.set(membership.user_id, membership);
  }

  let users: Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    created_at?: string | null;
    last_sign_in_at?: string | null;
  }> = [];
  let companyUserDirectoryMode: "admin" | "rpc" | "partial" = adminClient ? "admin" : "partial";

  if (adminClient) {
    const authUsersResult = await adminClient.auth.admin.listUsers();

    if (authUsersResult.error) {
      return NextResponse.json(
        { error: authUsersResult.error.message || "Failed to load company users." },
        { status: 500 }
      );
    }

    const authUserMap = new Map(
      (authUsersResult.data.users ?? []).map((user) => [user.id, user] as const)
    );

    users = memberships.map((membership) => {
      const authUser = authUserMap.get(membership.user_id);

      return {
        id: membership.user_id,
        email: authUser?.email ?? "",
        name: authUser ? getDisplayName(authUser) : `User ${membership.user_id.slice(0, 8)}`,
        role: formatAppRole(membership.role),
        status:
          membership.status === "pending" || membership.status === "suspended"
            ? formatAccountStatus(membership.status)
            : authUser
              ? getAuthStatus(authUser)
              : "Active",
        created_at: authUser?.created_at ?? membership.created_at ?? null,
        last_sign_in_at: authUser?.last_sign_in_at ?? null,
      };
    });
  } else {
    const rpcResult = await (
      auth.supabase as {
        rpc: (
          fn: string,
          args: Record<string, unknown>
        ) => PromiseLike<{ data: unknown; error: { message?: string | null } | null }>;
      }
    ).rpc("admin_list_company_users", {
      target_company_id: companyId,
    });

    if (!rpcResult.error) {
      companyUserDirectoryMode = "rpc";
      users = ((rpcResult.data as RpcCompanyUserRow[] | null) ?? []).map((row) => ({
        id: row.id,
        email: row.email ?? "",
        name: row.name?.trim() || (row.email ? row.email.split("@")[0] : "Unnamed User"),
        role: formatAppRole(row.role),
        status: row.status?.trim() || "Active",
        created_at: row.created_at,
        last_sign_in_at: row.last_sign_in_at,
      }));
    } else {
      const roleRowsResult = await auth.supabase
        .from("user_roles")
        .select("user_id, role, team, company_id, account_status, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (roleRowsResult.error) {
        return NextResponse.json(
          {
            error: "Missing Supabase service role configuration.",
            details: envStatus,
          },
          { status: 500 }
        );
      }

      const roleRows = (roleRowsResult.data as FallbackUserRoleRow[] | null) ?? [];
      companyUserDirectoryMode = "partial";
      users = roleRows.map((row) => ({
        id: row.user_id,
        email: row.user_id === auth.user.id ? auth.user.email ?? "" : "",
        name:
          row.user_id === auth.user.id
            ? getDisplayName(auth.user)
            : `User ${row.user_id.slice(0, 8)}`,
        role: formatAppRole(row.role),
        status: formatAccountStatus(row.account_status),
        created_at: row.created_at ?? null,
        last_sign_in_at: null,
      }));
    }
  }

  const userDirectory = new Map(
    users.map((user) => [
      user.id,
      {
        name: user.name,
        email: user.email,
      },
    ])
  );

  const summary = {
    totalUsers: memberships.length,
    activeUsers: memberships.filter((row) => row.status === "active").length,
    pendingUsers: memberships.filter((row) => row.status === "pending").length,
    suspendedUsers: memberships.filter((row) => row.status === "suspended").length,
    pendingInvites: invites.length,
    completedDocuments: documents.filter(
      (row) =>
        (row.status ?? "").trim().toLowerCase() === "approved" || Boolean(row.final_file_path)
    ).length,
    submittedDocuments: documents.filter(
      (row) => (row.status ?? "").trim().toLowerCase() === "submitted"
    ).length,
  };

  const activity = [
    company.created_at
      ? {
          id: `${company.id}-created`,
          title: "Workspace created",
          detail: `${company.name?.trim() || "Company workspace"} was activated for customer use.`,
          meta: company.created_at,
          tone: "success" as const,
          sortAt: new Date(company.created_at).getTime(),
        }
      : null,
    company.archived_at
      ? {
          id: `${company.id}-archived`,
          title: "Workspace archived",
          detail: `Archived by ${company.archived_by_email?.trim() || "an internal admin"}.`,
          meta: company.archived_at,
          tone: "warning" as const,
          sortAt: new Date(company.archived_at).getTime(),
        }
      : null,
    company.restored_at
      ? {
          id: `${company.id}-restored`,
          title: "Workspace restored",
          detail: `Restored by ${company.restored_by_email?.trim() || "an internal admin"}.`,
          meta: company.restored_at,
          tone: "success" as const,
          sortAt: new Date(company.restored_at).getTime(),
        }
      : null,
    ...invites.map((invite) => ({
      id: `invite-${invite.id}`,
      title: "Invite sent",
      detail: `${invite.email} was invited as ${formatAppRole(invite.role)}.`,
      meta: invite.created_at ?? "",
      tone: "info" as const,
      sortAt: new Date(invite.created_at ?? 0).getTime(),
    })),
    ...memberships.map((membership) => {
      const linkedUser = userDirectory.get(membership.user_id);
      return {
        id: `membership-${membership.user_id}`,
        title: "User linked to workspace",
        detail: `${linkedUser?.name || `User ${membership.user_id.slice(0, 8)}`} joined as ${formatAppRole(
          membership.role
        )}.`,
        meta: membership.created_at ?? "",
        tone: membership.status === "suspended" ? ("warning" as const) : ("info" as const),
        sortAt: new Date(membership.created_at ?? 0).getTime(),
      };
    }),
    ...documents.map((document) => {
      const normalizedStatus = (document.status ?? "").trim().toLowerCase();
      const title =
        document.document_title?.trim() || document.project_name?.trim() || "Untitled document";

      return {
        id: `document-${document.id}`,
        title:
          normalizedStatus === "approved" || Boolean(document.final_file_path)
            ? "Document approved"
            : normalizedStatus === "submitted"
              ? "Document submitted"
              : "Document activity",
        detail: `${title} (${document.document_type?.trim() || "Document"}) updated in this workspace.`,
        meta: document.updated_at ?? document.created_at ?? "",
        tone:
          normalizedStatus === "approved" || Boolean(document.final_file_path)
            ? ("success" as const)
            : normalizedStatus === "submitted"
              ? ("warning" as const)
              : ("info" as const),
        sortAt: new Date(document.updated_at ?? document.created_at ?? 0).getTime(),
      };
    }),
  ]
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.sortAt - a.sortAt)
    .slice(0, 16)
    .map(({ id, title, detail, meta, tone }) => ({
      id,
      title,
      detail,
      meta,
      tone,
    }));

  return NextResponse.json({
    company: {
      id: company.id,
      name: company.name?.trim() || company.team_key?.trim() || "Unnamed Company",
      teamKey: company.team_key?.trim() || "General",
      industry: company.industry?.trim() || "",
      phone: company.phone?.trim() || "",
      website: company.website?.trim() || "",
      addressLine1: company.address_line_1?.trim() || "",
      city: company.city?.trim() || "",
      stateRegion: company.state_region?.trim() || "",
      postalCode: company.postal_code?.trim() || "",
      country: company.country?.trim() || "",
      primaryContactName: company.primary_contact_name?.trim() || "",
      primaryContactEmail: company.primary_contact_email?.trim() || "",
      status: company.status?.trim() || "active",
      createdAt: company.created_at,
      archivedAt: company.archived_at ?? null,
      archivedByEmail: company.archived_by_email?.trim() || "",
      restoredAt: company.restored_at ?? null,
      restoredByEmail: company.restored_by_email?.trim() || "",
    },
    summary,
    users,
    invites: invites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      role: formatAppRole(invite.role),
      status: formatAccountStatus(invite.account_status),
      created_at: invite.created_at ?? null,
    })),
    documents: documents.map((document) => ({
      id: document.id,
      title: document.document_title?.trim() || document.project_name?.trim() || "Untitled document",
      projectName: document.project_name?.trim() || "",
      type: document.document_type?.trim() || "",
      status: document.status?.trim() || "draft",
      createdAt: document.created_at,
      updatedAt: document.updated_at,
      hasFinalFile: Boolean(document.final_file_path),
      userId: document.user_id,
    })),
    activity,
    warning:
      companyUserDirectoryMode === "partial"
        ? "Showing partial company directory because the Supabase service role key is unavailable at runtime."
        : null,
  });
}
