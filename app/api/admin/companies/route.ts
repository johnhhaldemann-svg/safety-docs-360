import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { sendCompanyInviteEmail } from "@/lib/inviteEmail";
import { authorizeRequest } from "@/lib/rbac";
import { normalizeApprovalPlanName } from "@/lib/workspaceProduct";

export const runtime = "nodejs";

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

type MembershipRow = {
  company_id: string;
  role: string | null;
  status: string | null;
};

type InviteRow = {
  company_id: string;
  consumed_at: string | null;
};

type CompanyDocumentRow = {
  company_id: string | null;
  status: string | null;
  final_file_path: string | null;
};

type CompanySignupRequestRow = {
  id: string;
  owner_user_id: string | null;
  company_name: string | null;
  industry: string | null;
  website: string | null;
  address_line_1: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  phone: string | null;
  requested_role: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  notes: string | null;
  account_status: string | null;
  status: string | null;
  created_at: string | null;
};

type CompanyActionPayload = {
  requestId?: string;
  companyId?: string;
  action?: string;
  notes?: string;
  /** Stored on `company_subscriptions.plan_name` (e.g. `CSEP` for CSEP-only tier). */
  planName?: string;
};

type SupabaseWriteClient = {
  from: (table: string) => unknown;
};

function buildCompanyKeyBase(companyName: string) {
  const normalized = companyName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);

  return normalized || "company";
}

function buildUniqueCompanyKey(companyName: string) {
  return `${buildCompanyKeyBase(companyName)}-${randomUUID().slice(0, 8)}`;
}

async function findAuthUserByEmail(params: {
  adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  email: string;
}) {
  const targetEmail = params.email.trim().toLowerCase();
  let page = 1;

  while (page <= 20) {
    const { data, error } = await params.adminClient.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      return { user: null, error };
    }

    const users = data?.users ?? [];
    const matchedUser =
      users.find((user) => (user.email ?? "").trim().toLowerCase() === targetEmail) ?? null;

    if (matchedUser) {
      return { user: matchedUser, error: null };
    }

    if (users.length < 200) {
      break;
    }

    page += 1;
  }

  return { user: null, error: null };
}

async function linkExistingOwnerAccount(params: {
  supabase: SupabaseWriteClient;
  adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>> | null;
  ownerUserId: string;
  companyId: string;
  companyName: string;
  actorUserId: string;
  primaryContactEmail: string;
}) {
  const nowIso = new Date().toISOString();

  const [roleResult, membershipResult, consumeInviteResult] = await Promise.all([
    (params.supabase.from("user_roles") as {
      upsert: (
        values: Record<string, unknown>,
        options?: Record<string, unknown>
      ) => Promise<{ error: { message?: string | null } | null }>;
    }).upsert(
      {
        user_id: params.ownerUserId,
        role: "company_admin",
        team: params.companyName,
        company_id: params.companyId,
        account_status: "active",
        created_by: params.actorUserId,
        updated_by: params.actorUserId,
      },
      {
        onConflict: "user_id",
      }
    ),
    (params.supabase.from("company_memberships") as {
      upsert: (
        values: Record<string, unknown>,
        options?: Record<string, unknown>
      ) => Promise<{ error: { message?: string | null } | null }>;
    }).upsert(
      {
        user_id: params.ownerUserId,
        company_id: params.companyId,
        role: "company_admin",
        status: "active",
        created_by: params.actorUserId,
        updated_by: params.actorUserId,
      },
      {
        onConflict: "user_id,company_id",
      }
    ),
    (params.supabase.from("company_invites") as {
      update: (values: Record<string, unknown>) => {
        eq: (column: string, value: string) => {
          is: (column: string, value: null) => Promise<{
            error: { message?: string | null } | null;
          }>;
        };
      };
    })
      .update({
        consumed_at: nowIso,
        consumed_by: params.ownerUserId,
        updated_at: nowIso,
        updated_by: params.actorUserId,
      })
      .eq("email", params.primaryContactEmail)
      .is("consumed_at", null),
  ]);

  if (roleResult.error || membershipResult.error) {
    return {
      error:
        roleResult.error?.message ||
        membershipResult.error?.message ||
        "The company owner account could not be linked to the company workspace.",
      metadataWarning: null as string | null,
    };
  }

  let metadataWarning: string | null = null;

  if (params.adminClient) {
    const ownerLookupResult = await params.adminClient.auth.admin.getUserById(params.ownerUserId);
    const ownerUser = ownerLookupResult.data.user ?? null;

    if (!ownerLookupResult.error && ownerUser) {
      const metadataResult = await params.adminClient.auth.admin.updateUserById(
        params.ownerUserId,
        {
          user_metadata: {
            ...(ownerUser.user_metadata ?? {}),
            role: "company_admin",
            team: params.companyName,
            company_id: params.companyId,
            account_status: "active",
            company_name: params.companyName,
          },
          app_metadata: {
            ...(ownerUser.app_metadata ?? {}),
            role: "company_admin",
            team: params.companyName,
            company_id: params.companyId,
            account_status: "active",
          },
        }
      );

      if (metadataResult.error) {
        metadataWarning =
          "The company owner was linked successfully, but profile metadata will finish syncing on next login.";
      }
    } else if (ownerLookupResult.error) {
      metadataWarning =
        "The company owner was linked successfully, but profile metadata could not be refreshed immediately.";
    }
  }

  if (consumeInviteResult.error) {
    metadataWarning =
      metadataWarning ||
      "The company owner was linked successfully, but an older invite record could not be closed automatically.";
  }

  return {
    error: null,
    metadataWarning,
  };
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_view_all_company_data",
  });

  if ("error" in auth) {
    return auth.error;
  }

  const adminClient = createSupabaseAdminClient() ?? auth.supabase;

  const [companiesResult, membershipsResult, invitesResult, documentsResult, signupRequestsResult] =
    await Promise.all([
    adminClient
      .from("companies")
      .select("*")
      .order("name"),
    adminClient.from("company_memberships").select("company_id, role, status"),
    adminClient.from("company_invites").select("company_id, consumed_at"),
    adminClient.from("documents").select("company_id, status, final_file_path"),
    adminClient
      .from("company_signup_requests")
      .select(
        "id, owner_user_id, company_name, industry, website, address_line_1, city, state_region, postal_code, country, primary_contact_name, primary_contact_email, phone, requested_role, reviewed_at, reviewed_by, notes, account_status, status, created_at"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    ]);

  if (companiesResult.error) {
    return NextResponse.json(
      { error: companiesResult.error.message || "Failed to load companies." },
      { status: 500 }
    );
  }

  const memberships = (membershipsResult.data as MembershipRow[] | null) ?? [];
  const invites = (invitesResult.data as InviteRow[] | null) ?? [];
  const documents = (documentsResult.data as CompanyDocumentRow[] | null) ?? [];
  const signupRequests =
    (signupRequestsResult.data as CompanySignupRequestRow[] | null) ?? [];

  const companies = ((companiesResult.data as CompanyRow[] | null) ?? []).map((company) => {
    const companyMemberships = memberships.filter((row) => row.company_id === company.id);
    const companyInvites = invites.filter(
      (row) => row.company_id === company.id && !row.consumed_at
    );
    const companyDocuments = documents.filter((row) => row.company_id === company.id);

    return {
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
      totalUsers: companyMemberships.length,
      companyAdmins: companyMemberships.filter((row) => row.role === "company_admin").length,
      activeUsers: companyMemberships.filter((row) => row.status === "active").length,
      pendingUsers: companyMemberships.filter((row) => row.status === "pending").length,
      pendingInvites: companyInvites.length,
      completedDocuments: companyDocuments.filter(
        (row) =>
          row.status?.trim().toLowerCase() === "approved" || Boolean(row.final_file_path)
      ).length,
      submittedDocuments: companyDocuments.filter(
        (row) => row.status?.trim().toLowerCase() === "submitted"
      ).length,
    };
  });

  return NextResponse.json({
    companies,
    signupRequests,
    capabilities: {
      canPermanentlyDeleteCompanies: auth.role === "super_admin",
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, {
    requirePermission: "can_view_all_company_data",
  });

  if ("error" in auth) {
    return auth.error;
  }

  const supabase = createSupabaseAdminClient() ?? auth.supabase;
  const adminClient = createSupabaseAdminClient();
  const body = (await request.json().catch(() => null)) as CompanyActionPayload | null;
  const requestId = body?.requestId?.trim() ?? "";
  const companyId = body?.companyId?.trim() ?? "";
  const action = body?.action?.trim().toLowerCase() ?? "";
  const notes = body?.notes?.trim() ?? null;
  const approvalPlanName = normalizeApprovalPlanName(body?.planName ?? null);

  if (action === "archive" || action === "restore") {
    if (!companyId) {
      return NextResponse.json(
        { error: "A valid company is required for this action." },
        { status: 400 }
      );
    }

    const companyLookup = await supabase
      .from("companies")
      .select("id, name, status")
      .eq("id", companyId)
      .maybeSingle();

    if (companyLookup.error) {
      return NextResponse.json(
        { error: companyLookup.error.message || "Failed to load company workspace." },
        { status: 500 }
      );
    }

    const company = companyLookup.data as { id?: string | null; name?: string | null; status?: string | null } | null;

    if (!company?.id) {
      return NextResponse.json(
        { error: "That company workspace could not be found." },
        { status: 404 }
      );
    }

    const nextCompanyStatus = action === "archive" ? "archived" : "active";
    const nextMembershipStatus = action === "archive" ? "suspended" : "active";
    const nowIso = new Date().toISOString();

    const [companyUpdateResult, membershipsUpdateResult, roleUpdateResult, invitesUpdateResult] =
      await Promise.all([
        supabase
          .from("companies")
          .update({
            status: nextCompanyStatus,
            updated_at: nowIso,
            updated_by: auth.user.id,
            archived_at: action === "archive" ? nowIso : null,
            archived_by: action === "archive" ? auth.user.id : null,
            archived_by_email: action === "archive" ? auth.user.email ?? null : null,
            restored_at: action === "restore" ? nowIso : null,
            restored_by: action === "restore" ? auth.user.id : null,
            restored_by_email: action === "restore" ? auth.user.email ?? null : null,
          })
          .eq("id", companyId),
        supabase
          .from("company_memberships")
          .update({
            status: nextMembershipStatus,
            updated_at: nowIso,
            updated_by: auth.user.id,
          })
          .eq("company_id", companyId),
        supabase
          .from("user_roles")
          .update({
            account_status: nextMembershipStatus,
            updated_at: nowIso,
            updated_by: auth.user.id,
          })
          .eq("company_id", companyId),
        supabase
          .from("company_invites")
          .update({
            account_status: nextMembershipStatus,
            updated_at: nowIso,
            updated_by: auth.user.id,
          })
          .eq("company_id", companyId)
          .is("consumed_at", null),
      ]);

    const writeError =
      companyUpdateResult.error ||
      membershipsUpdateResult.error ||
      roleUpdateResult.error ||
      invitesUpdateResult.error;

    if (writeError) {
      return NextResponse.json(
        { error: writeError.message || "Failed to update company workspace status." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        action === "archive"
          ? `${company.name?.trim() || "The company"} was archived and workspace access was suspended.`
          : `${company.name?.trim() || "The company"} was restored and workspace access was reactivated.`,
    });
  }

  if (!requestId || (action !== "approve" && action !== "reject")) {
    return NextResponse.json(
      { error: "A valid company signup request action is required." },
      { status: 400 }
    );
  }

  const signupRequestResult = await supabase
    .from("company_signup_requests")
    .select(
      "id, owner_user_id, company_name, industry, website, address_line_1, city, state_region, postal_code, country, primary_contact_name, primary_contact_email, phone, requested_role, notes, account_status, status, created_at"
    )
    .eq("id", requestId)
    .maybeSingle();

  if (signupRequestResult.error) {
    return NextResponse.json(
      {
        error:
          signupRequestResult.error.message ||
          "Failed to load the company signup request.",
      },
      { status: 500 }
    );
  }

  const signupRequest = signupRequestResult.data as CompanySignupRequestRow | null;

  if (!signupRequest) {
    return NextResponse.json(
      { error: "That company signup request could not be found." },
      { status: 404 }
    );
  }

  if ((signupRequest.status ?? "").toLowerCase() !== "pending") {
    return NextResponse.json(
      { error: "This company signup request has already been reviewed." },
      { status: 400 }
    );
  }

  if (action === "reject") {
    const rejectResult = await supabase
      .from("company_signup_requests")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: auth.user.id,
        notes,
      })
      .eq("id", requestId);

    if (rejectResult.error) {
      return NextResponse.json(
        {
          error:
            rejectResult.error.message ||
            "Failed to reject the company signup request.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Workspace request rejected.",
    });
  }

  const companyName = signupRequest.company_name?.trim() || "New Company";
  const primaryContactEmail = signupRequest.primary_contact_email?.trim().toLowerCase() || "";
  const primaryContactName = signupRequest.primary_contact_name?.trim() || "Company Owner";
  if (!primaryContactEmail) {
    return NextResponse.json(
      { error: "The signup request is missing the primary contact email." },
      { status: 400 }
    );
  }

  let companyData:
    | {
        id: string;
        name: string | null;
        team_key: string | null;
      }
    | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const insertResult = await supabase
      .from("companies")
      .insert({
        name: companyName,
        team_key: buildUniqueCompanyKey(companyName),
        industry: signupRequest.industry?.trim() || null,
        phone: signupRequest.phone?.trim() || null,
        website: signupRequest.website?.trim() || null,
        address_line_1: signupRequest.address_line_1?.trim() || null,
        city: signupRequest.city?.trim() || null,
        state_region: signupRequest.state_region?.trim() || null,
        postal_code: signupRequest.postal_code?.trim() || null,
        country: signupRequest.country?.trim() || null,
        primary_contact_name: primaryContactName,
        primary_contact_email: primaryContactEmail,
        status: "active",
        created_by: auth.user.id,
        updated_by: auth.user.id,
      })
      .select("id, name, team_key")
      .single();

    if (!insertResult.error && insertResult.data) {
      companyData = insertResult.data;
      break;
    }
  }

  if (!companyData?.id) {
    return NextResponse.json(
      {
        error:
          "Failed to activate the company workspace. Confirm the companies table allows internal admin inserts.",
      },
      { status: 500 }
    );
  }

  const subscriptionUpsert = await supabase.from("company_subscriptions").upsert(
    {
      company_id: companyData.id,
      status: "active",
      plan_name: approvalPlanName,
      created_by: auth.user.id,
      updated_by: auth.user.id,
    },
    { onConflict: "company_id" }
  );

  if (subscriptionUpsert.error) {
    return NextResponse.json(
      {
        error:
          subscriptionUpsert.error.message ||
          "The company workspace was created, but the subscription record could not be saved.",
      },
      { status: 500 }
    );
  }

  let ownerLinkMode: "linked_existing_user" | "invite_created" = "invite_created";
  const ownerUserIdFromRequest = signupRequest.owner_user_id?.trim() ?? "";
  let linkedOwnerUserId: string | null = ownerUserIdFromRequest || null;
  let approvalWarning: string | null = null;

  if (!linkedOwnerUserId && adminClient) {
    const existingUserResult = await findAuthUserByEmail({
      adminClient,
      email: primaryContactEmail,
    });

    if (existingUserResult.error) {
      return NextResponse.json(
        {
          error:
            existingUserResult.error.message ||
            "The company workspace was created, but the company owner account could not be looked up.",
        },
        { status: 500 }
      );
    }

    linkedOwnerUserId = existingUserResult.user?.id ?? null;
  }

  if (linkedOwnerUserId) {
    ownerLinkMode = "linked_existing_user";

    const linkResult = await linkExistingOwnerAccount({
      supabase: supabase as SupabaseWriteClient,
      adminClient,
      ownerUserId: linkedOwnerUserId,
      companyId: companyData.id,
      companyName,
      actorUserId: auth.user.id,
      primaryContactEmail,
    });

    if (linkResult.error) {
      return NextResponse.json(
        {
          error: linkResult.error,
        },
        { status: 500 }
      );
    }

    approvalWarning = linkResult.metadataWarning;
  }

  if (ownerLinkMode === "invite_created") {
    const inviteResult = await supabase.from("company_invites").insert({
      email: primaryContactEmail,
      role: "company_admin",
      team: companyName,
      company_id: companyData.id,
      account_status: "active",
      created_by: auth.user.id,
      updated_by: auth.user.id,
    });

    if (inviteResult.error) {
      return NextResponse.json(
        {
          error:
            inviteResult.error.message ||
            "The company workspace was created, but the company owner access record could not be created.",
        },
        { status: 500 }
      );
    }
  }

  const approveResult = await supabase
    .from("company_signup_requests")
      .update({
        status: "approved",
        account_status: "active",
        reviewed_at: new Date().toISOString(),
        reviewed_by: auth.user.id,
        notes,
        owner_user_id: linkedOwnerUserId,
      })
    .eq("id", requestId);

  if (approveResult.error) {
    return NextResponse.json(
      {
        error:
          approveResult.error.message ||
          "The company workspace was created, but the signup request could not be marked approved.",
      },
      { status: 500 }
    );
  }

  const emailResult = await sendCompanyInviteEmail({
    toEmail: primaryContactEmail,
    companyName,
    roleLabel: ownerLinkMode === "linked_existing_user" ? "Approved Company Owner" : "Company Owner",
    invitedByName: auth.user.email?.trim() || "Internal Admin",
    mode: ownerLinkMode === "linked_existing_user" ? "login" : "signup",
  });

  return NextResponse.json({
    success: true,
    message: emailResult.sent
      ? ownerLinkMode === "linked_existing_user"
        ? "Workspace approved. The existing company owner account was linked and the owner was emailed to sign in."
        : "Workspace approved. The company owner email was sent sign-in instructions."
      : ownerLinkMode === "linked_existing_user"
        ? "Workspace approved. The existing company owner account was linked and can now sign in."
        : "Workspace approved. The company owner can now sign in with the approved email.",
    warning:
      approvalWarning ||
      (emailResult.sent ? null : emailResult.warning),
  });
}
